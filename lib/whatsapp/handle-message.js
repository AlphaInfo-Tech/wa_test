// lib/whatsapp/handle-message.js
import { classify } from "@/lib/router/classify";
import { generateReply } from "@/lib/ai/generate";
import { sendWhatsAppMessage } from "@/lib/whatsapp/send";
import {
  getConversationState,
  getRecentHistory,
  saveMessage,
  flagEscalation,
  updateMessageStatusByWaId,
} from "@/lib/firestore/state";
import { db } from "@/lib/firestore/admin";

const LOW_CONFIDENCE_REPLY =
  "I'm not fully sure about that — let me connect you with someone from our team who can help.";

export async function handleIncomingMessage(message) {
  const contactId = message.from;
  const userText = message.text?.body;

  if (!userText) {
    // non-text message types (image/audio/etc.) — log and skip AI for now
    await saveMessage(contactId, {
      direction: "inbound",
      content: `[${message.type} message]`,
      type: message.type,
      sentBy: "user",
    });
    return;
  }

  await saveMessage(contactId, {
    direction: "inbound",
    content: userText,
    sentBy: "user",
  });

  const state = await getConversationState(contactId);

  // if a human agent already owns this conversation, bot stays silent
  if (state.escalated) return;

  const decision = await classify(userText);

  if (decision.type === "rule") {
    await sendAndLog(contactId, decision.reply);
    return;
  }

  if (decision.type === "escalate") {
    await flagEscalation(contactId, decision.reason);
    await sendAndLog(
      contactId,
      "Got it — connecting you with a member of our team now."
    );
    return;
  }

  // decision.type === "ai"
  const history = await getRecentHistory(contactId);
  const startedAt = Date.now();

  const result = await generateReply({
    userMessage: userText,
    conversationHistory: history,
  });

  const latencyMs = Date.now() - startedAt;

  if (result.confidenceFlag === "low") {
    await flagEscalation(contactId, "low_confidence");
    await sendAndLog(contactId, LOW_CONFIDENCE_REPLY);
  } else {
    await sendAndLog(contactId, result.text);
  }

  await db.collection("ai_logs").add({
    contact_id: contactId,
    user_query: userText,
    model_used: result.modelUsed,
    citations: result.citations,
    tool_calls: result.toolCalls,
    final_response: result.text,
    confidence_flag: result.confidenceFlag,
    latency_ms: latencyMs,
    timestamp: new Date(),
    agent_feedback: { rating: null, note: null },
  });
}

async function sendAndLog(contactId, text) {
  const { success, waMessageId } = await sendWhatsAppMessage(contactId, text);
  await saveMessage(contactId, {
    direction: "outbound",
    content: text,
    sentBy: "bot",
    waMessageId: success ? waMessageId : null,
  });
}

export async function handleStatusUpdate(status) {
  // status: { id, status: "sent"|"delivered"|"read"|"failed", recipient_id, timestamp }
  const waMessageId = status.id;
  const newStatus = status.status;

  if (!waMessageId || !newStatus) return;

  // Status updates can arrive out of order or repeat (Meta may resend);
  // "failed" and "read" are terminal-ish, so just always write the latest
  // value we received — the dashboard only needs the current state, not history.
  await updateMessageStatusByWaId(waMessageId, newStatus);
}
