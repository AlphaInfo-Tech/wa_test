// lib/whatsapp/dedupe.js
import { db } from "@/lib/firestore/admin";

const DEDUPE_TTL_MS = 24 * 60 * 60 * 1000; // 24h, pair with a Firestore TTL policy on expires_at

/**
 * Returns true if this message_id has already been seen.
 * Marks it as seen BEFORE processing starts, to avoid race conditions
 * if Meta retries the webhook while the first attempt is still running.
 */
export async function isDuplicateMessage(messageId) {
  const ref = db.collection("processed_messages").doc(messageId);

  const result = await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (doc.exists) return true;

    tx.set(ref, {
      processed_at: new Date(),
      expires_at: new Date(Date.now() + DEDUPE_TTL_MS),
    });
    return false;
  });

  return result;
}
