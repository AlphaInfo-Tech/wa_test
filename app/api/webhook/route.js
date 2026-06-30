// app/api/webhook/route.js
import { waitUntil } from "@vercel/functions";
import { isDuplicateMessage } from "@/lib/whatsapp/dedupe";
import { handleIncomingMessage, handleStatusUpdate } from "@/lib/whatsapp/handle-message";

// --- Meta webhook verification (one-time setup handshake) ---
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

// --- Incoming messages + status updates ---
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    // malformed payload — still ack so Meta doesn't retry indefinitely
    return new Response("OK", { status: 200 });
  }

  try {
    const value = body?.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    const status = value?.statuses?.[0];

    if (message) {
      const duplicate = await isDuplicateMessage(message.id);
      if (!duplicate) {
        waitUntil(
          handleIncomingMessage(message).catch((err) =>
            console.error("handleIncomingMessage error:", err)
          )
        );
      }
    } else if (status) {
      waitUntil(
        handleStatusUpdate(status).catch((err) =>
          console.error("handleStatusUpdate error:", err)
        )
      );
    }
  } catch (err) {
    // never let an internal error cause a non-200 response —
    // that would trigger unnecessary Meta retries and duplicate processing
    console.error("webhook processing error:", err);
  }

  return new Response("OK", { status: 200 });
}
