"use client";

import { useEffect, useRef, useState } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { dbClient } from "@/lib/firebase/client";
import { authedFetch } from "@/lib/auth/authed-fetch";

function formatTime(value) {
  if (!value) return "";
  const d = value.toDate ? value.toDate() : new Date(value);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function bubbleStyle(sentBy, direction) {
  if (direction === "inbound") return "bg-slate-100 text-slate-900 self-start";
  if (sentBy?.startsWith("agent")) return "bg-blue-600 text-white self-end";
  return "bg-slate-900 text-white self-end"; // bot replies
}

function senderLabel(sentBy, direction) {
  if (direction === "inbound") return null;
  if (sentBy?.startsWith("agent")) return "You";
  return "Bot";
}

function StatusTicks({ status }) {
  if (!status) return null;
  if (status === "failed") {
    return <span className="text-[10px] text-red-400 ml-1" title="Failed to deliver">⚠</span>;
  }
  // single check = sent, double gray = delivered, double blue = read
  const color = status === "read" ? "text-sky-400" : "text-slate-300";
  const ticks = status === "sent" ? "✓" : "✓✓";
  return (
    <span className={`text-[10px] ml-1 ${color}`} title={status}>
      {ticks}
    </span>
  );
}

export default function ConversationThread({ contactId, contact }) {
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [toggling, setToggling] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    const q = query(
      collection(dbClient, "conversations", contactId, "messages"),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => unsubscribe();
  }, [contactId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = replyText.trim();
    if (!text) return;

    setSending(true);
    setReplyText("");
    try {
      const res = await authedFetch("/api/agent-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, text }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to send reply");
        setReplyText(text); // restore on failure
      }
    } catch {
      alert("Failed to send reply");
      setReplyText(text);
    } finally {
      setSending(false);
    }
  };

  const handleRelease = async () => {
    setToggling(true);
    try {
      await authedFetch("/api/agent-reply", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId }),
      });
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-900">{contact?.name || contactId}</p>
          <p className="text-xs text-slate-400">{contactId}</p>
        </div>
        {contact?.escalated ? (
          <button
            onClick={handleRelease}
            disabled={toggling}
            className="text-xs px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 hover:border-slate-300 disabled:opacity-50"
          >
            {toggling ? "Releasing…" : "Release to bot"}
          </button>
        ) : (
          <span className="text-xs px-3 py-1.5 rounded-full bg-slate-50 text-slate-400">
            Bot handling
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2">
        {messages.map((m) => {
          const label = senderLabel(m.sent_by, m.direction);
          return (
            <div key={m.id} className={`flex flex-col max-w-[70%] ${m.direction === "inbound" ? "items-start" : "items-end self-end"}`}>
              {label && <span className="text-[10px] text-slate-400 mb-0.5 px-1">{label}</span>}
              <div className={`px-3 py-2 rounded-2xl text-sm ${bubbleStyle(m.sent_by, m.direction)}`}>
                {m.content}
              </div>
              <span className="text-[10px] text-slate-300 mt-0.5 px-1 flex items-center">
                {formatTime(m.timestamp)}
                {m.direction === "outbound" && <StatusTicks status={m.status} />}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply box */}
      <div className="px-5 py-4 border-t border-slate-100">
        <div className="flex items-end gap-2">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a reply…"
            rows={1}
            className="flex-1 resize-none border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
          />
          <button
            onClick={handleSend}
            disabled={sending || !replyText.trim()}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium disabled:opacity-40"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mt-1.5">
          Sending a reply marks this conversation as agent-handled — the bot won't auto-reply until released.
        </p>
      </div>
    </div>
  );
}
