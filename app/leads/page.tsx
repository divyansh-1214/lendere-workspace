"use client"

import axios from "axios"; 
import Link from "next/link";
import { useEffect, useState } from "react";

type Lead = {
  _doc_id?: string;
  personal?: { firstName?: string; lastName?: string; age?: number };
  contact?: { phone?: string };
  employment?: { type?: string | null; income?: number | null };
  credit?: { creditScore?: number | null };
  addresses?: { city?: string | null; state?: string | null }[];
};

type Eligibility = {
  age: { min: number; max: number };
  income: { minAnnual: number };
  creditScore: { minExclusive: number; maxInclusive: number };
  employmentTypes: string[];
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const getLeads = async (nextPage: number) => {
    setLoading(true);
    setError("");

    const sessionResponse = await axios.get("/api/auth/session");
    const lenderId = sessionResponse.data.data.lenderId;
    const lenderResponse = await axios.get("/api/leander", {
      params: { lenderId },
    });
    const nextEligibility = lenderResponse.data.data.eligibility as Eligibility;
    const query = new URLSearchParams({
      ageMin: String(nextEligibility.age.min),
      ageMax: String(nextEligibility.age.max),
      minAnnual: String(nextEligibility.income.minAnnual),
      minExclusive: String(nextEligibility.creditScore.minExclusive),
      maxInclusive: String(nextEligibility.creditScore.maxInclusive),
      employmentTypes: nextEligibility.employmentTypes.join(","),
      page: String(nextPage),
      pageSize: "10",
    });

    const leadsResponse = await axios.get(`/api/leads?${query.toString()}`);
    setLeads(leadsResponse.data.data);
    setEligibility(nextEligibility);
    setPage(leadsResponse.data.pagination.page);
    setTotalCount(leadsResponse.data.totalCount);
    setTotalPages(leadsResponse.data.pagination.totalPages);
    setLoading(false);
  };
  
  useEffect(() => {
    Promise.resolve().then(() => getLeads(1)).catch(() => {
        setError("Unable to load leads right now. Please try again.");
        setLoading(false);
      });
  }, []);

  const changePage = (nextPage: number) => {
    getLeads(nextPage).catch(() => {
      setError("Unable to load this page. Please try again.");
      setLoading(false);
    });
  };

  return (
    <main className="leads-shell">
      <header className="leads-topbar">
        <Link className="brand" href="/">
          <span className="brand-mark">L</span> lendere<span className="brand-dot">.</span>
        </Link>
        <span className="topbar-status"><span className="status-dot" /> live lead view</span>
      </header>

      <section className="leads-heading">
        <span className="eyebrow"><span>02</span> borrower leads</span>
        <div className="leads-heading-row">
          <div>
            <h1>Ready to <em>review.</em></h1>
            <p>Borrowers matched against your lender eligibility rules, with the newest records shown first.</p>
          </div>
          <div className="leads-count">
            <strong>{totalCount}</strong>
            <span>matched leads</span>
          </div>
        </div>
      </section>

      {eligibility && (
        <section className="eligibility-panel">
          <div>
            <span className="section-kicker">active filter</span>
            <h2>Eligibility match</h2>
          </div>
          <div className="eligibility-rules">
            <span>Age <strong>{eligibility.age.min}–{eligibility.age.max}</strong></span>
            <span>Income <strong>₹{eligibility.income.minAnnual.toLocaleString()}</strong></span>
            <span>Credit <strong>{eligibility.creditScore.minExclusive}+ to {eligibility.creditScore.maxInclusive}</strong></span>
            <span>Employment <strong>{eligibility.employmentTypes.join(", ")}</strong></span>
          </div>
        </section>
      )}

      <section className="leads-content">
        {error && <p className="leads-error">{error}</p>}
        <div className="leads-table-wrap">
          {loading ? <p className="leads-state">Loading matched leads...</p> : leads.length === 0 ? <p className="leads-state">No leads match this lender&apos;s rules.</p> : (
            <table className="leads-table">
              <thead><tr><th>Borrower</th><th>Contact</th><th>Age</th><th>Employment</th><th>Income</th><th>Credit</th><th>Location</th></tr></thead>
              <tbody>{leads.map((lead) => <tr key={lead._doc_id}>
                <td><strong>{lead.personal?.firstName} {lead.personal?.lastName}</strong><small>{lead._doc_id}</small></td>
                <td>{lead.contact?.phone || "—"}</td>
                <td>{lead.personal?.age ?? "—"}</td>
                <td>{lead.employment?.type?.replace("_", " ") || "—"}</td>
                <td>{lead.employment?.income ? `₹${lead.employment.income.toLocaleString()}` : "—"}</td>
                <td>{lead.credit?.creditScore ?? "—"}</td>
                <td>{[lead.addresses?.[0]?.city, lead.addresses?.[0]?.state].filter(Boolean).join(", ") || "—"}</td>
              </tr>)}</tbody>
            </table>
          )}
        </div>
        {totalPages > 0 && <nav className="leads-pagination" aria-label="Lead pages">
          <span>Page {page} of {totalPages}</span>
          <div><button type="button" onClick={() => changePage(page - 1)} disabled={page === 1 || loading}>← Previous</button><button type="button" onClick={() => changePage(page + 1)} disabled={page === totalPages || loading}>Next →</button></div>
        </nav>}
      </section>
    </main>
  );
}