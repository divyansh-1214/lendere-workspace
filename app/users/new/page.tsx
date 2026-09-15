"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type UserRole = "ops_admin" | "lender_admin" | "lender_agent";
type SessionUser = { name: string; role: UserRole; lenderId?: string };
type FormState = { name: string; email: string; password: string; role: UserRole; lenderId: string };

const roleDetails: Record<UserRole, { label: string; description: string }> = {
  lender_agent: { label: "Lender agent", description: "Works assigned leads and lender conversations." },
  lender_admin: { label: "Lender admin", description: "Manages a lender workspace and its team." },
  ops_admin: { label: "Operations admin", description: "Manages the full Lendere operations workspace." },
};

export default function NewUserPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [form, setForm] = useState<FormState>({ name: "", email: "", password: "", role: "lender_agent", lenderId: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then(async (response) => {
        if (!response.ok) throw new Error("Your session has expired.");
        const data = await response.json() as { data: SessionUser };
        setSession(data.data);
        if (data.data.role === "lender_admin") {
          setForm((current) => ({ ...current, role: "lender_agent", lenderId: data.data.lenderId ?? "" }));
        }
      })
      .catch((sessionError: Error) => setError(sessionError.message))
      .finally(() => setLoadingSession(false));
  }, []);

  const isOpsAdmin = session?.role === "ops_admin";
  const availableRoles: UserRole[] = isOpsAdmin ? ["lender_agent", "lender_admin", "ops_admin"] : ["lender_agent"];
  const needsLender = form.role !== "ops_admin";

  function update(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value as FormState[typeof field] }));
    setError("");
    setSuccess("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, lenderId: needsLender ? form.lenderId : undefined }),
      });
      const data = await response.json() as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "Unable to create this user.");
        return;
      }
      setSuccess(`${form.name} has been added as a ${roleDetails[form.role].label.toLowerCase()}.`);
      setForm((current) => ({ ...current, name: "", email: "", password: "" }));
    } catch {
      setError("The server could not be reached. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell auth-shell-signup">
      <section className="auth-aside">
        <Link className="brand" href="/" aria-label="Lendere home"><span className="brand-mark">L</span><span>lendere<span className="brand-dot">.</span></span></Link>
        <div className="auth-aside-copy"><span className="eyebrow"><span>03</span> Workspace access</span><h1>Give the work a name.</h1><p>Set the right level of access for every person who helps move lending forward.</p></div>
        <span className="auth-aside-note">Role-based access · Session protected</span>
      </section>
      <section className="auth-panel"><div className="auth-form-wrap">
        <Link className="back-link" href="/">← Back to workspace</Link>
        <span className="section-kicker">People &amp; permissions</span>
        <h2>Add a workspace user</h2>
        <p className="auth-intro">Create an active account and choose the work this person can access.</p>
        {loadingSession ? <p className="form-state">Checking your permissions...</p> : session ? <form className="auth-form" onSubmit={submit}>
          <label>Full name<input value={form.name} onChange={(event) => update("name", event.target.value)} autoComplete="name" required /></label>
          <label>Email address<input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} autoComplete="email" required /></label>
          <div className="auth-form-grid">
            <label>Role<select value={form.role} onChange={(event) => update("role", event.target.value)}>{availableRoles.map((role) => <option key={role} value={role}>{roleDetails[role].label}</option>)}</select><small className="field-help">{roleDetails[form.role].description}</small></label>
            <label>Password<input type="password" value={form.password} onChange={(event) => update("password", event.target.value)} autoComplete="new-password" minLength={4} required /><small className="field-help">Use at least 8 characters.</small></label>
          </div>
          {needsLender && <label>Lender ID<input value={form.lenderId} onChange={(event) => update("lenderId", event.target.value)} placeholder="lender ID" required readOnly={!isOpsAdmin} /><small className="field-help">{isOpsAdmin ? "Required for lender roles." : "This user will be added to your lender workspace."}</small></label>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          {success && <p className="auth-success" role="status">{success}</p>}
          <button className="auth-submit" disabled={submitting} type="submit">{submitting ? "Adding user…" : "Add user"}<span>→</span></button>
        </form> : <div className="auth-error" role="alert">{error || "You do not have permission to add workspace users."}<button className="text-button" type="button" onClick={() => router.push("/login")}>Sign in again</button></div>}
      </div></section>
    </main>
  );
}
