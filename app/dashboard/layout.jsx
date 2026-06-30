"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";

export default function DashboardLayout({ children }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-slate-400">
        Loading…
      </div>
    );
  }

  if (!user) {
    // brief flash before redirect effect fires
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-5 py-2.5 border-b border-slate-100 bg-white">
        <nav className="flex gap-4 text-sm">
          <a href="/dashboard/inbox" className="text-slate-600 hover:text-slate-900">Inbox</a>
          <a href="/dashboard/knowledge-base" className="text-slate-600 hover:text-slate-900">Knowledge base</a>
          <a href="/dashboard/escalations" className="text-slate-600 hover:text-slate-900">Escalations</a>
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">{user.email}</span>
          <button
            onClick={logout}
            className="text-xs text-slate-400 hover:text-slate-700"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="flex-1 min-h-0">{children}</main>
    </div>
  );
}
