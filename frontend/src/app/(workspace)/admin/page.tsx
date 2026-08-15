"use client";

import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { WorkspacePage } from "@/components/workspace-page";

export default function AdminPage() {
  const { user } = useAuth();

  if (user?.role !== "Admin") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-rose-50 text-2xl text-rose-600 shadow-sm border border-rose-100">
          ⚠️
        </span>
        <h2 className="mt-6 text-xl font-semibold text-slate-900">Access Denied</h2>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          You do not have administrative privileges. Admin rights are required to view this area.
        </p>
        <Link
          href="/dashboard"
          className="mt-8 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition"
        >
          Go back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <WorkspacePage
      eyebrow="Administration"
      title="Workspace administration"
      description="Manage users, roles, security policies, and system-level configuration from one controlled area."
      action="Invite user"
      metrics={[
        { label: "Workspace users", value: "42", change: "+3 this month" },
        { label: "Admin users", value: "4", change: "No changes" },
        { label: "Security checks", value: "100%", change: "All controls passing" },
      ]}
      items={[
        { title: "Role access review", detail: "Quarterly permission audit", status: "Due soon" },
        { title: "New user invitation", detail: "Pending acceptance", status: "Pending" },
        { title: "API security policy", detail: "Last updated Aug 5", status: "Active" },
      ]}
    />
  );
}

