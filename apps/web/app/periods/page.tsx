"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3003/api/v1";
type Org = { id: string; name: string };
type Period = {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  closedAt?: string | null;
};
export default function PeriodsPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgId, setOrgId] = useState("");
  const [periods, setPeriods] = useState<Period[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const me = await fetch(`${api}/auth/me`, { credentials: "include" });
    if (me.status === 401) {
      router.push("/login");
      return;
    }
    const organizations = await fetch(`${api}/organizations`, {
      credentials: "include",
    });
    if (!organizations.ok) throw new Error("Unable to load organizations.");
    const data = (await organizations.json()) as Org[];
    setOrgs(data);
    setOrgId((current) => current || data[0]?.id || "");
  }, [router]);
  const list = useCallback(async () => {
    if (!orgId) return;
    const response = await fetch(
      `${api}/organizations/${orgId}/reconciliation-periods`,
      { credentials: "include" },
    );
    if (!response.ok) {
      setNotice("Unable to load reconciliation periods.");
      return;
    }
    setPeriods((await response.json()) as Period[]);
  }, [orgId]);
  useEffect(() => {
    void Promise.resolve()
      .then(load)
      .catch((error: unknown) =>
        setNotice(
          error instanceof Error ? error.message : "Unable to load workspace.",
        ),
      );
  }, [load]);
  useEffect(() => {
    void Promise.resolve().then(list);
  }, [list]);
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(
        `${api}/organizations/${orgId}/reconciliation-periods`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.get("name"),
            periodStart: form.get("periodStart"),
            periodEnd: form.get("periodEnd"),
          }),
        },
      );
      const body = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!response.ok)
        throw new Error(body?.message ?? "Period could not be created.");
      event.currentTarget.reset();
      setNotice("Reconciliation period opened.");
      await list();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Period could not be created.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function close(period: Period) {
    if (
      !window.confirm(
        `Close ${period.name}? This is permitted only when runs are complete and exceptions are resolved.`,
      )
    )
      return;
    setBusy(true);
    try {
      const response = await fetch(
        `${api}/organizations/${orgId}/reconciliation-periods/${period.id}/close`,
        { method: "POST", credentials: "include" },
      );
      const body = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!response.ok)
        throw new Error(body?.message ?? "Period could not be closed.");
      setNotice(`${period.name} closed.`);
      await list();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Period could not be closed.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="min-h-screen bg-[#f6f7f9] text-[#172033]">
      <header className="flex h-[73px] items-center justify-between border-b border-[#e4e7ec] bg-white px-5 sm:px-8">
        <Link href="/" className="font-semibold">
          Ledgerline
        </Link>
        <Link href="/" className="text-sm font-medium text-[#2467bf]">
          ← Overview
        </Link>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-8">
        <p className="text-sm text-[#687386]">Close management</p>
        <h1 className="mt-1 text-2xl font-semibold">Reconciliation periods</h1>
        <select
          aria-label="Organization"
          value={orgId}
          onChange={(event) => setOrgId(event.target.value)}
          className="mt-5 h-10 min-w-64 rounded-md border border-[#dce2ea] bg-white px-3"
        >
          {orgs.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
        {notice && (
          <p role="status" className="mt-4 text-sm text-[#2467bf]">
            {notice}
          </p>
        )}
        <section className="mt-6 grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
          <form
            onSubmit={create}
            className="rounded-lg border border-[#e2e6ec] bg-white p-5 shadow-sm"
          >
            <h2 className="font-semibold">Open period</h2>
            <label className="mt-4 block text-sm font-medium">
              Name
              <input
                required
                name="name"
                maxLength={100}
                placeholder="January 2026 close"
                className="mt-1 h-10 w-full rounded-md border border-[#d7dee8] px-3 font-normal"
              />
            </label>
            <label className="mt-4 block text-sm font-medium">
              Start
              <input
                required
                type="date"
                name="periodStart"
                className="mt-1 h-10 w-full rounded-md border border-[#d7dee8] px-3 font-normal"
              />
            </label>
            <label className="mt-4 block text-sm font-medium">
              End
              <input
                required
                type="date"
                name="periodEnd"
                className="mt-1 h-10 w-full rounded-md border border-[#d7dee8] px-3 font-normal"
              />
            </label>
            <button
              disabled={busy || !orgId}
              className="mt-6 rounded-md bg-[#2369c8] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Open period
            </button>
          </form>
          <section className="overflow-hidden rounded-lg border border-[#e2e6ec] bg-white shadow-sm">
                <div className="border-b border-[#edf0f4] px-5 py-4">
                  <h2 className="font-semibold">Period history</h2>
                  <p className="mt-1 text-sm text-[#687386]">
                    Closure requires a completed run and no unresolved period
                    exceptions.
                  </p>
                </div>
            {periods.length === 0 ? (
              <p className="p-8 text-center text-sm text-[#687386]">
                No periods have been opened.
              </p>
            ) : (
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#fafbfd] text-xs uppercase text-[#687386]">
                  <tr>
                    <th className="px-5 py-3">Period</th>
                    <th className="px-5 py-3">Date range</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf0f4]">
                  {periods.map((period) => (
                    <tr key={period.id}>
                      <td className="px-5 py-4">
                        <p className="font-medium">{period.name}</p>
                        {period.closedAt && (
                          <p className="mt-1 text-xs text-[#687386]">
                            Closed {new Date(period.closedAt).toLocaleString()}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4 text-[#526176]">
                        {period.periodStart.slice(0, 10)} —{" "}
                        {period.periodEnd.slice(0, 10)}
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-full bg-[#eef2f7] px-2 py-1 text-xs">
                          {period.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {period.status === "OPEN" && (
                          <button
                            disabled={busy}
                            onClick={() => void close(period)}
                            className="text-sm font-medium text-[#2467bf] hover:underline disabled:opacity-50"
                          >
                            Close period
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
