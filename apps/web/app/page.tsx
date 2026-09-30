"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Organization = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  _count?: { legalEntities: number };
};
type CurrentUser = { id: string; email: string; permissions: string[] };
type Summary = {
  transactions: number;
  matchedTransactions: number;
  openExceptions: number;
  completedRuns: number;
  closeReadiness: { status: "AWAITING_DATA" | "AWAITING_RECONCILIATION" | "BLOCKED" | "READY"; reason: string };
};
const apiBase =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3003/api/v1";
const nav = [
  ["Overview", "▦", "/"],
  ["Reconciliation", "⌘", "/reconciliation"],
  ["Transactions", "↔", "/transactions"],
  ["Exceptions", "!", "/exceptions"],
  ["Data management", "↥", "/imports"],
  ["Master data", "◇", "/master-data"],
  ["Audit history", "◷", "/audit"],
];

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrganization, setSelectedOrganization] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [apiStatus, setApiStatus] = useState<
    "checking" | "operational" | "unavailable"
  >("checking");

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const me = await fetch(`${apiBase}/auth/me`, { credentials: "include" });
      if (me.status === 401) {
        router.push("/login");
        return;
      }
      if (!me.ok) throw new Error("We could not verify your session.");
      const currentUser = (await me.json()) as CurrentUser;
      setUser(currentUser);
      const response = await fetch(`${apiBase}/organizations`, {
        credentials: "include",
      });
      if (!response.ok)
        throw new Error("We could not load your authorized organizations.");
      const records = (await response.json()) as Organization[];
      setOrganizations(records);
      setSelectedOrganization((current) => current || records[0]?.id || "");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to load the workspace.",
      );
    } finally {
      setLoading(false);
    }
  }, [router]);
  useEffect(() => {
    void Promise.resolve().then(loadWorkspace);
  }, [loadWorkspace]);
  useEffect(() => {
    let active = true;
    void fetch(`${apiBase}/health`)
      .then((response) => {
        if (active) setApiStatus(response.ok ? "operational" : "unavailable");
      })
      .catch(() => {
        if (active) setApiStatus("unavailable");
      });
    return () => {
      active = false;
    };
  }, []);
  const loadSummary = useCallback(async () => {
    if (!selectedOrganization) {
      setSummary(null);
      return;
    }
    try {
      const response = await fetch(
        `${apiBase}/organizations/${selectedOrganization}/dashboard`,
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Unable to load overview metrics.");
      setSummary((await response.json()) as Summary);
    } catch (cause) {
      setSummary(null);
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to load overview metrics.",
      );
    }
  }, [selectedOrganization]);
  useEffect(() => {
    void Promise.resolve().then(loadSummary);
  }, [loadSummary]);
  async function logout() {
    await fetch(`${apiBase}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    router.push("/login");
  }
  async function createOrganization(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${apiBase}/organizations`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.get("code"),
          name: form.get("name"),
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!response.ok)
        throw new Error(body?.message ?? "Organization could not be created.");
      setShowCreate(false);
      setNotice("Organization created successfully.");
      await loadWorkspace();
    } catch (cause) {
      setNotice(
        cause instanceof Error
          ? cause.message
          : "Organization could not be created.",
      );
    } finally {
      setCreating(false);
    }
  }
  const canManage = user?.permissions.includes("organizations:manage") ?? false;
  return (
    <div className="min-h-screen bg-[#f6f7f9] text-[#172033]">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-[#10243f] text-[#cfdaea] lg:flex">
        <div className="flex h-[73px] items-center gap-3 border-b border-white/10 px-6">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#4f8fe8] text-sm font-bold text-white">
            L
          </div>
          <span className="text-base font-semibold tracking-tight text-white">
            Ledgerline
          </span>
        </div>
        <nav aria-label="Primary navigation" className="flex-1 px-3 py-6">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7f95b2]">
            Workspace
          </p>
          {nav.map(([label, icon, href]) => (
            <Link
              href={href}
              key={label}
              className={`mb-1 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition ${label === "Overview" ? "bg-white/12 font-medium text-white" : "hover:bg-white/8 hover:text-white"}`}
            >
              <span className="grid h-5 w-5 place-items-center text-xs">
                {icon}
              </span>
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4 text-xs leading-5 text-[#91a4be]">
          API liveness
          <br />
          <span
            className={
              apiStatus === "operational"
                ? "text-[#6fd0b1]"
                : apiStatus === "unavailable"
                  ? "text-[#ef8e7f]"
                  : "text-[#d9bd6f]"
            }
          >
            ●
          </span>{" "}
          {apiStatus === "operational"
            ? "Operational"
            : apiStatus === "unavailable"
              ? "Unavailable"
              : "Checking…"}
        </div>
      </aside>
      <main className="lg:ml-64">
        <header className="flex h-[73px] items-center justify-between border-b border-[#e4e7ec] bg-white px-5 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="text-xs text-[#687386]">Workspace</span>
            <span className="text-[#a5adba]">/</span>
            <span className="truncate text-xs font-medium text-[#334155]">
              Overview
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              aria-label="Notifications"
              className="relative grid h-9 w-9 place-items-center rounded-md border border-[#e2e7ee] text-[#526176] hover:bg-[#f6f8fb]"
            >
              ♧
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#e2604e]" />
            </button>
            <button
              onClick={() => void logout()}
              className="hidden text-sm text-[#526176] hover:text-[#172033] sm:block"
            >
              Sign out
            </button>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#dce9fb] text-xs font-bold text-[#245ca8]">
              {user ? user.email.slice(0, 2).toUpperCase() : "··"}
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-[1540px] px-5 py-7 sm:px-8">
          <div className="mb-7 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="mb-1 text-sm text-[#687386]">
                Good morning{user ? `, ${user.email.split("@")[0]}` : ""}
              </p>
              <h1 className="text-2xl font-semibold tracking-tight">
                Reconciliation overview
              </h1>
              <p className="mt-1 text-sm text-[#687386]">
                Monitor completion, exposure, and actions requiring attention.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                aria-label="Organization"
                value={selectedOrganization}
                onChange={(event) =>
                  setSelectedOrganization(event.target.value)
                }
                className="h-10 min-w-52 rounded-md border border-[#dce2ea] bg-white px-3 text-sm text-[#334155] shadow-sm"
              >
                <option value="">All authorized organizations</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Reporting period"
                className="h-10 rounded-md border border-[#dce2ea] bg-white px-3 text-sm text-[#334155] shadow-sm"
              >
                <option>Current period</option>
              </select>
              {canManage && (
                <button
                  onClick={() => setShowCreate(true)}
                  className="h-10 rounded-md bg-[#2369c8] px-4 text-sm font-medium text-white shadow-sm hover:bg-[#195aa9]"
                >
                  + New organization
                </button>
              )}
            </div>
          </div>
          {notice && (
            <div
              role="status"
              className="mb-5 rounded-md border border-[#bfd7fb] bg-[#edf5ff] px-4 py-3 text-sm text-[#245ca8]"
            >
              {notice}
            </div>
          )}
          {error && (
            <div
              role="alert"
              className="mb-5 flex items-center justify-between gap-4 rounded-md border border-[#f1c3bd] bg-[#fff5f3] px-4 py-3 text-sm text-[#a53b2d]"
            >
              {error}
              <button
                onClick={() => void loadWorkspace()}
                className="font-semibold underline"
              >
                Try again
              </button>
            </div>
          )}
          <section
            aria-label="Reconciliation metrics"
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            <Metric
              label="Matched transactions"
              value={
                summary
                  ? `${summary.transactions ? Math.round((summary.matchedTransactions / summary.transactions) * 100) : 0}%`
                  : "—"
              }
              detail={
                summary
                  ? `${summary.matchedTransactions} of ${summary.transactions} imported transactions`
                  : "Loading selected organization"
              }
              tone="blue"
            />
            <Metric
              label="Transactions processed"
              value={summary?.transactions.toLocaleString() ?? "—"}
              detail="Imported transaction records"
              tone="slate"
            />
            <Metric
              label="Open exceptions"
              value={summary?.openExceptions.toLocaleString() ?? "—"}
              detail={
                summary?.openExceptions
                  ? "Requires investigation"
                  : "Nothing needs investigation"
              }
              tone={summary?.openExceptions ? "amber" : "green"}
            />
            <Metric
              label="Completed runs"
              value={summary?.completedRuns.toLocaleString() ?? "—"}
              detail="Including runs with exceptions"
              tone="green"
            />
          </section>
          <section className="mt-6 grid gap-6 xl:grid-cols-[1.65fr_1fr]">
            <div className="rounded-lg border border-[#e2e6ec] bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-[#edf0f4] px-5 py-4">
                <div>
                  <h2 className="font-semibold">Close readiness</h2>
                  <p className="mt-0.5 text-sm text-[#687386]">
                    Status reflects persisted imported transactions and
                    completed reconciliation runs.
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${summary?.closeReadiness.status === "READY" ? "bg-[#e9f7f1] text-[#187458]" : summary?.closeReadiness.status === "BLOCKED" ? "bg-[#fff0ed] text-[#a53b2d]" : "bg-[#eef2f7] text-[#526176]"}`}>
                  {summary?.closeReadiness.status === "READY" ? "Ready" : summary?.closeReadiness.status === "BLOCKED" ? "Blocked" : summary?.closeReadiness.status === "AWAITING_RECONCILIATION" ? "Awaiting reconciliation" : "Awaiting data"}
                </span>
              </div>
              <div className="grid min-h-72 place-items-center px-6 text-center">
                <div>
                  <div className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-full bg-[#eef4fc] text-xl text-[#3b78cf]">
                    ⌁
                  </div>
                  <h3 className="font-medium">
                    {summary?.transactions
                      ? `${summary.transactions.toLocaleString()} transactions available`
                      : "No reconciliation activity yet"}
                  </h3>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#687386]">
                    {summary?.closeReadiness.reason ?? "Import source transactions and start a reconciliation run to see close progress here."}
                  </p>
                  <Link
                    href="/imports"
                    className="mt-5 inline-block rounded-md border border-[#ccd6e3] px-3.5 py-2 text-sm font-medium text-[#245ca8] hover:bg-[#f6f9fd]"
                  >
                    View data management
                  </Link>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-[#e2e6ec] bg-white shadow-sm">
              <div className="border-b border-[#edf0f4] px-5 py-4">
                <h2 className="font-semibold">Authorized organizations</h2>
                <p className="mt-0.5 text-sm text-[#687386]">
                  Your current access scope
                </p>
              </div>
              <div className="divide-y divide-[#edf0f4]">
                {loading ? (
                  <div className="p-5 text-sm text-[#687386]">
                    Loading organizations…
                  </div>
                ) : organizations.length === 0 ? (
                  <div className="p-5 text-sm leading-6 text-[#687386]">
                    No organization access has been assigned to this account.
                  </div>
                ) : (
                  organizations.slice(0, 4).map((organization) => (
                    <div
                      key={organization.id}
                      className="flex items-center justify-between gap-3 px-5 py-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {organization.name}
                        </p>
                        <p className="mt-0.5 text-xs text-[#7a8595]">
                          {organization.code} ·{" "}
                          {organization._count?.legalEntities ?? 0} legal
                          entities
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-medium ${organization.isActive ? "bg-[#e9f7f1] text-[#187458]" : "bg-[#f3f4f6] text-[#687386]"}`}
                      >
                        {organization.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div className="border-t border-[#edf0f4] px-5 py-3">
                <Link href="#" className="text-sm font-medium text-[#2467bf]">
                  Manage organization access →
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>
      {showCreate && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-org-title"
          className="fixed inset-0 z-10 grid place-items-center bg-[#10243f]/35 p-4"
        >
          <form
            onSubmit={createOrganization}
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <h2 id="new-org-title" className="text-lg font-semibold">
                  Create organization
                </h2>
                <p className="mt-1 text-sm text-[#687386]">
                  This creates a new tenant. Assign access before adding
                  financial data.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setShowCreate(false)}
                className="text-xl text-[#687386]"
              >
                ×
              </button>
            </div>
            <label className="mt-5 block text-sm font-medium">
              Organization name
              <input
                required
                name="name"
                maxLength={200}
                className="mt-1.5 h-10 w-full rounded-md border border-[#d7dee8] px-3 font-normal"
              />
            </label>
            <label className="mt-4 block text-sm font-medium">
              Organization code
              <input
                required
                name="code"
                minLength={2}
                maxLength={50}
                pattern="[A-Za-z0-9_-]+"
                className="mt-1.5 h-10 w-full rounded-md border border-[#d7dee8] px-3 font-normal uppercase"
              />
              <span className="mt-1 block text-xs font-normal text-[#687386]">
                2–50 letters, numbers, hyphens, or underscores.
              </span>
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-[#526176] hover:bg-[#f4f6f8]"
              >
                Cancel
              </button>
              <button
                disabled={creating}
                className="rounded-md bg-[#2369c8] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {creating ? "Creating…" : "Create organization"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
function Metric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "blue" | "slate" | "green" | "amber";
}) {
  const accents = {
    blue: "bg-[#eaf2fd]",
    slate: "bg-[#eff2f6]",
    green: "bg-[#e9f7f1]",
    amber: "bg-[#fff5dc]",
  };
  return (
    <article className="rounded-lg border border-[#e2e6ec] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[#526176]">{label}</p>
        <span className={`h-2.5 w-2.5 rounded-full ${accents[tone]}`} />
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-xs text-[#7a8595]">{detail}</p>
    </article>
  );
}
