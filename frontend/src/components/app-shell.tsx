"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/context/auth-context";


const navigation = [
  ["Overview", "/dashboard"],
  ["AI Chat", "/chat"],
  ["Knowledge", "/knowledge"],
  ["Documents", "/documents"],
  ["Agents", "/agents"],
  ["Analytics", "/analytics"],
  ["Automation", "/automation"],
  ["Tasks", "/tasks"],
  ["Reports", "/reports"],
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 hidden w-64 border-r border-slate-200 bg-white px-4 py-5 lg:block">
        <Link href="/dashboard" className="mb-9 flex items-center gap-3 px-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-sm font-bold text-white">N</span>
          <span className="font-semibold tracking-tight">Nexus</span>
        </Link>
        <p className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Workspace</p>
        <nav className="space-y-1">
          {navigation.map(([label, href]) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
            return (
              <Link key={href} href={href} className={`flex rounded-lg px-3 py-2 text-sm transition ${active ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}>
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute inset-x-4 bottom-5 border-t border-slate-100 pt-4">
          <Link href="/settings" className="block rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">Settings</Link>
          <Link href="/admin" className="block rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">Admin</Link>
          <button onClick={logout} className="mt-1 block w-full rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 hover:text-rose-700 font-medium transition">
            Log out
          </button>
          <div className="mt-4 flex items-center gap-3 px-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-indigo-600 text-xs font-semibold text-white">{initials}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{user?.full_name}</p>
              <p className="text-xs text-slate-500 truncate capitalize">{user?.role} · {user?.department || "General"}</p>
            </div>
          </div>
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-5 backdrop-blur lg:px-8">
          <Link href="/dashboard" className="font-semibold lg:hidden">Nexus</Link>
          <div className="hidden w-80 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400 sm:block">Search workspace...</div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 capitalize">{user?.role}</span>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-indigo-600 text-xs font-semibold text-white">{initials}</span>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-5 py-8 pb-24 lg:px-8 lg:pb-8">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-slate-200 bg-white p-2 lg:hidden">
        {navigation.slice(0, 4).map(([label, href]) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
          return <Link key={href} href={href} className={`rounded-lg py-2 text-center text-xs font-medium ${active ? "bg-indigo-50 text-indigo-700" : "text-slate-500"}`}>{label}</Link>;
        })}
      </nav>
    </div>
  );
}
