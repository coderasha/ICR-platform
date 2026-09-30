"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3003/api/v1";
type Org = { id: string; name: string };
type User = { id: string; permissions: string[] };
type Item = {
  id: string;
  exceptionType: string;
  severity: string;
  status: string;
  description: string;
  exposureAmount?: string | null;
  currencyCode?: string | null;
  dueAt?: string | null;
  assignedToUserId?: string | null;
  legalEntity: { code: string };
  reconciliationRun: { name: string };
};
type Note = {
  id: string;
  body: string;
  createdAt: string;
  author: { email: string } | null;
};
type Attachment = { id: string; originalFilename: string; contentType: string; sizeBytes: number; createdAt: string; uploadedBy: { email: string } | null };
export default function ExceptionsPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgId, setOrgId] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [notice, setNotice] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [working, setWorking] = useState("");
  const [noteItem, setNoteItem] = useState<Item | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const load = useCallback(async () => {
    const me = await fetch(`${api}/auth/me`, { credentials: "include" });
    if (me.status === 401) {
      router.push("/login");
      return;
    }
    if (!me.ok) throw new Error();
    setUser((await me.json()) as User);
    const response = await fetch(`${api}/organizations`, {
      credentials: "include",
    });
    if (!response.ok) throw new Error();
    const data = (await response.json()) as Org[];
    setOrgs(data);
    setOrgId((id) => id || data[0]?.id || "");
  }, [router]);
  const list = useCallback(async () => {
    if (!orgId) return;
    const query = new URLSearchParams({ ...(statusFilter && { status: statusFilter }), ...(severityFilter && { severity: severityFilter }), ...(mineOnly && { assignedToMe: "true" }), ...(overdueOnly && { overdue: "true" }) });
    const response = await fetch(`${api}/organizations/${orgId}/exceptions?${query}`, {
      credentials: "include",
    });
    if (!response.ok) {
      setNotice("Unable to load exceptions.");
      return;
    }
    setItems((await response.json()) as Item[]);
  }, [mineOnly, orgId, overdueOnly, severityFilter, statusFilter]);
  useEffect(() => {
    void Promise.resolve()
      .then(load)
      .catch(() => setNotice("Unable to load workspace."));
  }, [load]);
  useEffect(() => {
    void Promise.resolve().then(list);
  }, [list]);
  async function update(item: Item, body: Record<string, string | null>) {
    setWorking(item.id);
    const response = await fetch(
      `${api}/organizations/${orgId}/exceptions/${item.id}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const result = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    setNotice(
      response.ok
        ? `Exception ${body.status?.toLowerCase() ?? "assigned"}.`
        : (result?.message ?? "Exception could not be updated."),
    );
    if (response.ok) await list();
    setWorking("");
  }
  function setDueDate(item: Item) {
    const dueAt = window.prompt("Due date (YYYY-MM-DD). Leave blank to clear.", item.dueAt?.slice(0, 10) ?? "");
    if (dueAt === null) return;
    void update(item, { dueAt: dueAt.trim() || null });
  }
  async function exportCsv() {
    try {
      const response = await fetch(
        `${api}/organizations/${orgId}/reports/exceptions.csv`,
        { credentials: "include" },
      );
      if (!response.ok)
        throw new Error(
          response.status === 403
            ? "Your account does not have permission to export exceptions."
            : "Exception export could not be created.",
        );
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "icr-exceptions.csv";
      link.click();
      URL.revokeObjectURL(url);
      setNotice(
        response.headers.get("X-Export-Truncated") === "true"
          ? "Export downloaded; it was limited to the newest 10,000 records."
          : "Exception export downloaded.",
      );
    } catch (cause) {
      setNotice(
        cause instanceof Error
          ? cause.message
          : "Exception export could not be created.",
      );
    }
  }
  async function openNotes(item: Item) {
    setNoteItem(item);
    setNotes([]);
    setAttachments([]);
    const [response, attachmentResponse] = await Promise.all([fetch(
      `${api}/organizations/${orgId}/exceptions/${item.id}/notes`,
      { credentials: "include" },
    ), fetch(`${api}/organizations/${orgId}/exceptions/${item.id}/attachments`, { credentials: "include" })]);
    if (!response.ok) {
      setNotice("Unable to load exception notes.");
      return;
    }
    setNotes((await response.json()) as Note[]);
    if (attachmentResponse.ok) setAttachments((await attachmentResponse.json()) as Attachment[]);
    else setNotice("Unable to load exception evidence.");
  }
  async function addNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!noteItem) return;
    const form = new FormData(event.currentTarget);
    setWorking(noteItem.id);
    const response = await fetch(
      `${api}/organizations/${orgId}/exceptions/${noteItem.id}/notes`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: form.get("body") }),
      },
    );
    const result = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    if (!response.ok) setNotice(result?.message ?? "Note could not be added.");
    else {
      event.currentTarget.reset();
      await openNotes(noteItem);
    }
    setWorking("");
  }
  async function uploadAttachment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!noteItem) return;
    const file = new FormData(event.currentTarget).get("file");
    if (!(file instanceof File) || file.size > 5 * 1024 * 1024 || !["application/pdf", "image/jpeg", "image/png", "text/plain"].includes(file.type)) { setNotice("Select a PDF, JPEG, PNG, or text file no larger than 5 MB."); return; }
    setWorking(noteItem.id); try { const bytes = new Uint8Array(await file.arrayBuffer()); let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte); const response = await fetch(`${api}/organizations/${orgId}/exceptions/${noteItem.id}/attachments`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ originalFilename: file.name, contentType: file.type, contentBase64: btoa(binary) }) }); const result = await response.json().catch(() => null) as { message?: string } | null; if (!response.ok) throw new Error(result?.message ?? "Evidence could not be uploaded."); event.currentTarget.reset(); await openNotes(noteItem); setNotice("Evidence uploaded."); } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Evidence could not be uploaded."); } finally { setWorking(""); }
  }
  async function downloadAttachment(attachment: Attachment) {
    if (!noteItem) return; try { const response = await fetch(`${api}/organizations/${orgId}/exceptions/${noteItem.id}/attachments/${attachment.id}/download`, { credentials: "include" }); if (!response.ok) throw new Error("Evidence could not be downloaded."); const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a"); link.href = url; link.download = attachment.originalFilename; document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url); } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Evidence could not be downloaded."); }
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
        <p className="text-sm text-[#687386]">Investigation</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Exceptions</h1>
          <button
            disabled={!orgId}
            onClick={() => void exportCsv()}
            className="rounded-md border border-[#b9ccec] px-3 py-2 text-sm font-medium text-[#2467bf] disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
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
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-[#e2e6ec] bg-white p-3 shadow-sm">
          <label className="text-sm font-medium">Status<select aria-label="Exception status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="ml-2 h-9 rounded-md border border-[#dce2ea] bg-white px-2 font-normal"><option value="">All</option><option>OPEN</option><option>ASSIGNED</option><option>PROPOSED</option><option>APPROVED</option><option>RESOLVED</option></select></label>
          <label className="text-sm font-medium">Severity<select aria-label="Exception severity" value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)} className="ml-2 h-9 rounded-md border border-[#dce2ea] bg-white px-2 font-normal"><option value="">All</option><option>CRITICAL</option><option>HIGH</option><option>MEDIUM</option><option>LOW</option></select></label>
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={mineOnly} onChange={(event) => setMineOnly(event.target.checked)} /> Assigned to me</label>
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={overdueOnly} onChange={(event) => setOverdueOnly(event.target.checked)} /> Overdue</label>
          {(statusFilter || severityFilter || mineOnly || overdueOnly) && <button onClick={() => { setStatusFilter(""); setSeverityFilter(""); setMineOnly(false); setOverdueOnly(false); }} className="text-sm font-medium text-[#2467bf] hover:underline">Clear filters</button>}
        </div>
        <section className="mt-6 overflow-hidden rounded-lg border border-[#e2e6ec] bg-white shadow-sm">
          {items.length === 0 ? (
            <p className="p-10 text-center text-sm text-[#687386]">
              No exceptions require investigation in this organization.
            </p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#fafbfd] text-xs uppercase text-[#687386]">
                <tr>
                  <th className="px-4 py-3">Issue</th>
                  <th className="px-4 py-3">Exposure</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf0f4]">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-4">
                      <p className="font-medium">
                        {item.exceptionType} · {item.legalEntity.code}
                      </p>
                      <p className="mt-1 text-xs text-[#687386]">
                        {item.description}
                      </p>
                      <p className="mt-1 text-xs text-[#687386]">
                        Run: {item.reconciliationRun.name}
                      </p>
                      <p className={`mt-1 text-xs ${item.assignedToUserId ? "text-[#526176]" : "text-[#a53b2d]"}`}>{item.assignedToUserId === user?.id ? "Assigned to you" : item.assignedToUserId ? "Assigned" : "Unassigned"}</p>
                      {item.dueAt && <p className={`mt-1 text-xs ${item.status !== "RESOLVED" && new Date(item.dueAt) < new Date() ? "font-medium text-[#a53b2d]" : "text-[#687386]"}`}>Due {new Date(item.dueAt).toLocaleDateString()}{item.status !== "RESOLVED" && new Date(item.dueAt) < new Date() ? " · Overdue" : ""}</p>}
                    </td>
                    <td className="px-4 py-4 text-[#526176]">
                      {item.exposureAmount
                        ? `${item.currencyCode} ${item.exposureAmount}`
                        : "—"}
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-full bg-[#eef2f7] px-2 py-1 text-xs font-medium">
                        {item.severity} · {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => void openNotes(item)}
                          className="text-xs font-medium text-[#2467bf] hover:underline"
                        >
                          Notes
                        </button>
                        {user?.permissions.includes("exceptions:resolve") && <button disabled={working === item.id} onClick={() => setDueDate(item)} className="text-xs font-medium text-[#2467bf] hover:underline">{item.dueAt ? "Change due date" : "Set due date"}</button>}
                        {(item.status === "OPEN" ||
                          item.status === "ASSIGNED") &&
                          user?.permissions.includes("exceptions:resolve") && (
                            <>
                              <button
                                disabled={working === item.id}
                                onClick={() =>
                                  void update(item, {
                                    assignedToUserId: user.id,
                                    status: "ASSIGNED",
                                  })
                                }
                                className="text-xs font-medium text-[#2467bf] hover:underline"
                              >
                                Assign to me
                              </button>
                              <button
                                disabled={working === item.id}
                                onClick={() =>
                                  void update(item, { status: "PROPOSED" })
                                }
                                className="text-xs font-medium text-[#2467bf] hover:underline"
                              >
                                Propose
                              </button>
                            </>
                          )}
                        {item.status === "PROPOSED" &&
                          user?.permissions.includes("approvals:approve") && (
                            <button
                              disabled={working === item.id}
                              onClick={() =>
                                void update(item, { status: "APPROVED" })
                              }
                              className="text-xs font-medium text-[#2467bf] hover:underline"
                            >
                              Approve
                            </button>
                          )}
                        {item.status === "APPROVED" &&
                          user?.permissions.includes("exceptions:resolve") && (
                            <button
                              disabled={working === item.id}
                              onClick={() =>
                                void update(item, { status: "RESOLVED" })
                              }
                              className="text-xs font-medium text-[#2467bf] hover:underline"
                            >
                              Resolve
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
        {noteItem && (
          <section className="mt-6 rounded-lg border border-[#e2e6ec] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold">
                  Notes · {noteItem.exceptionType}
                </h2>
                <p className="mt-1 text-sm text-[#687386]">
                  {noteItem.legalEntity.code} ·{" "}
                  {noteItem.reconciliationRun.name}
                </p>
              </div>
              <button
                onClick={() => setNoteItem(null)}
                className="text-sm font-medium text-[#2467bf]"
              >
                Close
              </button>
            </div>
            <div className="mt-5 space-y-3">
              {notes.length === 0 ? (
                <p className="text-sm text-[#687386]">
                  No notes have been added yet.
                </p>
              ) : (
                notes.map((note) => (
                  <article
                    key={note.id}
                    className="rounded-md border border-[#edf0f4] p-3 text-sm"
                  >
                    <p>{note.body}</p>
                    <p className="mt-2 text-xs text-[#687386]">
                      {note.author?.email ?? "Unknown user"} ·{" "}
                      {new Date(note.createdAt).toLocaleString()}
                    </p>
                  </article>
                ))
              )}
            </div>
            <section className="mt-5 border-t border-[#edf0f4] pt-5">
              <h3 className="font-medium">Supporting evidence</h3>
              <p className="mt-1 text-sm text-[#687386]">PDF, JPEG, PNG, or text files up to 5 MB.</p>
              <div className="mt-3 space-y-2">
                {attachments.length === 0 ? <p className="text-sm text-[#687386]">No evidence has been attached.</p> : attachments.map((attachment) => <div key={attachment.id} className="flex items-center justify-between gap-3 rounded-md border border-[#edf0f4] p-3 text-sm"><span className="min-w-0"><strong className="block truncate">{attachment.originalFilename}</strong><span className="text-xs text-[#687386]">{Math.ceil(attachment.sizeBytes / 1024)} KB · {attachment.uploadedBy?.email ?? "Unknown user"}</span></span><button onClick={() => void downloadAttachment(attachment)} className="shrink-0 text-xs font-medium text-[#2467bf] hover:underline">Download</button></div>)}
              </div>
              {user?.permissions.includes("exceptions:resolve") && <form onSubmit={uploadAttachment} className="mt-4 flex flex-wrap items-end gap-3"><label className="block text-sm font-medium">Attach evidence<input required name="file" type="file" accept="application/pdf,image/jpeg,image/png,text/plain" className="mt-1 block text-sm font-normal" /></label><button disabled={working === noteItem.id} className="rounded-md border border-[#b9ccec] px-3 py-2 text-sm font-medium text-[#2467bf] disabled:opacity-50">Upload file</button></form>}
            </section>
            {user?.permissions.includes("exceptions:resolve") && (
              <form onSubmit={addNote} className="mt-5">
                <label className="block text-sm font-medium">
                  Add note
                  <textarea
                    required
                    name="body"
                    maxLength={1000}
                    rows={3}
                    className="mt-1 w-full rounded-md border border-[#d7dee8] p-3 font-normal"
                  />
                </label>
                <button
                  disabled={working === noteItem.id}
                  className="mt-3 rounded-md bg-[#2369c8] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  Add note
                </button>
              </form>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
