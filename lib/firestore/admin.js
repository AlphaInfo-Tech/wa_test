// s lib/firestore/admin.js
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function getServiceAccount() {
  // Expect FIREBASE_SERVICE_ACCOUNT as a base64-encoded JSON string in env vars.
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT env var is missing");
  return JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
}

if (!getApps().length) {
  initializeApp({
    credential: cert(getServiceAccount()),
  });
}

export const db = getFirestore();

