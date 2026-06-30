// lib/auth/verify-request.js
import { getAuth } from "firebase-admin/auth";
import "@/lib/firestore/admin"; // ensures firebase-admin app is initialized first

/**
 * Verifies the Firebase ID token sent in the Authorization header.
 * Returns the decoded token (includes uid, email) or throws.
 *
 * Usage in an API route:
 *   const agent = await requireAuth(req);
 *   if (!agent) return Response.json({ error: "Unauthorized" }, { status: 401 });
 */
export async function requireAuth(req) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) return null;

  try {
    const decoded = await getAuth().verifyIdToken(token);
    return decoded; // { uid, email, ... }
  } catch (err) {
    console.error("Auth token verification failed:", err.message);
    return null;
  }
}
