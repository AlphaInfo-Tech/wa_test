// app/api/agent-reply/route.js
import { db } from "@/lib/firestore/admin";
import { sendWhatsAppMessage } from "@/lib/whatsapp/send";
import { saveMessage } from "@/lib/firestore/state";
import { requireAuth } from "@/lib/auth/verify-request";

// POST: agent sends a manual reply. Marks the conversation as agent-owned
// so the bot stops auto-replying until explicitly released.
export async function POST(req) {
  const agent = await requireAuth(req);
  if (!agent) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { contactId, text } = await req.json();

    if (!contactId || !text) {
      return Response.json({ error: "contactId and text are required" }, { status: 400 });
    }

    const { success, waMessageId } = await sendWhatsAppMessage(contactId, text);
    if (!success) {
      return Response.json({ error: "WhatsApp send failed" }, { status: 502 });
    }

    await saveMessage(contactId, {
      direction: "outbound",
      content: text,
      sentBy: `agent:${agent.email || agent.uid}`,
      waMessageId,
    });

    await db.collection("contacts").doc(contactId).set(
      { escalated: true, assigned_agent: agent.email || agent.uid },
      { merge: true }
    );

    return Response.json({ sent: true });
  } catch (err) {
    console.error("agent-reply error:", err);
    return Response.json({ error: "Failed to send reply" }, { status: 500 });
  }
}

// PATCH: release a conversation back to the bot (un-escalate).
export async function PATCH(req) {
  const agent = await requireAuth(req);
  if (!agent) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { contactId } = await req.json();
    if (!contactId) {
      return Response.json({ error: "contactId is required" }, { status: 400 });
    }

    await db.collection("contacts").doc(contactId).set(
      { escalated: false, assigned_agent: null },
      { merge: true }
    );

    return Response.json({ released: true });
  } catch (err) {
    console.error("release conversation error:", err);
    return Response.json({ error: "Failed to release conversation" }, { status: 500 });
  }
}
