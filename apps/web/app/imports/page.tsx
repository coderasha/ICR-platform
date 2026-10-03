"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3003/api/v1";
function csvHeaders(line: string) { const headers: string[] = []; let value = ""; let quoted = false; for (let index = 0; index < line.length; index += 1) { const character = line[index]; if (quoted && character === '"' && line[index + 1] === '"') { value += '"'; index += 1; } else if (character === '"') quoted = !quoted; else if (character === "," && !quoted) { headers.push(value.trim()); value = ""; } else value += character; } headers.push(value.trim()); return headers.filter(Boolean).slice(0, 30); }
type MappingKey = "sourceRecordKey" | "documentReference" | "transactionDate" | "amount" | "currencyCode";
type ColumnMapping = Record<MappingKey, string>;
const defaultColumnMapping: ColumnMapping = { sourceRecordKey: "source_record_key", documentReference: "document_reference", transactionDate: "transaction_date", amount: "amount", currencyCode: "currency_code" };
const headerAliases: Record<MappingKey, string[]> = {
  sourceRecordKey: ["source_record_key", "source_record_id", "transaction_id", "transaction_key", "journal_id", "journal_key", "entry_id", "record_id"],
  documentReference: ["document_reference", "document_ref", "invoice_number", "invoice_no", "invoice_id", "reference", "reference_number", "document_number", "document_no"],
  transactionDate: ["transaction_date", "posting_date", "document_date", "entry_date", "date"],
  amount: ["amount", "transaction_amount", "local_amount", "net_amount", "value"],
  currencyCode: ["currency_code", "currency", "currency_code_iso", "currency_iso"],
};
function normalizedHeader(value: string) { return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""); }
function detectColumnMapping(headers: string[]): ColumnMapping { const detected = { ...defaultColumnMapping }; for (const key of Object.keys(headerAliases) as MappingKey[]) { const header = headers.find((item) => headerAliases[key].includes(normalizedHeader(item))); if (header) detected[key] = header; } return detected; }
type Entity = { id: string; code: string; name: string; isActive: boolean };
type Org = { id: string; name: string; legalEntities?: Entity[] };
type Batch = {
  id: string;
  originalFilename: string;
  status: string;
  totalRows: number;
  validRows: number;
  rejectedRows: number;
  importedRows: number;
  failureReason?: string | null;
  legalEntity: Entity;
  sourceSystem?: { code: string; name: string } | null;
};
type ImportRow = {
  id: string;
  rowNumber: number;
  status: string;
  rawData: Record<string, unknown>;
  errors?: unknown;
};
type SourceSystem = {
  id: string;
  code: string;
  name: string;
  systemType: string;
  isActive: boolean;
};

export default function ImportsPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgId, setOrgId] = useState("");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [sources, setSources] = useState<SourceSystem[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [queueing, setQueueing] = useState("");
  const [review, setReview] = useState<Batch | null>(null);
  const [rejectedRows, setRejectedRows] = useState<ImportRow[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [sourceHeaders, setSourceHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>(defaultColumnMapping);
  const [batchStatus, setBatchStatus] = useState("");
  const load = useCallback(async () => {
    const me = await fetch(`${api}/auth/me`, { credentials: "include" });
    if (me.status === 401) {
      router.push("/login");
      return;
    }
    const response = await fetch(`${api}/organizations`, {
      credentials: "include",
    });
    if (!response.ok) throw new Error();
    const data = (await response.json()) as Org[];
    setOrgs(data);
    setOrgId((value) => value || data[0]?.id || "");
  }, [router]);
  const loadBatches = useCallback(async () => {
    if (!orgId) return;
    const [detail, response, sourceResponse] = await Promise.all([
      fetch(`${api}/organizations/${orgId}`, { credentials: "include" }),
      fetch(`${api}/organizations/${orgId}/imports${batchStatus ? `?status=${batchStatus}` : ""}`, {
        credentials: "include",
      }),
      fetch(`${api}/organizations/${orgId}/source-systems`, {
        credentials: "include",
      }),
    ]);
    if (!detail.ok || !response.ok || !sourceResponse.ok) {
      setNotice("Unable to load import history.");
      return;
    }
    const org = (await detail.json()) as Org;
    setOrgs((items) => items.map((item) => (item.id === orgId ? org : item)));
    setBatches((await response.json()) as Batch[]);
    setSources((await sourceResponse.json()) as SourceSystem[]);
  }, [batchStatus, orgId]);
  useEffect(() => {
    void Promise.resolve()
      .then(load)
      .catch(() => setNotice("Unable to load workspace."));
  }, [load]);
  useEffect(() => {
    void Promise.resolve().then(loadBatches);
  }, [loadBatches]);
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const file = form.get("file");
    const isXlsx = file instanceof File && file.name.toLowerCase().endsWith(".xlsx");
    const isCsv = file instanceof File && file.name.toLowerCase().endsWith(".csv");
    if (!(file instanceof File) || (!isCsv && !isXlsx) || file.size > 10 * 1024 * 1024) {
      setNotice("Select a CSV or Excel (.xlsx) file no larger than 10 MB.");
      return;
    }
    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      const response = await fetch(
        `${api}/organizations/${orgId}/imports/upload`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            legalEntityId: form.get("legalEntityId"),
            sourceSystemId: form.get("sourceSystemId") || undefined,
            idempotencyKey: crypto.randomUUID(),
            originalFilename: file.name,
            fileType: isXlsx ? "XLSX" : "CSV",
            columnMapping,
            contentBase64: btoa(binary),
          }),
        },
      );
      const body = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!response.ok)
        throw new Error(body?.message ?? "Upload could not be staged.");
      setNotice("CSV staged. Queue it when ready for validation.");
      formElement.reset();
      setSourceHeaders([]);
      await loadBatches();
    } catch (cause) {
      setNotice(
        cause instanceof Error ? cause.message : "Upload could not be staged.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function previewHeaders(file: File | undefined) {
    if (!file) { setSourceHeaders([]); setColumnMapping(defaultColumnMapping); return; }
    try {
      let headers: string[];
      if (file.name.toLowerCase().endsWith(".xlsx")) {
        const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const sheet = workbook.SheetNames[0];
        headers = sheet ? ((XLSX.utils.sheet_to_json(workbook.Sheets[sheet], { header: 1, blankrows: false })[0] as unknown[] | undefined)?.map((value) => String(value).trim()).filter(Boolean).slice(0, 30) ?? []) : [];
      } else headers = csvHeaders((await file.slice(0, 32_768).text()).split(/\r?\n/, 1)[0] ?? "");
      setSourceHeaders(headers);
      setColumnMapping(detectColumnMapping(headers));
    } catch { setSourceHeaders([]); setColumnMapping(defaultColumnMapping); setNotice("We could not read the file headers. You can still enter the column names manually."); }
  }
  async function createSource(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const response = await fetch(
        `${api}/organizations/${orgId}/source-systems`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: form.get("code"),
            name: form.get("name"),
            systemType: form.get("systemType"),
          }),
        },
      );
      const body = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!response.ok)
        throw new Error(body?.message ?? "Source system could not be created.");
      setNotice("Source system created.");
      event.currentTarget.reset();
      await loadBatches();
    } catch (cause) {
      setNotice(
        cause instanceof Error
          ? cause.message
          : "Source system could not be created.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function queue(batch: Batch) {
    setQueueing(batch.id);
    try {
      const response = await fetch(
        `${api}/organizations/${orgId}/imports/${batch.id}/queue`,
        { method: "POST", credentials: "include" },
      );
      const body = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!response.ok)
        throw new Error(body?.message ?? "Batch could not be queued.");
      setNotice(`${batch.originalFilename} queued for validation.`);
      await loadBatches();
    } catch (cause) {
      setNotice(
        cause instanceof Error ? cause.message : "Batch could not be queued.",
      );
    } finally {
      setQueueing("");
    }
  }
  async function cancel(batch: Batch) {
    if (!window.confirm(`Cancel ${batch.originalFilename}? It will not be processed.`)) return;
    setQueueing(batch.id);
    try {
      const response = await fetch(`${api}/organizations/${orgId}/imports/${batch.id}/cancel`, { method: "POST", credentials: "include" });
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(body?.message ?? "Batch could not be cancelled.");
      setNotice(`${batch.originalFilename} was cancelled.`); await loadBatches();
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Batch could not be cancelled."); }
    finally { setQueueing(""); }
  }
  async function reviewRejected(batch: Batch) {
    setReview(batch);
    setRejectedRows([]);
    try {
      const response = await fetch(
        `${api}/organizations/${orgId}/imports/${batch.id}/rows?status=REJECTED&limit=100`,
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Unable to load rejected rows.");
      const body = (await response.json()) as { items: ImportRow[] };
      setRejectedRows(body.items);
    } catch (cause) {
      setNotice(
        cause instanceof Error
          ? cause.message
          : "Unable to load rejected rows.",
      );
    }
  }
  async function downloadRejectedRows() {
    if (!review) return;
    setDownloading(true);
    try {
      const response = await fetch(
        `${api}/organizations/${orgId}/imports/${review.id}/rejected-rows.csv`,
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Unable to download rejected rows.");
      const blob = await response.blob();
      const name = review.originalFilename.replace(/\.csv$/i, "") || "import";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${name}-rejected-rows.csv`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      if (response.headers.get("X-Export-Truncated") === "true")
        setNotice(
          "Rejected-row export downloaded and limited to the first 10,000 rows.",
        );
    } catch (cause) {
      setNotice(
        cause instanceof Error
          ? cause.message
          : "Unable to download rejected rows.",
      );
    } finally {
      setDownloading(false);
    }
  }
  const entities =
    orgs
      .find((item) => item.id === orgId)
      ?.legalEntities?.filter((item) => item.isActive) ?? [];
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
        <p className="text-sm text-[#687386]">Data management</p>
        <h1 className="mt-1 text-2xl font-semibold">Import history</h1>
        <select
          aria-label="Organization"
          className="mt-5 h-10 min-w-64 rounded-md border border-[#dce2ea] bg-white px-3"
          value={orgId}
          onChange={(event) => setOrgId(event.target.value)}
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
        <label className="mt-5 inline-flex items-center gap-2 text-sm font-medium">Batch status<select aria-label="Import batch status" value={batchStatus} onChange={(event) => setBatchStatus(event.target.value)} className="h-10 rounded-md border border-[#dce2ea] bg-white px-3 font-normal"><option value="">All batches</option><option>DRAFT</option><option>QUEUED</option><option>PROCESSING</option><option>COMPLETED</option><option>COMPLETED_WITH_ERRORS</option><option>FAILED</option><option>CANCELLED</option></select></label>
        <section className="mt-6 grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
          <form
            onSubmit={upload}
            className="rounded-lg border border-[#e2e6ec] bg-white p-5 shadow-sm"
          >
            <h2 className="font-semibold">Stage transaction import</h2>
            <p className="mt-1 text-sm text-[#687386]">
              CSV or Excel (.xlsx), maximum 10 MB. Uploading is not importing.
            </p>
            <label className="mt-4 block text-sm font-medium">
              Legal entity
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
              Source system
              <select
                name="sourceSystemId"
                className="mt-1 h-10 w-full rounded-md border border-[#d7dee8] bg-white px-3 font-normal"
              >
                <option value="">Unspecified source</option>
                {sources
                  .filter((source) => source.isActive)
                  .map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.code} — {source.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="mt-4 block text-sm font-medium">
              CSV or Excel file
              <input
                required
                accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                name="file"
                type="file"
                onChange={(event) => void previewHeaders(event.target.files?.[0])}
                className="mt-1 block w-full text-sm font-normal"
              />
            </label>
            {sourceHeaders.length > 0 && <p className="mt-2 text-xs text-[#526176]">Detected headers: {sourceHeaders.join(", ")}. Matching columns were mapped automatically.</p>}
            <details className="mt-4 rounded-md border border-[#e2e6ec] p-3">
              <summary className="cursor-pointer text-sm font-medium">Review detected mapping</summary>
              <p className="mt-1 text-xs text-[#687386]">The mapping is detected from the file&apos;s headers and saved with this batch. Change it only if a detected field is incorrect.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="text-xs font-medium">Source record key<input required name="sourceRecordKey" value={columnMapping.sourceRecordKey} onChange={(event) => setColumnMapping((current) => ({ ...current, sourceRecordKey: event.target.value }))} maxLength={100} className="mt-1 h-9 w-full rounded-md border border-[#d7dee8] px-2 font-normal" /></label>
                <label className="text-xs font-medium">Document reference<input name="documentReference" value={columnMapping.documentReference} onChange={(event) => setColumnMapping((current) => ({ ...current, documentReference: event.target.value }))} maxLength={100} className="mt-1 h-9 w-full rounded-md border border-[#d7dee8] px-2 font-normal" /></label>
                <label className="text-xs font-medium">Transaction date<input required name="transactionDate" value={columnMapping.transactionDate} onChange={(event) => setColumnMapping((current) => ({ ...current, transactionDate: event.target.value }))} maxLength={100} className="mt-1 h-9 w-full rounded-md border border-[#d7dee8] px-2 font-normal" /></label>
                <label className="text-xs font-medium">Amount<input required name="amount" value={columnMapping.amount} onChange={(event) => setColumnMapping((current) => ({ ...current, amount: event.target.value }))} maxLength={100} className="mt-1 h-9 w-full rounded-md border border-[#d7dee8] px-2 font-normal" /></label>
                <label className="text-xs font-medium">Currency code<input required name="currencyCode" value={columnMapping.currencyCode} onChange={(event) => setColumnMapping((current) => ({ ...current, currencyCode: event.target.value }))} maxLength={100} className="mt-1 h-9 w-full rounded-md border border-[#d7dee8] px-2 font-normal" /></label>
              </div>
            </details>
            <button
              disabled={busy || !entities.length}
              className="mt-6 rounded-md bg-[#2369c8] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "Staging…" : "Stage import"}
            </button>
          </form>
          <section className="overflow-hidden rounded-lg border border-[#e2e6ec] bg-white shadow-sm">
            <div className="border-b border-[#edf0f4] px-5 py-4">
              <h2 className="font-semibold">Recent batches</h2>
            </div>
            {batches.length === 0 ? (
              <p className="p-8 text-center text-sm text-[#687386]">
                No imports have been staged.
              </p>
            ) : (
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#fafbfd] text-xs uppercase text-[#687386]">
                  <tr>
                    <th className="px-4 py-3">File</th>
                    <th className="px-4 py-3">Rows</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf0f4]">
                  {batches.map((batch) => (
                    <tr key={batch.id}>
                      <td className="px-4 py-4">
                        <p className="font-medium">{batch.originalFilename}</p>
                        <p className="text-xs text-[#687386]">
                          {batch.legalEntity.code} · {batch.importedRows}/
                          {batch.totalRows} imported
                        </p>
                        <p className="mt-1 text-xs text-[#687386]">Source: {batch.sourceSystem ? `${batch.sourceSystem.code} — ${batch.sourceSystem.name}` : "Unspecified"}</p>
                        {batch.failureReason && (
                          <p className="mt-1 text-xs text-[#a53b2d]">
                            {batch.failureReason}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-[#526176]">
                        {batch.validRows} valid
                        <br />
                        {batch.rejectedRows} rejected
                      </td>
                      <td className="px-4 py-4">
                        <span className="rounded-full bg-[#eef2f7] px-2 py-1 text-xs font-medium">
                          {batch.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-2">
                          {(batch.status === "DRAFT" ||
                            batch.status === "FAILED") && (
                            <button
                              disabled={queueing === batch.id}
                              onClick={() => void queue(batch)}
                              className="text-left text-sm font-medium text-[#2467bf] hover:underline disabled:opacity-50"
                            >
                              {queueing === batch.id ? "Queueing…" : "Queue"}
                            </button>
                          )}
                          {(batch.status === "DRAFT" || batch.status === "QUEUED") && (
                            <button
                              disabled={queueing === batch.id}
                              onClick={() => void cancel(batch)}
                              className="text-left text-sm font-medium text-[#a53b2d] hover:underline disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          )}
                          {batch.rejectedRows > 0 && (
                            <button
                              onClick={() => void reviewRejected(batch)}
                              className="text-left text-sm font-medium text-[#2467bf] hover:underline"
                            >
                              Review rejected
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
        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_.9fr]">
          <div className="rounded-lg border border-[#e2e6ec] bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Source systems</h2>
            <p className="mt-1 text-sm text-[#687386]">
              Active systems are available when staging an import.
            </p>
            <div className="mt-4 divide-y divide-[#edf0f4]">
              {sources.length === 0 ? (
                <p className="py-3 text-sm text-[#687386]">
                  No source systems configured.
                </p>
              ) : (
                sources.map((source) => (
                  <div
                    key={source.id}
                    className="flex justify-between gap-3 py-3 text-sm"
                  >
                    <span>
                      <strong>{source.code}</strong> · {source.name}
                    </span>
                    <span className="text-[#687386]">{source.systemType}</span>
                  </div>
                ))
              )}
            </div>
          </div>
          <form
            onSubmit={createSource}
            className="rounded-lg border border-[#e2e6ec] bg-white p-5 shadow-sm"
          >
            <h2 className="font-semibold">Add source system</h2>
            <label className="mt-4 block text-sm font-medium">
              Code
              <input
                required
                name="code"
                maxLength={50}
                pattern="[A-Za-z0-9_-]+"
                className="mt-1 h-10 w-full rounded-md border border-[#d7dee8] px-3 font-normal"
              />
            </label>
            <label className="mt-3 block text-sm font-medium">
              Name
              <input
                required
                name="name"
                maxLength={200}
                className="mt-1 h-10 w-full rounded-md border border-[#d7dee8] px-3 font-normal"
              />
            </label>
            <label className="mt-3 block text-sm font-medium">
              Type
              <input
                required
                name="systemType"
                maxLength={80}
                placeholder="ERP, ledger, billing…"
                className="mt-1 h-10 w-full rounded-md border border-[#d7dee8] px-3 font-normal"
              />
            </label>
            <button
              disabled={busy || !orgId}
              className="mt-5 rounded-md border border-[#b9ccec] px-3 py-2 text-sm font-medium text-[#2467bf] disabled:opacity-50"
            >
              Add source system
            </button>
          </form>
        </section>
        {review && (
          <section className="mt-6 overflow-hidden rounded-lg border border-[#e2e6ec] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#edf0f4] px-5 py-4">
              <div>
                <h2 className="font-semibold">
                  Rejected rows · {review.originalFilename}
                </h2>
                <p className="mt-1 text-sm text-[#687386]">
                  Showing up to 100 rejected rows and their validation errors.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <button
                  disabled={downloading}
                  onClick={() => void downloadRejectedRows()}
                  className="text-sm font-medium text-[#2467bf] disabled:opacity-50"
                >
                  {downloading ? "Preparing export…" : "Download CSV"}
                </button>
                <button
                  onClick={() => setReview(null)}
                  className="text-sm font-medium text-[#2467bf]"
                >
                  Close
                </button>
              </div>
            </div>
            {rejectedRows.length === 0 ? (
              <p className="p-6 text-sm text-[#687386]">
                Loading rejected rows, or none are available.
              </p>
            ) : (
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#fafbfd] text-xs uppercase text-[#687386]">
                  <tr>
                    <th className="px-5 py-3">Row</th>
                    <th className="px-5 py-3">Errors</th>
                    <th className="px-5 py-3">Input</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf0f4]">
                  {rejectedRows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-5 py-4 font-medium">{row.rowNumber}</td>
                      <td className="max-w-sm px-5 py-4 text-xs text-[#a53b2d]">
                        {JSON.stringify(row.errors ?? [])}
                      </td>
                      <td className="max-w-sm px-5 py-4 text-xs text-[#526176]">
                        {JSON.stringify(row.rawData)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
