"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3003/api/v1";
type Org = { id: string; name: string; legalEntities?: Entity[] };
type Entity = { id: string; code: string; name: string; isActive: boolean };
type Run = {
  id: string;
  name: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  rulesVersion: string;
  legalEntity: Entity;
  counterpartLegalEntity?: Entity | null;
  _count: { matches: number; exceptions: number };
};
export default function ReconciliationPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgId, setOrgId] = useState("");
  const [runs, setRuns] = useState<Run[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [runStatus, setRunStatus] = useState("");
  const load = useCallback(async () => {
    try {
      const me = await fetch(`${api}/auth/me`, { credentials: "include" });
      if (me.status === 401) {
        router.push("/login");
        return;
      }
      const response = await fetch(`${api}/organizations`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Unable to load organizations.");
      const data = (await response.json()) as Org[];
      setOrgs(data);
      setOrgId((value) => value || data[0]?.id || "");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to load workspace.",
      );
    }
  }, [router]);
  const loadRuns = useCallback(async () => {
    if (!orgId) return;
    try {
      const [detail, list] = await Promise.all([
        fetch(`${api}/organizations/${orgId}`, { credentials: "include" }),
        fetch(`${api}/organizations/${orgId}/reconciliation-runs${runStatus ? `?status=${runStatus}` : ""}`, {
          credentials: "include",
        }),
      ]);
      if (!detail.ok || !list.ok)
        throw new Error("Unable to load reconciliation runs.");
      const organization = (await detail.json()) as Org;
      setOrgs((current) =>
        current.map((item) => (item.id === orgId ? organization : item)),
      );
      setRuns((await list.json()) as Run[]);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to load reconciliation runs.",
      );
    }
  }, [orgId, runStatus]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  useEffect(() => {
    void Promise.resolve().then(loadRuns);
  }, [loadRuns]);
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch(
        `${api}/organizations/${orgId}/reconciliation-runs`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            legalEntityId: form.get("legalEntityId"),
            counterpartLegalEntityId: form.get("counterpartLegalEntityId"),
            name: form.get("name"),
            periodStart: form.get("periodStart"),
            periodEnd: form.get("periodEnd"),
            rulesVersion: "exact-reference-v1",
          }),
        },
      );
      const body = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!response.ok)
        throw new Error(body?.message ?? "Run could not be created.");
      setNotice(
        "Draft reconciliation run created. Queue it when imports are complete.",
      );
      formElement.reset();
      await loadRuns();
    } catch (cause) {
      setNotice(
        cause instanceof Error ? cause.message : "Run could not be created.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function queue(runId: string) {
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch(
        `${api}/organizations/${orgId}/reconciliation-runs/${runId}/queue`,
        { method: "POST", credentials: "include" },
      );
      const body = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!response.ok)
        throw new Error(body?.message ?? "Run could not be queued.");
      setNotice("Reconciliation run queued for durable processing.");
      await loadRuns();
    } catch (cause) {
      setNotice(
        cause instanceof Error ? cause.message : "Run could not be queued.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function cancel(runId: string) {
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch(
        `${api}/organizations/${orgId}/reconciliation-runs/${runId}/cancel`,
        { method: "POST", credentials: "include" },
      );
      const body = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!response.ok)
        throw new Error(body?.message ?? "Run could not be cancelled.");
      setNotice("Reconciliation run cancelled before execution.");
      await loadRuns();
    } catch (cause) {
      setNotice(
        cause instanceof Error ? cause.message : "Run could not be cancelled.",
      );
    } finally {
      setSaving(false);
    }
  }
  const entities =
    orgs
      .find((item) => item.id === orgId)
      ?.legalEntities?.filter((entity) => entity.isActive) ?? [];
  return (
    <main className="min-h-screen bg-[#f6f7f9] text-[#172033]">
      <header className="flex h-[73px] items-center justify-between border-b border-[#e4e7ec] bg-white px-5 sm:px-8">
        <Link href="/" className="font-semibold text-[#10243f]">
          LedgeRecon
        </Link>
        <Link href="/" className="text-sm font-medium text-[#2467bf]">
          ← Overview
        </Link>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-8">
        <p className="text-sm text-[#687386]">Reconciliation</p>
        <h1 className="mt-1 text-2xl font-semibold">Reconciliation runs</h1>
        <p className="mt-1 text-sm text-[#687386]">
          Create and queue controlled, two-sided exact-match runs over imported
          transactions.
        </p>
        <select
          aria-label="Organization"
          value={orgId}
          onChange={(event) => setOrgId(event.target.value)}
          className="mt-6 h-10 min-w-64 rounded-md border border-[#dce2ea] bg-white px-3 text-sm"
        >
          {orgs.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
        <label className="ml-3 inline-flex items-center gap-2 text-sm font-medium">Run status<select aria-label="Reconciliation run status" value={runStatus} onChange={(event) => setRunStatus(event.target.value)} className="h-10 rounded-md border border-[#dce2ea] bg-white px-3 font-normal"><option value="">All runs</option><option>DRAFT</option><option>QUEUED</option><option>PROCESSING</option><option>COMPLETED</option><option>COMPLETED_WITH_EXCEPTIONS</option><option>FAILED</option><option>CANCELLED</option></select></label>
        {error && (
          <p role="alert" className="mt-4 text-sm text-[#a53b2d]">
            {error}
          </p>
        )}
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
            <h2 className="font-semibold">New reconciliation run</h2>
            <label className="mt-4 block text-sm font-medium">
              Name
              <input
                required
                name="name"
                maxLength={200}
                className="mt-1 h-10 w-full rounded-md border border-[#d7dee8] px-3 font-normal"
              />
            </label>
            <label className="mt-4 block text-sm font-medium">
              Primary legal entity
              <select
                required
                name="legalEntityId"
                className="mt-1 h-10 w-full rounded-md border border-[#d7dee8] bg-white px-3 font-normal"
              >
                <option value="">Select entity</option>
                {entities.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.code} — {entity.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-4 block text-sm font-medium">
              Counterpart legal entity
              <select
                required
                name="counterpartLegalEntityId"
                className="mt-1 h-10 w-full rounded-md border border-[#d7dee8] bg-white px-3 font-normal"
              >
                <option value="">Select counterpart</option>
                {entities.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.code} — {entity.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-4 block text-sm font-medium">
              Period start
              <input
                required
                type="date"
                name="periodStart"
                className="mt-1 h-10 w-full rounded-md border border-[#d7dee8] px-3 font-normal"
              />
            </label>
            <label className="mt-4 block text-sm font-medium">
              Period end
              <input
                required
                type="date"
                name="periodEnd"
                className="mt-1 h-10 w-full rounded-md border border-[#d7dee8] px-3 font-normal"
              />
            </label>
            <button
              disabled={!orgId || entities.length < 2 || saving}
              className="mt-6 rounded-md bg-[#2369c8] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "Working…" : "Create draft run"}
            </button>
          </form>
          <section className="overflow-hidden rounded-lg border border-[#e2e6ec] bg-white shadow-sm">
            <div className="border-b border-[#edf0f4] px-5 py-4">
              <h2 className="font-semibold">Run history</h2>
            </div>
            {runs.length === 0 ? (
              <p className="p-8 text-center text-sm text-[#687386]">
                No reconciliation runs exist for this organization.
              </p>
            ) : (
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#fafbfd] text-xs uppercase text-[#687386]">
                  <tr>
                    <th className="px-5 py-3">Run</th>
                    <th className="px-5 py-3">Entities</th>
                    <th className="px-5 py-3">Period</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf0f4]">
                  {runs.map((run) => (
                    <tr key={run.id}>
                      <td className="px-5 py-4">
                        <Link
                          href={`/reconciliation/${run.id}?org=${orgId}`}
                          className="font-medium text-[#2467bf] hover:underline"
                        >
                          {run.name}
                        </Link>
                        <p className="text-xs text-[#687386]">
                          {run.rulesVersion} · {run._count.matches} match
                          {run._count.matches === 1 ? "" : "es"} ·{" "}
                          {run._count.exceptions} exception
                          {run._count.exceptions === 1 ? "" : "s"}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-[#526176]">
                        {run.legalEntity.code} ↔{" "}
                        {run.counterpartLegalEntity?.code ?? "Not set"}
                      </td>
                      <td className="px-5 py-4 text-[#526176]">
                        {run.periodStart.slice(0, 10)} —{" "}
                        {run.periodEnd.slice(0, 10)}
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-full bg-[#eef2f7] px-2 py-1 text-xs font-medium text-[#526176]">
                          {run.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          {(run.status === "DRAFT" ||
                            run.status === "FAILED") && (
                            <button
                              disabled={saving || !run.counterpartLegalEntity}
                              onClick={() => void queue(run.id)}
                              className="rounded-md border border-[#b9ccec] px-3 py-1.5 text-xs font-medium text-[#2467bf] disabled:opacity-50"
                            >
                              Queue
                            </button>
                          )}
                          {(run.status === "DRAFT" ||
                            run.status === "QUEUED") && (
                            <button
                              disabled={saving}
                              onClick={() => void cancel(run.id)}
                              className="rounded-md border border-[#e2c9c4] px-3 py-1.5 text-xs font-medium text-[#a53b2d] disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
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
