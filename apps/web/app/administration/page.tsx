"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3003/api/v1";
type Org = { id: string; name: string };
type Member = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  roles: {
    organizationId: string | null;
    role: { id: string; code: string; name: string };
  }[];
};
type Role = { id: string; code: string; name: string; description: string | null };
export default function AdministrationPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgId, setOrgId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [notice, setNotice] = useState("");
  const [working, setWorking] = useState("");
  const load = useCallback(async () => {
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
  }, [router]);
  const list = useCallback(async () => {
    if (!orgId) return;
    const [membersResponse, rolesResponse] = await Promise.all([
      fetch(`${api}/organizations/${orgId}/administration/users`, { credentials: "include" }),
      fetch(`${api}/organizations/${orgId}/administration/roles`, { credentials: "include" }),
    ]);
    if (membersResponse.status === 403 || rolesResponse.status === 403) {
      setNotice(
        "Your account does not have permission to manage organization access.",
      );
      return;
    }
    if (!membersResponse.ok || !rolesResponse.ok) {
      setNotice("Unable to load members.");
      return;
    }
    setMembers((await membersResponse.json()) as Member[]);
    setRoles((await rolesResponse.json()) as Role[]);
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
  async function setActive(member: Member) { const isActive = !member.isActive; if (!window.confirm(`${isActive ? "Activate" : "Deactivate"} ${member.email}?`)) return; setWorking(member.id); try { const response = await fetch(`${api}/organizations/${orgId}/administration/users/${member.id}/active`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive }) }); const body = await response.json().catch(() => null) as { message?: string } | null; if (!response.ok) throw new Error(body?.message ?? "Member state could not be updated."); setNotice(`${member.email} ${isActive ? "activated" : "deactivated"}.`); await list(); } catch (error) { setNotice(error instanceof Error ? error.message : "Member state could not be updated."); } finally { setWorking(""); } }
  async function assignRole(member: Member, roleId: string) { if (!roleId) return; setWorking(member.id); try { const response = await fetch(`${api}/organizations/${orgId}/administration/users/${member.id}/roles`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roleId }) }); const body = await response.json().catch(() => null) as { message?: string } | null; if (!response.ok) throw new Error(body?.message ?? "Role could not be assigned."); setNotice("Organization role assigned."); await list(); } catch (error) { setNotice(error instanceof Error ? error.message : "Role could not be assigned."); } finally { setWorking(""); } }
  async function removeRole(member: Member, role: Member["roles"][number]) { if (role.organizationId === null || !window.confirm(`Remove ${role.role.name} from ${member.email}?`)) return; setWorking(member.id); try { const response = await fetch(`${api}/organizations/${orgId}/administration/users/${member.id}/roles/${role.role.id}`, { method: "DELETE", credentials: "include" }); const body = await response.json().catch(() => null) as { message?: string } | null; if (!response.ok) throw new Error(body?.message ?? "Role could not be removed."); setNotice("Organization role removed."); await list(); } catch (error) { setNotice(error instanceof Error ? error.message : "Role could not be removed."); } finally { setWorking(""); } }
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
        <p className="text-sm text-[#687386]">Administration</p>
        <h1 className="mt-1 text-2xl font-semibold">Organization access</h1>
        <p className="mt-1 text-sm text-[#687386]">
          Review active members and their scoped roles. Credential data is never
          shown here.
        </p>
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
        <section className="mt-6 overflow-hidden rounded-lg border border-[#e2e6ec] bg-white shadow-sm">
          {members.length === 0 ? (
            <p className="p-8 text-center text-sm text-[#687386]">
              No members are available for this organization, or access
              management permission is required.
            </p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#fafbfd] text-xs uppercase text-[#687386]">
                <tr>
                  <th className="px-5 py-3">Member</th>
                  <th className="px-5 py-3">Roles</th>
                  <th className="px-5 py-3">Last login</th>
                  <th className="px-5 py-3">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf0f4]">
                {members.map((member) => (
                  <tr key={member.id}>
                    <td className="px-5 py-4">
                      <p className="font-medium">
                        {[member.firstName, member.lastName]
                          .filter(Boolean)
                          .join(" ") || member.email}
                      </p>
                      <p className="text-xs text-[#687386]">{member.email}</p>
                    </td>
                    <td className="px-5 py-4 text-[#526176]">
                      {member.roles.length ? <div className="flex flex-wrap gap-1">{member.roles.map((role) => <span key={`${role.organizationId ?? "platform"}-${role.role.id}`} className="rounded bg-[#eef2f7] px-2 py-1 text-xs">{role.role.name}{role.organizationId && <button disabled={working === member.id} aria-label={`Remove ${role.role.name}`} onClick={() => void removeRole(member, role)} className="ml-1 font-semibold text-[#2467bf] disabled:opacity-50">×</button>}</span>)}</div> : "No role assigned"}
                      <select aria-label={`Assign role to ${member.email}`} disabled={working === member.id} defaultValue="" onChange={(event) => { void assignRole(member, event.target.value); event.currentTarget.value = ""; }} className="mt-2 h-8 max-w-48 rounded border border-[#dce2ea] bg-white px-2 text-xs disabled:opacity-50"><option value="">Assign role…</option>{roles.filter((role) => !member.roles.some((assigned) => assigned.organizationId === orgId && assigned.role.id === role.id)).map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select>
                    </td>
                    <td className="px-5 py-4 text-[#526176]">
                      {member.lastLoginAt
                        ? new Date(member.lastLoginAt).toLocaleString()
                        : "Never"}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${member.isActive ? "bg-[#e9f7f1] text-[#187458]" : "bg-[#f3f4f6] text-[#687386]"}`}
                      >
                        {member.isActive ? "Active" : "Inactive"}
                      </span>
                      <button disabled={working === member.id} onClick={() => void setActive(member)} className="ml-3 text-xs font-medium text-[#2467bf] hover:underline disabled:opacity-50">{member.isActive ? "Deactivate" : "Activate"}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}
