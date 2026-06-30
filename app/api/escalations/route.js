// app/api/escalations/route.js
import { db } from "@/lib/firestore/admin";
import { requireAuth } from "@/lib/auth/verify-request";

// PATCH: claim an escalation (assign to self) or resolve it.
// body: { escalationId, action: "claim" | "resolve" }
export async function PATCH(req) {
  const agent = await requireAuth(req);
  if (!agent) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { escalationId, action } = await req.json();

    if (!escalationId || !["claim", "resolve"].includes(action)) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    const ref = db.collection("escalations").doc(escalationId);
    const doc = await ref.get();
    if (!doc.exists) {
      return Response.json({ error: "Escalation not found" }, { status: 404 });
    }

    const agentLabel = agent.email || agent.uid;

    if (action === "claim") {
      await ref.update({
        status: "in_progress",
        assigned_agent: agentLabel,
      });
    } else {
      await ref.update({
        status: "resolved",
        resolved_at: new Date(),
      });

      // also release the contact back to the bot once resolved
      const data = doc.data();
      if (data.contact_id) {
        await db.collection("contacts").doc(data.contact_id).set(
          { escalated: false, assigned_agent: null },
          { merge: true }
        );
      }
    }

    return Response.json({ updated: true });
  } catch (err) {
    console.error("escalations update error:", err);
    return Response.json({ error: "Update failed" }, { status: 500 });
  }
}
