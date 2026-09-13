'use client';

import axios from "axios";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AssignedCase, AssignedCasesResponse, CaseStatus } from "@/features/case/case.types";

const formatStatus = (status: AssignedCase["status"]) => status.replaceAll("_", " ");
const statusOptions: Array<CaseStatus | "ALL"> = ["ALL", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "REJECTED", "CANCELLED"];

const formatDate = (date: string) => new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
}).format(new Date(date));

export default function AssignedPage() {
  const [cases, setCases] = useState<AssignedCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CaseStatus | "ALL">("ALL");

  const loadCases = () => {
    setLoading(true);
    setError("");
    return axios.get<AssignedCasesResponse>("/api/cases")
      .then((response) => setCases(response.data.data || []))
      .catch(() => setError("Unable to load your assigned leads right now. Please try again."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    void loadCases();
  }, []);

  const visibleCases = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return cases.filter((assignedCase) => {
      const lead = assignedCase.leadId;
      if (statusFilter !== "ALL" && assignedCase.status !== statusFilter) return false;
      if (!normalizedQuery) return true;
      const borrower = `${lead?.personal?.firstName || ""} ${lead?.personal?.lastName || ""}`.toLowerCase();
      return [borrower, lead?._doc_id, lead?.contact?.phone].some((value) => value?.toLowerCase().includes(normalizedQuery));
    });
  }, [cases, query, statusFilter]);

  const statusCount = (status: CaseStatus) => cases.filter((assignedCase) => assignedCase.status === status).length;

  return (
    <main className="assigned-shell">
      <header className="assigned-topbar">
        <Link className="brand" href="/"><span className="brand-mark">L</span> lendere<span className="brand-dot">.</span></Link>
        <Link className="leads-back" href="/leads">lead directory <span>↗</span></Link>
      </header>
      <section className="assigned-heading">
        <span className="eyebrow"><span>03</span> agent workspace</span>
        <div className="assigned-heading-row">
          <div>
            <h1>Your <em>assigned</em> leads.</h1>
            <p>Keep track of every borrower currently in your queue, from first contact through completion.</p>
          </div>
          <div className="leads-count"><strong>{cases.length}</strong><span>assigned cases</span></div>
        </div>
      </section>
      {error && <p className="leads-error">{error}</p>}
      {loading ? <p className="leads-state">Loading your assigned leads...</p> : cases.length === 0 ? (
        <section className="assigned-empty"><span className="section-kicker">queue is clear</span><h2>No leads assigned yet.</h2><p>Your lender admin will add new borrower leads to this workspace when they are ready.</p></section>
      ) : (
        <section className="assigned-list" aria-labelledby="assigned-list-title">
          <div className="assigned-summary" aria-label="Assigned case summary">
            <div><strong>{statusCount("ASSIGNED")}</strong><span>assigned</span></div>
            <div><strong>{statusCount("IN_PROGRESS")}</strong><span>in progress</span></div>
            <div><strong>{statusCount("COMPLETED")}</strong><span>completed</span></div>
          </div>
          <div className="assigned-list-heading"><div><span className="section-kicker">current queue</span><h2 id="assigned-list-title">Borrowers to follow up</h2></div><button className="assigned-refresh" type="button" onClick={() => void loadCases()} disabled={loading}>Refresh queue</button></div>
          <div className="assigned-controls">
            <label>Search borrower, phone, or lead ID<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your queue" /></label>
            <label>Show status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as CaseStatus | "ALL")}>
              {statusOptions.map((status) => <option key={status} value={status}>{status === "ALL" ? "All statuses" : formatStatus(status)}</option>)}
            </select></label>
          </div>
          <p className="assigned-result-count">Showing {visibleCases.length} of {cases.length} {cases.length === 1 ? "case" : "cases"}</p>
          <div className="assigned-grid">
            {visibleCases.map((assignedCase) => {
              const lead = assignedCase.leadId;
              const name = lead ? `${lead.personal?.firstName || "Unnamed"} ${lead.personal?.lastName || "borrower"}` : "Lead unavailable";
              const location = [lead?.addresses?.[0]?.city, lead?.addresses?.[0]?.state].filter(Boolean).join(", ");
              return <article className="assigned-card" key={assignedCase._id}>
                <div className="assigned-card-topline"><span className={`case-status case-status-${assignedCase.status.toLowerCase()}`}>{formatStatus(assignedCase.status)}</span><span className="assigned-date">assigned {formatDate(assignedCase.assignedAt)}</span></div>
                <h3>{name}</h3><p className="assigned-lead-id">{lead?._doc_id || "Lead ID unavailable"}</p>
                <dl className="assigned-details">
                  <div><dt>Contact</dt><dd>{lead?.contact?.phone || "No phone"}</dd></div>
                  <div><dt>Age / location</dt><dd>{lead?.personal?.age ?? "-"}{location ? ` · ${location}` : ""}</dd></div>
                  <div><dt>Employment</dt><dd>{lead?.employment?.type?.replaceAll("_", " ") || "-"}</dd></div>
                  <div><dt>Credit score</dt><dd>{lead?.credit?.creditScore ?? "-"}</dd></div>
                  <div><dt>Loan purpose</dt><dd>{lead?.loan?.purpose || "Not specified"}</dd></div>
                  <div><dt>Loan amount</dt><dd>{lead?.loan?.amount ? `₹${lead.loan.amount.toLocaleString("en-IN")}` : "-"}</dd></div>
                </dl>
                <a className="assigned-contact" href={lead?.contact?.phone ? `tel:${lead.contact.phone}` : undefined} aria-disabled={!lead?.contact?.phone}>Contact borrower <span>→</span></a>
              </article>;
            })}
          </div>
          {visibleCases.length === 0 && <p className="leads-state">No assigned leads match these filters.</p>}
        </section>
      )}
    </main>
  );
}
