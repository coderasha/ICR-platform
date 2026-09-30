"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3003/api/v1";
type Org = { id: string; name: string };
type Transaction = {
  id: string;
  documentReference: string | null;
  transactionDate: string;
  amount: string;
  currencyCode: string;
  status: string;
  legalEntity: { code: string };
};
type Result = {
  items: Transaction[];
  page: number;
  pageSize: number;
  total: number;
};
export default function TransactionsPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgId, setOrgId] = useState("");
  const [result, setResult] = useState<Result>({
    items: [],
    page: 1,
    pageSize: 25,
    total: 0,
  });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [currencyCode, setCurrencyCode] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState("");
  const loadOrgs = useCallback(async () => {
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
    setOrgId((id) => id || data[0]?.id || "");
  }, [router]);
  const load = useCallback(
    async (page: number) => {
      if (!orgId) return;
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "25",
      });
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      if (currencyCode.trim()) params.set("currencyCode", currencyCode.trim().toUpperCase());
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const response = await fetch(
        `${api}/organizations/${orgId}/transactions?${params}`,
        { credentials: "include" },
      );
      if (!response.ok) {
        setError("Unable to load transactions.");
        return;
      }
      setResult((await response.json()) as Result);
    },
    [currencyCode, dateFrom, dateTo, orgId, search, status],
  );
  useEffect(() => {
    void Promise.resolve()
      .then(loadOrgs)
      .catch(() => setError("Unable to load workspace."));
  }, [loadOrgs]);
  useEffect(() => {
    void Promise.resolve().then(() => load(1));
  }, [load]);
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
      <div className="mx-auto max-w-7xl px-5 py-8">
        <p className="text-sm text-[#687386]">Ledger</p>
        <h1 className="mt-1 text-2xl font-semibold">Transactions</h1>
        <div className="mt-5 flex flex-wrap gap-3">
          <select
            aria-label="Organization"
            value={orgId}
            onChange={(event) => setOrgId(event.target.value)}
            className="h-10 min-w-64 rounded-md border border-[#dce2ea] bg-white px-3"
          >
            {orgs.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void load(1);
            }}
          >
            <input
              aria-label="Search reference"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search document reference"
              className="h-10 rounded-l-md border border-[#dce2ea] px-3 text-sm"
            />
            <button className="h-10 rounded-r-md bg-[#2369c8] px-3 text-sm font-medium text-white">
              Search
            </button>
          </form>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-[#e2e6ec] bg-white p-3 shadow-sm">
          <label className="text-sm font-medium">Status<select aria-label="Transaction status" value={status} onChange={(event) => setStatus(event.target.value)} className="ml-2 h-9 rounded-md border border-[#dce2ea] bg-white px-2 font-normal"><option value="">All</option><option>PENDING</option><option>MATCHED</option><option>UNMATCHED</option><option>EXCEPTION</option></select></label>
          <label className="text-sm font-medium">Currency<input aria-label="Currency code" value={currencyCode} onChange={(event) => setCurrencyCode(event.target.value.toUpperCase())} maxLength={3} placeholder="USD" className="ml-2 h-9 w-16 rounded-md border border-[#dce2ea] px-2 font-normal uppercase" /></label>
          <label className="text-sm font-medium">From<input aria-label="Transaction date from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="ml-2 h-9 rounded-md border border-[#dce2ea] px-2 font-normal" /></label>
          <label className="text-sm font-medium">To<input aria-label="Transaction date to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="ml-2 h-9 rounded-md border border-[#dce2ea] px-2 font-normal" /></label>
          <button onClick={() => void load(1)} className="h-9 rounded-md border border-[#b9ccec] px-3 text-sm font-medium text-[#2467bf]">Apply filters</button>
          {(status || currencyCode || dateFrom || dateTo) && <button onClick={() => { setStatus(""); setCurrencyCode(""); setDateFrom(""); setDateTo(""); }} className="h-9 text-sm font-medium text-[#2467bf] hover:underline">Clear</button>}
        </div>
        {error && (
          <p role="alert" className="mt-4 text-sm text-[#a53b2d]">
            {error}
          </p>
        )}
        <section className="mt-6 overflow-hidden rounded-lg border border-[#e2e6ec] bg-white shadow-sm">
          {result.items.length === 0 ? (
            <p className="p-10 text-center text-sm text-[#687386]">
              No transactions match this scope.
            </p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#fafbfd] text-xs uppercase text-[#687386]">
                <tr>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf0f4]">
                {result.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-4 font-medium">
                      <Link
                        href={`/transactions/${item.id}?org=${orgId}`}
                        className="text-[#2467bf] hover:underline"
                      >
                        {item.documentReference ?? "View transaction"}
                      </Link>
                    </td>
                    <td className="px-4 py-4 text-[#526176]">
                      {item.legalEntity.code}
                    </td>
                    <td className="px-4 py-4 text-[#526176]">
                      {item.transactionDate.slice(0, 10)}
                    </td>
                    <td className="px-4 py-4 font-mono text-[#172033]">
                      {item.currencyCode} {item.amount}
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-full bg-[#eef2f7] px-2 py-1 text-xs">
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="flex items-center justify-between border-t border-[#edf0f4] px-4 py-3 text-sm text-[#687386]">
            <span>{result.total} records</span>
            <div className="flex gap-2">
              <button
                disabled={result.page <= 1}
                onClick={() => void load(result.page - 1)}
                className="disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={result.page * result.pageSize >= result.total}
                onClick={() => void load(result.page + 1)}
                className="disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
