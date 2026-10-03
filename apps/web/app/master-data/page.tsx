"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3003/api/v1";
type Organization = { id: string; name: string; code: string };
type Entity = { id: string; organizationId: string; name: string; code: string; currencyCode: string; isActive: boolean };
type RecordItem = { id: string; organizationId: string; code?: string; name: string; isActive: boolean; currencyCode?: string | null; accountType?: string; legalEntity?: Entity; sourceLegalEntity?: Entity; targetLegalEntity?: Entity; effectiveFrom?: string; effectiveTo?: string | null };
type Tab = "legal-entities" | "counterparties" | "accounts" | "relationships";
const tabs: { id: Tab; label: string; singular: string }[] = [{ id: "legal-entities", label: "Legal entities", singular: "legal entity" }, { id: "counterparties", label: "Counterparties", singular: "counterparty" }, { id: "accounts", label: "Accounts", singular: "account" }, { id: "relationships", label: "Relationships", singular: "relationship" }];

export default function MasterDataPage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [entities, setEntities] = useState<Entity[]>([]);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [tab, setTab] = useState<Tab>("counterparties");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadOrganizations = useCallback(async () => {
    const me = await fetch(`${apiBase}/auth/me`, { credentials: "include" });
    if (me.status === 401) { router.push("/login"); return; }
    if (!me.ok) throw new Error("We could not verify your session.");
    const response = await fetch(`${apiBase}/organizations`, { credentials: "include" });
    if (!response.ok) throw new Error("We could not load your authorized organizations.");
    const data = await response.json() as Organization[];
    setOrganizations(data); setOrganizationId((current) => current || data[0]?.id || "");
  }, [router]);
  const loadRecords = useCallback(async () => {
    if (!organizationId) { setRecords([]); setEntities([]); return; }
    setLoading(true); setError("");
    try {
      const detail = await fetch(`${apiBase}/organizations/${organizationId}`, { credentials: "include" });
      if (!detail.ok) throw new Error("We could not load master data for the selected organization.");
      const organization = await detail.json() as { legalEntities: Entity[] };
      setEntities(organization.legalEntities);
      if (tab === "legal-entities") { setRecords(organization.legalEntities); return; }
      const list = await fetch(`${apiBase}/organizations/${organizationId}/master-data/${tab}`, { credentials: "include" });
      if (!list.ok) throw new Error("We could not load master data for the selected organization.");
      setRecords(await list.json() as RecordItem[]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load master data."); }
    finally { setLoading(false); }
  }, [organizationId, tab]);
  useEffect(() => { void Promise.resolve().then(loadOrganizations).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load workspace.")); }, [loadOrganizations]);
  useEffect(() => { void Promise.resolve().then(loadRecords); }, [loadRecords]);

  async function createRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!organizationId) return;
    const form = new FormData(event.currentTarget); setSubmitting(true); setNotice("");
    const body = tab === "legal-entities" ? { code: form.get("code"), name: form.get("name"), currencyCode: form.get("currencyCode") || undefined } : tab === "relationships" ? { sourceLegalEntityId: form.get("sourceLegalEntityId"), targetLegalEntityId: form.get("targetLegalEntityId"), name: form.get("name"), effectiveFrom: form.get("effectiveFrom") || undefined } : tab === "accounts" ? { legalEntityId: form.get("legalEntityId"), code: form.get("code"), name: form.get("name"), accountType: form.get("accountType"), currencyCode: form.get("currencyCode") || undefined } : { legalEntityId: form.get("legalEntityId"), code: form.get("code"), name: form.get("name"), countryCode: form.get("countryCode") || undefined, currencyCode: form.get("currencyCode") || undefined };
    try {
      const path = tab === "legal-entities" ? "legal-entities" : `master-data/${tab}`;
      const response = await fetch(`${apiBase}/organizations/${organizationId}/${path}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) throw new Error(result?.message ?? `The ${tabs.find((item) => item.id === tab)?.singular} could not be created.`);
      setShowCreate(false); setNotice(`${tabs.find((item) => item.id === tab)?.singular} created successfully.`); await loadRecords();
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "The record could not be created."); }
    finally { setSubmitting(false); }
  }
  const activeTab = tabs.find((item) => item.id === tab)!;
  return <main className="min-h-screen bg-[#f6f7f9] text-[#172033]"><header className="flex h-[73px] items-center justify-between border-b border-[#e4e7ec] bg-white px-5 sm:px-8"><div className="flex items-center gap-3"><Link href="/" className="grid h-8 w-8 place-items-center rounded-lg bg-[#4f8fe8] text-sm font-bold text-white">L</Link><span className="hidden text-base font-semibold text-[#10243f] sm:block">LedgeRecon</span><span className="text-[#a5adba]">/</span><span className="text-xs font-medium text-[#526176]">Master data</span></div><Link href="/" className="text-sm font-medium text-[#2467bf]">← Overview</Link></header><div className="mx-auto max-w-[1320px] px-5 py-7 sm:px-8"><div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="text-sm text-[#687386]">Administration</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Master data</h1><p className="mt-1 text-sm text-[#687386]">Maintain the controlled entity, account, and counterparty records used in reconciliation.</p></div><select aria-label="Organization" value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} className="h-10 min-w-64 rounded-md border border-[#dce2ea] bg-white px-3 text-sm shadow-sm"><option value="">Select an organization</option>{organizations.map((organization) => <option value={organization.id} key={organization.id}>{organization.name}</option>)}</select></div>{notice && <div role="status" className="mt-5 rounded-md border border-[#bfd7fb] bg-[#edf5ff] px-4 py-3 text-sm text-[#245ca8]">{notice}</div>}{error && <div role="alert" className="mt-5 rounded-md border border-[#f1c3bd] bg-[#fff5f3] px-4 py-3 text-sm text-[#a53b2d]">{error}</div>}<section className="mt-7 rounded-lg border border-[#e2e6ec] bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-[#edf0f4] px-5 pt-4 sm:flex-row sm:items-center sm:justify-between"><div role="tablist" aria-label="Master data type" className="flex gap-5">{tabs.map((item) => <button role="tab" aria-selected={tab === item.id} onClick={() => { setTab(item.id); setShowCreate(false); }} key={item.id} className={`border-b-2 pb-3 text-sm font-medium ${tab === item.id ? "border-[#2369c8] text-[#2467bf]" : "border-transparent text-[#687386] hover:text-[#172033]"}`}>{item.label}</button>)}</div><button disabled={!organizationId || (tab !== "legal-entities" && entities.length === 0)} onClick={() => setShowCreate(true)} className="mb-3 rounded-md bg-[#2369c8] px-3.5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">+ New {activeTab.singular}</button></div><div className="overflow-x-auto">{loading ? <div className="p-8 text-sm text-[#687386]">Loading {activeTab.label.toLowerCase()}…</div> : !organizationId ? <Empty title="Select an organization" body="Choose an organization to view its controlled master data." /> : records.length === 0 ? <Empty title={`No ${activeTab.label.toLowerCase()} yet`} body={`Create the first ${activeTab.singular} for this organization to establish the reconciliation scope.`} /> : <DataTable records={records} tab={tab} />}</div></section></div>{showCreate && <CreateDialog tab={tab} entities={entities} submitting={submitting} onClose={() => setShowCreate(false)} onSubmit={createRecord} />}</main>;
}
function DataTable({ records, tab }: { records: RecordItem[]; tab: Tab }) {
  const [pending, setPending] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, boolean>>({});
  async function toggle(record: RecordItem) {
    setPending(record.id);
    try {
      const path = tab === "legal-entities" ? `legal-entities/${record.id}` : `master-data/${tab}/${record.id}`;
      const response = await fetch(`${apiBase}/organizations/${record.organizationId}/${path}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !(status[record.id] ?? record.isActive) }) });
      if (!response.ok) throw new Error("Status update failed");
      setStatus((current) => ({ ...current, [record.id]: !(current[record.id] ?? record.isActive) }));
    } catch { /* Preserve the displayed state when the API rejects the change. */ } finally { setPending(null); }
  }
  if (tab === "legal-entities") return <table className="min-w-full text-left text-sm"><thead className="bg-[#fafbfd] text-xs font-semibold uppercase tracking-wide text-[#687386]"><tr><th className="px-5 py-3">Code</th><th className="px-5 py-3">Name</th><th className="px-5 py-3">Currency</th><th className="px-5 py-3">Status</th><th className="px-5 py-3"><span className="sr-only">Actions</span></th></tr></thead><tbody className="divide-y divide-[#edf0f4]">{records.map((record) => { const active = status[record.id] ?? record.isActive; return <tr key={record.id}><td className="px-5 py-4 font-medium">{record.code}</td><td className="px-5 py-4">{record.name}</td><td className="px-5 py-4 text-[#526176]">{record.currencyCode}</td><td className="px-5 py-4"><span className={`rounded-full px-2 py-1 text-xs font-medium ${active ? "bg-[#e9f7f1] text-[#187458]" : "bg-[#f3f4f6] text-[#687386]"}`}>{active ? "Active" : "Inactive"}</span></td><td className="px-5 py-4 text-right"><button disabled={pending === record.id} onClick={() => void toggle(record)} className="text-sm font-medium text-[#2467bf] hover:underline disabled:opacity-50">{pending === record.id ? "Updating…" : active ? "Deactivate" : "Reactivate"}</button></td></tr>; })}</tbody></table>;
  return <table className="min-w-full text-left text-sm"><thead className="bg-[#fafbfd] text-xs font-semibold uppercase tracking-wide text-[#687386]"><tr>{tab !== "relationships" && <th className="px-5 py-3">Code</th>}<th className="px-5 py-3">Name</th><th className="px-5 py-3">Legal entity</th>{tab === "accounts" && <th className="px-5 py-3">Type</th>}{tab === "relationships" && <th className="px-5 py-3">Effective from</th>}<th className="px-5 py-3">Status</th><th className="px-5 py-3"><span className="sr-only">Actions</span></th></tr></thead><tbody className="divide-y divide-[#edf0f4]">{records.map((record) => { const active = status[record.id] ?? record.isActive; return <tr key={record.id}><td className="px-5 py-4 font-medium">{record.code ?? record.name}</td>{tab !== "relationships" && <td className="px-5 py-4">{record.name}</td>}<td className="px-5 py-4 text-[#526176]">{record.legalEntity?.code ?? `${record.sourceLegalEntity?.code} → ${record.targetLegalEntity?.code}`}</td>{tab === "accounts" && <td className="px-5 py-4 text-[#526176]">{record.accountType}</td>}{tab === "relationships" && <td className="px-5 py-4 text-[#526176]">{record.effectiveFrom ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(record.effectiveFrom)) : "—"}</td>}<td className="px-5 py-4"><span className={`rounded-full px-2 py-1 text-xs font-medium ${active ? "bg-[#e9f7f1] text-[#187458]" : "bg-[#f3f4f6] text-[#687386]"}`}>{active ? "Active" : "Inactive"}</span></td><td className="px-5 py-4 text-right"><button disabled={pending === record.id} onClick={() => void toggle(record)} className="text-sm font-medium text-[#2467bf] hover:underline disabled:opacity-50">{pending === record.id ? "Updating…" : active ? "Deactivate" : "Reactivate"}</button></td></tr>; })}</tbody></table>;
}
function Empty({ title, body }: { title: string; body: string }) { return <div className="p-12 text-center"><div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-[#eef4fc] text-[#2467bf]">◇</div><h2 className="font-medium">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#687386]">{body}</p></div>; }
function CreateDialog({ tab, entities, submitting, onClose, onSubmit }: { tab: Tab; entities: Entity[]; submitting: boolean; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) { const label = tabs.find((item) => item.id === tab)!.singular; return <div role="dialog" aria-modal="true" aria-labelledby="create-title" className="fixed inset-0 z-10 grid place-items-center bg-[#10243f]/35 p-4"><form onSubmit={onSubmit} className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl"><div className="flex items-start justify-between"><div><h2 id="create-title" className="text-lg font-semibold">New {label}</h2><p className="mt-1 text-sm text-[#687386]">Records are immediately scoped to the selected organization.</p></div><button type="button" onClick={onClose} aria-label="Close" className="text-xl text-[#687386]">×</button></div>{tab === "legal-entities" ? <><Field name="code" label="Entity code" pattern="[A-Za-z0-9_-]+" /><Field name="name" label="Legal entity name" /><CurrencySelect /></> : tab === "relationships" ? <><Field name="name" label="Relationship name" /><Select name="sourceLegalEntityId" label="Source legal entity" entities={entities} /><Select name="targetLegalEntityId" label="Target legal entity" entities={entities} /><label className="mt-4 block text-sm font-medium">Effective from<input name="effectiveFrom" type="date" className="mt-1.5 h-10 w-full rounded-md border border-[#d7dee8] px-3 font-normal" /></label></> : <><Select name="legalEntityId" label="Legal entity" entities={entities} /><Field name="code" label="Code" pattern="[A-Za-z0-9_-]+" /><Field name="name" label="Name" />{tab === "accounts" ? <label className="mt-4 block text-sm font-medium">Account type<select required name="accountType" className="mt-1.5 h-10 w-full rounded-md border border-[#d7dee8] bg-white px-3 font-normal"><option value="">Select type</option>{["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE", "OTHER"].map((type) => <option key={type}>{type}</option>)}</select></label> : <label className="mt-4 block text-sm font-medium">Country code <span className="font-normal text-[#687386]">(optional)</span><input name="countryCode" maxLength={2} pattern="[A-Z]{2}" className="mt-1.5 h-10 w-full rounded-md border border-[#d7dee8] px-3 font-normal uppercase" /></label>}<CurrencySelect /></>}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-sm font-medium text-[#526176]">Cancel</button><button disabled={submitting} className="rounded-md bg-[#2369c8] px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{submitting ? "Creating…" : `Create ${label}`}</button></div></form></div>; }
function CurrencySelect() { return <label className="mt-4 block text-sm font-medium">Currency <span className="font-normal text-[#687386]">(optional)</span><select name="currencyCode" className="mt-1.5 h-10 w-full rounded-md border border-[#d7dee8] bg-white px-3 font-normal"><option value="">Not specified</option>{["INR", "USD", "EUR", "GBP", "SGD", "AED"].map((currency) => <option key={currency}>{currency}</option>)}</select></label>; }
function Field({ name, label, pattern }: { name: string; label: string; pattern?: string }) { return <label className="mt-4 block text-sm font-medium">{label}<input required name={name} pattern={pattern} maxLength={name === "code" ? 50 : 200} className="mt-1.5 h-10 w-full rounded-md border border-[#d7dee8] px-3 font-normal" /></label>; }
function Select({ name, label, entities }: { name: string; label: string; entities: Entity[] }) { return <label className="mt-4 block text-sm font-medium">{label}<select required name={name} className="mt-1.5 h-10 w-full rounded-md border border-[#d7dee8] bg-white px-3 font-normal"><option value="">Select legal entity</option>{entities.map((entity) => <option value={entity.id} key={entity.id}>{entity.code} — {entity.name}</option>)}</select></label>; }
