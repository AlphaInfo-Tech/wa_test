"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { dbClient } from "@/lib/firebase/client";
import ConversationThread from "./conversation-thread";

function formatTime(value) {
  if (!value) return "";
  const d = value.toDate ? value.toDate() : new Date(value);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function InboxContent() {
  const searchParams = useSearchParams();
  const deepLinkContact = searchParams.get("contact");

  const [contacts, setContacts] = useState([]);
  const [selectedId, setSelectedId] = useState(deepLinkContact || null);
  const [filter, setFilter] = useState("all"); // all | escalated | bot

  useEffect(() => {
    const q = query(
      collection(dbClient, "contacts"),
      orderBy("last_active_at", "desc"),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setContacts(list);
      // auto-select the first conversation only if nothing is selected yet
      // (deep link already set selectedId on initial render, so this won't override it)
      setSelectedId((prev) => prev ?? list[0]?.id ?? null);
    });

    return () => unsubscribe();
  }, []);

  const filteredContacts = contacts.filter((c) => {
    if (filter === "escalated") return c.escalated;
    if (filter === "bot") return !c.escalated;
    return true;
  });

  return (
    <div className="flex h-screen bg-white">
      {/* Conversation list */}
      <div className="w-80 flex-shrink-0 border-r border-slate-100 flex flex-col">
        <div className="px-4 py-4 border-b border-slate-100">
          <h1 className="text-sm font-semibold text-slate-900">Inbox</h1>
          <div className="flex gap-1 mt-3">
            {[
              { key: "all", label: "All" },
              { key: "escalated", label: "Needs agent" },
              { key: "bot", label: "Bot handled" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  filter === f.key
                    ? "bg-slate-900 text-white border-slate-900"
                    : "border-slate-200 text-slate-500 hover:border-slate-300"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredContacts.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8 px-4">
              No conversations here.
            </p>
          ) : (
            filteredContacts.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`w-full text-left px-4 py-3 border-b border-slate-50 transition-colors ${
                  selectedId === c.id ? "bg-slate-50" : "hover:bg-slate-25"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-900 truncate">
                    {c.name || c.id}
                  </span>
                  {c.escalated && (
                    <span className="flex-shrink-0 w-2 h-2 rounded-full bg-amber-400" title="Needs agent" />
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{formatTime(c.last_active_at)}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedId ? (
          <ConversationThread
            contactId={selectedId}
            contact={contacts.find((c) => c.id === selectedId)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
            Select a conversation
          </div>
        )}
      </div>
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-400">Loading…</div>}>
      <InboxContent />
    </Suspense>
  );
}
