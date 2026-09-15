"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { UserRole, UserStatus, ManagedUser } from "@/features/users/user.types";


const roleLabels: Record<UserRole, string> = {
  ops_admin: "Operations admin",
  lender_admin: "Lender admin",
  lender_agent: "Lender agent",
};

export default function UserManagementPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"all" | UserRole>("all");
  const [status, setStatus] = useState<"all" | UserStatus>("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const loadUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/users");
      const data = (await response.json()) as { data?: ManagedUser[]; message?: string };
      if (!response.ok) throw new Error(data.message ?? "Unable to load users.");
      setUsers(data.data ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const getUser = async () => {
    await loadUsers();
    }
    getUser();
  }, []);

  const visibleUsers = useMemo(() => users.filter((user) => {
    const matchesQuery = `${user.name} ${user.email}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (role === "all" || user.role === role) && (status === "all" || user.status === status);
  }), [query, role, status, users]);

  const updateStatus = async (user: ManagedUser) => {
    const nextStatus = user.status === "disabled" ? "active" : "disabled";
    setBusyId(user._id);
    setError("");
    try {
      const response = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user._id, status: nextStatus }),
      });
      const data = (await response.json()) as { data?: ManagedUser; message?: string };
      if (!response.ok || !data.data) throw new Error(data.message ?? "Unable to update user.");
      setUsers((current) => current.map((item) => item._id === user._id ? data.data as ManagedUser : item));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update user.");
    } finally {
      setBusyId("");
    }
  };

  const removeUser = async (user: ManagedUser) => {
    if (!window.confirm(`Delete ${user.name}? This cannot be undone.`)) return;
    setBusyId(user._id);
    setError("");
    try {
      const response = await fetch(`/api/users?id=${encodeURIComponent(user._id)}`, { method: "DELETE" });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "Unable to delete user.");
      setUsers((current) => current.filter((item) => item._id !== user._id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete user.");
    } finally {
      setBusyId("");
    }
  };

  const counts = { total: users.length, active: users.filter((user) => user.status === "active").length, disabled: users.filter((user) => user.status === "disabled").length };

  return <main className="leads-shell admin-users-shell">
    <section className="admin-users-heading">
      <div className="eyebrow"><span>03</span> People &amp; permissions</div>
      <div className="admin-users-heading-row"><div><h1>Keep every account <em>in view.</em></h1><p>Review workspace access, pause accounts when roles change, and keep the operations team current.</p></div><Link className="admin-users-add" href="/users/new">Add user <span>→</span></Link></div>
    </section>
    <section className="admin-users-list" aria-labelledby="user-directory-title">
      <div className="assigned-list-heading"><div><span className="section-kicker">Operations directory</span><h2 id="user-directory-title">All workspace users</h2></div><button className="assigned-refresh" type="button" onClick={() => void loadUsers()} disabled={loading}>↻ Refresh</button></div>
      <div className="assigned-summary"><div><strong>{counts.total}</strong><span>Total accounts</span></div><div><strong>{counts.active}</strong><span>Active now</span></div><div><strong>{counts.disabled}</strong><span>Disabled</span></div></div>
      <div className="admin-users-controls"><label>Search<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or email" /></label><label>Role<select value={role} onChange={(event) => setRole(event.target.value as typeof role)}><option value="all">All roles</option><option value="ops_admin">Operations admin</option><option value="lender_admin">Lender admin</option><option value="lender_agent">Lender agent</option></select></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">All statuses</option><option value="active">Active</option><option value="invited">Invited</option><option value="disabled">Disabled</option></select></label></div>
      {error && <p className="admin-users-error" role="alert">{error}</p>}
      {loading ? <p className="admin-users-empty">Loading users...</p> : visibleUsers.length === 0 ? <p className="admin-users-empty">No users match these filters.</p> : <div className="admin-users-table-wrap"><table className="admin-users-table"><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Created</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visibleUsers.map((user) => <tr key={user._id}><td><strong>{user.name}</strong><span>{user.email}</span></td><td>{roleLabels[user.role]}</td><td><span className={`admin-user-status admin-user-status-${user.status}`}>{user.status}</span></td><td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "-"}</td><td><div className="admin-user-actions"><button type="button" onClick={() => void updateStatus(user)} disabled={busyId === user._id}>{user.status === "disabled" ? "Reactivate" : "Disable"}</button><button className="admin-user-delete" type="button" onClick={() => void removeUser(user)} disabled={busyId === user._id}>Delete</button></div></td></tr>)}</tbody></table></div>}
    </section>
  </main>;
}
