"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3003/api/v1";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSubmitting(true); setError(""); const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${apiBase}/auth/login`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
      const body = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) throw new Error(body?.message ?? "Sign in was unsuccessful.");
      router.push("/");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Sign in was unsuccessful."); }
    finally { setSubmitting(false); }
  }
  return <main className="grid min-h-screen bg-[#f5f7fa] lg:grid-cols-[1.1fr_0.9fr]"><section className="hidden bg-[#10243f] p-12 text-white lg:flex lg:flex-col"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-[#4f8fe8] font-bold">L</div><span className="text-lg font-semibold">Ledgerline</span></div><div className="my-auto max-w-lg"><p className="mb-5 text-sm font-semibold uppercase tracking-[0.16em] text-[#88aee4]">Intercompany control</p><h1 className="text-4xl font-semibold leading-tight tracking-tight">Confidence for every entity, every close.</h1><p className="mt-5 max-w-md text-base leading-7 text-[#b8c8dd]">A controlled workspace for finance teams to reconcile balances, investigate exceptions, and close with clarity.</p></div><p className="text-sm text-[#8195b0]">© 2026 Ledgerline Finance Systems</p></section><section className="grid place-items-center p-6"><form onSubmit={login} className="w-full max-w-sm"><div className="mb-9 lg:hidden"><div className="flex items-center gap-3 text-[#10243f]"><div className="grid h-9 w-9 place-items-center rounded-lg bg-[#4f8fe8] font-bold text-white">L</div><span className="text-lg font-semibold">Ledgerline</span></div></div><p className="text-sm font-medium text-[#526176]">Welcome back</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#172033]">Sign in to your workspace</h1><p className="mt-3 text-sm leading-6 text-[#687386]">Use the credentials issued by your organization administrator.</p>{error && <div role="alert" className="mt-5 rounded-md border border-[#f1c3bd] bg-[#fff5f3] px-3 py-2.5 text-sm text-[#a53b2d]">{error}</div>}<label className="mt-7 block text-sm font-medium text-[#334155]">Work email<input required autoComplete="email" name="email" type="email" className="mt-1.5 h-11 w-full rounded-md border border-[#d5dce6] bg-white px-3 text-[#172033] shadow-sm" /></label><label className="mt-5 block text-sm font-medium text-[#334155]">Password<input required autoComplete="current-password" name="password" type="password" className="mt-1.5 h-11 w-full rounded-md border border-[#d5dce6] bg-white px-3 text-[#172033] shadow-sm" /></label><button disabled={submitting} className="mt-7 h-11 w-full rounded-md bg-[#2369c8] text-sm font-semibold text-white shadow-sm hover:bg-[#195aa9] disabled:opacity-60">{submitting ? "Signing in…" : "Sign in"}</button><p className="mt-6 text-center text-xs leading-5 text-[#7a8595]">This is a secure, session-based workspace. Access is monitored and audited.</p></form></section></main>;
}
