"use client";

import { authClient } from "@/lib/firebase/client";

/**
 * Wraps fetch() and attaches the current user's Firebase ID token
 * as a Bearer auth header. Throws if no user is signed in.
 */
export async function authedFetch(url, options = {}) {
  const user = authClient.currentUser;
  if (!user) throw new Error("Not signed in");

  const token = await user.getIdToken();

  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
}
