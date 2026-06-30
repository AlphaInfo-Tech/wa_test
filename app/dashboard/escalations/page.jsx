"use client";

import { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { dbClient, authClient } from "@/lib/firebase/client";
import { authedFetch } from "@/lib/auth/authed-fetch";

const REASON_LABELS = {
  low_confidence: "AI unsure",
  user_requested: "Asked for a human",
  negative_sentiment: "Negative sentiment",
};

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In progress" },
  { key: "resolved", label: "Resolved" },
];

function formatTime(value) {
  if (!value) return "";
  const d = value.toDate ? value.toDate() : new Date(value);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function EscalationsPage() {
  const [tab, setTab] = useState("pending");
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(dbClient, "escalations"),
      where("status", "==", tab),
      orderBy("created_at", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setEscalations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("escalations listener error:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [tab]);

  const handleAction = async (escalationId, action) => {
    setActingOn(escalationId);
    setError(null);
    try {
      const res = await authedFetch("/api/escalations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ escalationId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
    } catch (err) {
      setError(err.message);
    } finally {
      setActingOn(null);
    }
  };

  const currentAgentEmail = authClient.currentUser?.email;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Escalations</h1>
        <p className="text-sm text-slate-500 mt-1">
          Conversations the bot couldn't handle, waiting on a human.
        </p>
      </div>

      <div className="flex gap-1 mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              tab === t.key
                ? "bg-slate-900 text-white border-slate-900"
                : "border-slate-200 text-slate-500 hover:border-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : escalations.length === 0 ? (
        <div className="text-center py-12 text-sm text-slate-400">
          Nothing here right now.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
          {escalations.map((e) => (
            <li key={e.id} className="flex items-center justify-between px-4 py-3 bg-white">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <a
                    href={`/dashboard/inbox?contact=${e.contact_id}`}
                    className="text-sm font-medium text-slate-900 hover:underline"
                  >
                    {e.contact_id}
                  </a>
                  <span className="text-xs text-slate-400">
                    {REASON_LABELS[e.reason] || e.reason}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {formatTime(e.created_at)}
                  {e.assigned_agent && tab !== "pending" ? ` · ${e.assigned_agent}` : ""}
                </p>
              </div>

              <div className="flex-shrink-0 ml-4">
                {tab === "pending" && (
                  <button
                    onClick={() => handleAction(e.id, "claim")}
                    disabled={actingOn === e.id}
                    className="text-xs px-3 py-1.5 rounded-full bg-slate-900 text-white disabled:opacity-50"
                  >
                    {actingOn === e.id ? "Claiming…" : "Claim"}
                  </button>
                )}
                {tab === "in_progress" && (
                  <button
                    onClick={() => handleAction(e.id, "resolve")}
                    disabled={actingOn === e.id}
                    className="text-xs px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 hover:border-slate-300 disabled:opacity-50"
                  >
                    {actingOn === e.id ? "Resolving…" : "Mark resolved"}
                  </button>
                )}
                {tab === "resolved" && (
                  <span className="text-xs text-slate-300">Resolved</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
