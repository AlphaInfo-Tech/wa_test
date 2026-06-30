// lib/firestore/state.js
import { db } from "@/lib/firestore/admin";

const HISTORY_LIMIT = 10; // last N messages used as conversation context

export async function getConversationState(contactId) {
  const ref = db.collection("contacts").doc(contactId);
  const doc = await ref.get();
  return doc.exists ? doc.data() : { escalated: false, assigned_agent: null };
}

export async function getRecentHistory(contactId) {
  const snap = await db
    .collection("conversations")
    .doc(contactId)
    .collection("messages")
    .orderBy("timestamp", "desc")
    .limit(HISTORY_LIMIT)
    .get();

  // reverse to chronological order, map to OpenAI-style role/content pairs
  return snap.docs
    .reverse()
    .map((d) => {
      const m = d.data();
      return {
        role: m.direction === "inbound" ? "user" : "assistant",
        content: m.content,
      };
    });
}

export async function saveMessage(contactId, { direction, content, type = "text", sentBy, waMessageId = null }) {
  const docRef = await db
    .collection("conversations")
    .doc(contactId)
    .collection("messages")
    .add({
      direction,
      content,
      type,
      sent_by: sentBy,
      wa_message_id: waMessageId, // used to correlate delivery/read status webhooks
      status: direction === "outbound" ? "sent" : null,
      timestamp: new Date(),
    });

  await db.collection("contacts").doc(contactId).set(
    { last_active_at: new Date() },
    { merge: true }
  );

  return docRef.id;
}

/**
 * Updates the delivery status (sent/delivered/read/failed) on an outbound
 * message, looked up by the WhatsApp message id Meta assigned at send time.
 * Searches across all contacts since the status webhook only gives us the
 * message id, not which contact it belongs to.
 */
export async function updateMessageStatusByWaId(waMessageId, status) {
  const snap = await db
    .collectionGroup("messages")
    .where("wa_message_id", "==", waMessageId)
    .limit(1)
    .get();

  if (snap.empty) {
    console.warn("No message found for wa_message_id:", waMessageId);
    return false;
  }

  await snap.docs[0].ref.update({ status });
  return true;
}

export async function flagEscalation(contactId, reason) {
  await db.collection("contacts").doc(contactId).set(
    { escalated: true },
    { merge: true }
  );

  await db.collection("escalations").add({
    contact_id: contactId,
    reason,
    status: "pending",
    created_at: new Date(),
    assigned_agent: null,
  });
}
