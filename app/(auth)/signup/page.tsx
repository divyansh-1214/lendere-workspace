"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type UserRole = "ops_admin" | "lender_admin" | "lender_agent";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "lender_agent" as UserRole, lenderId: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const needsLender = form.role !== "ops_admin";

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, lenderId: needsLender ? form.lenderId : undefined }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "Unable to create your account");
        return;
      }
      router.push("/login");
    } catch {
      setError("The server could not be reached. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell auth-shell-signup">
      <section className="auth-aside">
        <Link className="brand" href="/"><span className="brand-mark">L</span><span>lendere<span className="brand-dot">.</span></span></Link>
        <div className="auth-aside-copy"><span className="eyebrow"><span>02</span> New workspace member</span><h1>Start with clarity.</h1><p>Create an account for a calmer, more accountable lending operation.</p></div>
        <span className="auth-aside-note">Role-based access · Session protected</span>
      </section>
      <section className="auth-panel"><div className="auth-form-wrap">
        <span className="section-kicker">Create account</span>
        <h2>Join the workspace</h2>
        <p className="auth-intro">An operations administrator can create a workspace account here.</p>
        <form className="auth-form" onSubmit={submit}>
          <label>Full name<input value={form.name} onChange={(event) => update("name", event.target.value)} autoComplete="name" required /></label>
          <label>Email address<input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} autoComplete="email" required /></label>
          <div className="auth-form-grid">
            <label>Role<select value={form.role} onChange={(event) => update("role", event.target.value)}><option value="lender_agent">Lender agent</option><option value="lender_admin">Lender admin</option><option value="ops_admin">Operations admin</option></select></label>
            <label>Password<input type="password" value={form.password} onChange={(event) => update("password", event.target.value)} autoComplete="new-password" minLength={8} required /></label>
          </div>
          {needsLender && <label>Lender ID<input value={form.lenderId} onChange={(event) => update("lenderId", event.target.value)} placeholder="MongoDB lender ID" required /><small className="field-help">Required for lender roles.</small></label>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" disabled={submitting} type="submit">{submitting ? "Creating account…" : "Create account"}<span>→</span></button>
        </form>
        <p className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></p>
      </div></section>
    </main>
  );
}