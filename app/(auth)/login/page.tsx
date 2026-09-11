
"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import setId from "@/features/temp";
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "Unable to sign in");
        return;
      }
      console.log(data);
      await setId("lenderId",data.data.lenderId);
      await setId("userId",data.data.id);
      router.push("/");
      router.refresh();
    } catch {
      setError("The server could not be reached. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-aside">
        <Link className="brand" href="/">
          <span className="brand-mark">L</span>
          <span>lendere<span className="brand-dot">.</span></span>
        </Link>
        <div className="auth-aside-copy">
          <span className="eyebrow"><span>01</span> Operations workspace</span>
          <h1>Make every lead count.</h1>
          <p>One focused place for the people, rules, and records moving lending forward.</p>
        </div>
        <span className="auth-aside-note">Secure access · Private workspace</span>
      </section>
      <section className="auth-panel">
        <div className="auth-form-wrap">
          <span className="section-kicker">Welcome back</span>
          <h2>Sign in to your workspace</h2>
          <p className="auth-intro">Use your Lendere account to continue where you left off.</p>
          <form className="auth-form" onSubmit={submit}>
            <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
            <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="auth-submit" disabled={submitting} type="submit">{submitting ? "Signing in…" : "Sign in"}<span>→</span></button>
          </form>
          <p className="auth-switch">Need an account? <Link href="/signup">Create one</Link></p>
        </div>
      </section>
    </main>
  );
}