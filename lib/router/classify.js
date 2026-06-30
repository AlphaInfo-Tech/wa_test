// lib/router/classify.js
import { db } from "@/lib/firestore/admin";

let cachedFlows = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 60 * 1000; // refresh active flows at most once a minute

async function getActiveFlows() {
  if (cachedFlows && Date.now() < cacheExpiresAt) return cachedFlows;

  const snap = await db.collection("flows").where("active", "==", true).get();
  cachedFlows = snap.docs
    .map((d) => d.data())
    .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;

  return cachedFlows;
}

const HUMAN_REQUEST_TRIGGERS = ["talk to a human", "talk to someone", "agent", "representative"];

export async function classify(userMessage) {
  const text = userMessage.toLowerCase();

  if (HUMAN_REQUEST_TRIGGERS.some((t) => text.includes(t))) {
    return { type: "escalate", reason: "user_requested" };
  }

  const flows = await getActiveFlows();
  const matched = flows.find((f) =>
    (f.triggers || []).some((t) => text.includes(t.toLowerCase()))
  );

  if (matched) return { type: "rule", reply: matched.reply };

  return { type: "ai" };
}
