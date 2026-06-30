// lib/whatsapp/send.js
const GRAPH_VERSION = "v20.0";

/**
 * Sends a WhatsApp text message and returns { success, waMessageId }.
 * waMessageId is the id Meta assigns to the outbound message — needed to
 * correlate later delivery/read status webhooks back to this specific message.
 */
export async function sendWhatsAppMessage(to, text) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${process.env.WHATSAPP_PHONE_ID}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error("WhatsApp send failed:", res.status, errBody);
    return { success: false, waMessageId: null };
  }

  const data = await res.json();
  // Cloud API returns: { messages: [{ id: "wamid.xxx" }], ... }
  const waMessageId = data?.messages?.[0]?.id || null;

  return { success: true, waMessageId };
}
