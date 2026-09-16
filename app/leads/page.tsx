"use client"

import axios from "axios";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Lead, LeadFilters, Agent, Eligibility } from "@/features/leads/leads.type";

const selectedLeadsStorageKey = "lendere:selected-lead-ids";

const initialFilters: LeadFilters = {
  search: "",
  ageMin: "",
  ageMax: "",
  employmentType: [],
  incomeMin: "",
  incomeMax: "",
  creditMin: "",
  creditMax: "",
  state: "",
  city: "",
  pincode: "",
  loanAmountMin: "",
  loanAmountMax: "",
  loanPurpose: "",
  sort: "newest",
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<LeadFilters>(initialFilters);
  const [freeLeads, setFreeLeads] = useState<Lead[]>([]);
  const [freeLeadCount, setFreeLeadCount] = useState(0);
  const [freeLeadsLoading, setFreeLeadsLoading] = useState(true);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<Record<string, string>>({});
  const [assigningLead, setAssigningLead] = useState<string | null>(null);
  const [assignmentError, setAssignmentError] = useState("");
  const [assignmentNotice, setAssignmentNotice] = useState("");
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [bulkAssignmentError, setBulkAssignmentError] = useState("");
  const [bulkAssignmentNotice, setBulkAssignmentNotice] = useState("");
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];

    try {
      const storedIds = window.localStorage.getItem(selectedLeadsStorageKey);
      const parsedIds: unknown = storedIds ? JSON.parse(storedIds) : [];
      return Array.isArray(parsedIds)
        ? parsedIds.filter((id): id is string => typeof id === "string")
        : [];
    } catch {
      return [];
    }
  });

  const pageLeadIds = useMemo(
    () => leads
      .filter((lead) => !lead.isAssigned)
      .map((lead) => lead._id || lead._doc_id)
      .filter((id): id is string => Boolean(id)),
    [leads],
  );
  const selectedOnPageCount = useMemo(
    () => pageLeadIds.filter((id) => selectedLeadIds.includes(id)).length,
    [pageLeadIds, selectedLeadIds],
  );
  const allPageLeadsSelected = pageLeadIds.length > 0 && selectedOnPageCount === pageLeadIds.length;

  useEffect(() => {
    try {
      window.localStorage.setItem(selectedLeadsStorageKey, JSON.stringify(selectedLeadIds));
    } catch {
      // Keep the selection usable when browser storage is unavailable.
    }
  }, [selectedLeadIds]);

  const toggleLeadSelection = (leadId: string) => {
    const lead = leads.find((item) => (item._id || item._doc_id) === leadId);
    if (lead?.isAssigned) return;

    setSelectedLeadIds((current) => current.includes(leadId)
      ? current.filter((id) => id !== leadId)
      : [...current, leadId]);
  };

  const togglePageSelection = () => {
    setSelectedLeadIds((current) => {
      if (allPageLeadsSelected) {
        return current.filter((id) => !pageLeadIds.includes(id));
      }

      return [...new Set([...current, ...pageLeadIds])];
    });
  };

  const clearSelectedLeads = () => setSelectedLeadIds([]);

  const getLeads = async (nextPage: number, nextFilters = filters) => {
    setLoading(true);
    setError("");

    const query = new URLSearchParams({ page: String(nextPage), pageSize: "10" });
    Object.entries(nextFilters).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((item) => query.append(key, item));
      } else if (value) {
        query.set(key, value);
      }
    });

    const leadsResponse = await axios.get(`/api/leads?${query.toString()}`);
    setLeads(leadsResponse.data.leads);
    const apiEligibility = leadsResponse.data.filters?.eligibility;
    if (apiEligibility) {
      setEligibility({
        age: { min: apiEligibility.ageMin, max: apiEligibility.ageMax },
        income: { minAnnual: apiEligibility.incomeMin },
        creditScore: {
          minExclusive: apiEligibility.creditMinExclusive,
          maxInclusive: apiEligibility.creditMaxInclusive,
        },
        employmentTypes: apiEligibility.employmentTypes,
      });
    }
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
    axios.get("/api/cases?page=1&pageSize=10").then((response) => {
      setFreeLeads(response.data.data || []);
      setFreeLeadCount(response.data.totalCount || 0);
    }).catch(() => {
      setFreeLeads([]);
      setFreeLeadCount(0);
    }).finally(() => setFreeLeadsLoading(false));
    axios.get("/api/users/agents").then((response) => setAgents(response.data.data || [])).catch(() => setAgents([]));
  }, []);

  const assignLead = async (leadId: string) => {
    const agentId = selectedAgents[leadId];
    if (!agentId) return;

    setAssigningLead(leadId);
    setAssignmentError("");
    setAssignmentNotice("");
    try {
      await axios.post("/api/cases", { leadId, agentId });
      setFreeLeads((current) => current.filter((lead) => lead._id !== leadId));
      setFreeLeadCount((current) => Math.max(current - 1, 0));
      setSelectedAgents((current) => {
        const next = { ...current };
        delete next[leadId];
        return next;
      });
      setAssignmentNotice("Lead assigned successfully.");
    } catch (assignmentRequestError) {
      setAssignmentError(axios.isAxiosError(assignmentRequestError)
        ? assignmentRequestError.response?.data?.message || "Unable to assign this lead."
        : "Unable to assign this lead.");
    } finally {
      setAssigningLead(null);
    }
  };

  const changePage = (nextPage: number) => {
    getLeads(nextPage).catch(() => {
      setError("Unable to load this page. Please try again.");
      setLoading(false);
    });
  };

  const updateFilter = (name: keyof LeadFilters, value: string | string[]) => {
    setFilters((current) => ({ ...current, [name]: value }));
  };

  const submitFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    getLeads(1, filters).catch(() => {
      setError("Unable to apply these filters right now. Please try again.");
      setLoading(false);
    });
  };

  const clearFilters = () => {
    setFilters(initialFilters);
    getLeads(1, initialFilters).catch(() => {
      setError("Unable to reset filters right now. Please try again.");
      setLoading(false);
    });
  };

  const assignAutomatically = async () => {
    const selectableLeadIds = selectedLeadIds.filter((leadId) => {
      const lead = leads.find((item) => (item._id || item._doc_id) === leadId);
      return !lead?.isAssigned;
    });

    if (selectableLeadIds.length === 0 || bulkAssigning) return;

    setBulkAssigning(true);
    setBulkAssignmentError("");
    setBulkAssignmentNotice("");
    try {
      const response = await axios.post("/api/leads/assign", { leadId: selectableLeadIds });
      if (response.data.success) {
        setSelectedLeadIds((current) => current.filter((id) => !selectableLeadIds.includes(id)));
        setBulkAssignmentNotice(`${selectableLeadIds.length} lead${selectableLeadIds.length === 1 ? "" : "s"} sent for automatic assignment.`);
      } else {
        setBulkAssignmentError(response.data.message || "Unable to assign selected leads.");
      }
    } catch (assignmentRequestError) {
      setBulkAssignmentError(axios.isAxiosError(assignmentRequestError)
        ? assignmentRequestError.response?.data?.message || "Unable to assign selected leads."
        : "Unable to assign selected leads.");
    } finally {
      setBulkAssigning(false);
    }
  };
  return (
    <main className="leads-shell">
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

      {/* {agents.length > 0 && (
        <section className="assignment-panel" aria-labelledby="assignment-title">
          <div className="assignment-panel-heading">
            <div>
              <span className="section-kicker">lender admin workspace</span>
              <h2 id="assignment-title">Assign free leads</h2>
              <p>Match an available borrower with one of your active agents.</p>
            </div>
            <strong>{freeLeadCount}<span> free leads</span></strong>
          </div>
          {assignmentError && <p className="leads-error">{assignmentError}</p>}
          {assignmentNotice && <p className="assignment-notice">{assignmentNotice}</p>}
          {freeLeadsLoading ? <p className="leads-state">Loading free leads...</p> : freeLeads.length === 0 ? <p className="leads-state">There are no free eligible leads right now.</p> : (
            <div className="assignment-list">
              {freeLeads.map((lead) => {
                const leadId = lead._id || "";
                return <article className="assignment-row" key={leadId}>
                  <div className="assignment-borrower">
                    <strong>{lead.personal?.firstName} {lead.personal?.lastName}</strong>
                    <small>{lead._doc_id} · {lead.contact?.phone || "No phone"}</small>
                  </div>
                  <div className="assignment-summary">
                    <span>{lead.personal?.age ?? "—"} yrs</span>
                    <span>{lead.employment?.type?.replace("_", " ") || "—"}</span>
                    <span>{lead.credit?.creditScore ?? "—"} credit</span>
                  </div>
                  <div className="assignment-controls">
                    <select aria-label={`Choose agent for ${lead.personal?.firstName || "lead"}`} value={selectedAgents[leadId] || ""} onChange={(event) => setSelectedAgents((current) => ({ ...current, [leadId]: event.target.value }))}>
                      <option value="">Choose agent</option>
                      {agents.map((agent) => <option key={agent._id} value={agent._id}>{agent.name}</option>)}
                    </select>
                    <button type="button" onClick={() => assignLead(leadId)} disabled={!selectedAgents[leadId] || assigningLead === leadId}>{assigningLead === leadId ? "Assigning..." : "Assign lead →"}</button>
                  </div>
                </article>;
              })}
            </div>
          )}
        </section>
      )} */}

      <form className="lead-filters" onSubmit={submitFilters}>
        <div className="lead-filters-heading">
          <div>
            <span className="section-kicker">refine results</span>
            <h2>Find a lead</h2>
          </div>
          <button className="filter-clear" type="button" onClick={clearFilters}>Clear all</button>
        </div>

        <label className="filter-search">
          <span>Search name, phone, or lead ID</span>
          <input value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Start typing..." />
        </label>

        <div className="filter-groups">
          <fieldset><legend>Profile</legend>
            <div className="filter-fields">
              <label>Age from<input type="number" min="0" value={filters.ageMin} onChange={(event) => updateFilter("ageMin", event.target.value)} /></label>
              <label>Age to<input type="number" min="0" value={filters.ageMax} onChange={(event) => updateFilter("ageMax", event.target.value)} /></label>
              <label>Income from<input type="number" min="0" value={filters.incomeMin} onChange={(event) => updateFilter("incomeMin", event.target.value)} /></label>
              <label>Income to<input type="number" min="0" value={filters.incomeMax} onChange={(event) => updateFilter("incomeMax", event.target.value)} /></label>
            </div>
            <label className="filter-wide">Employment type
              <select multiple value={filters.employmentType} onChange={(event) => updateFilter("employmentType", Array.from(event.target.selectedOptions, (option) => option.value))}>
                {(eligibility?.employmentTypes || []).map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
              </select>
            </label>
          </fieldset>

          <fieldset><legend>Credit &amp; loan</legend>
            <div className="filter-fields">
              <label>Credit from<input type="number" min="0" value={filters.creditMin} onChange={(event) => updateFilter("creditMin", event.target.value)} /></label>
              <label>Credit to<input type="number" min="0" value={filters.creditMax} onChange={(event) => updateFilter("creditMax", event.target.value)} /></label>
              <label>Loan amount from<input type="number" min="0" value={filters.loanAmountMin} onChange={(event) => updateFilter("loanAmountMin", event.target.value)} /></label>
              <label>Loan amount to<input type="number" min="0" value={filters.loanAmountMax} onChange={(event) => updateFilter("loanAmountMax", event.target.value)} /></label>
            </div>
            <label className="filter-wide">Loan purpose<input value={filters.loanPurpose} onChange={(event) => updateFilter("loanPurpose", event.target.value)} /></label>
          </fieldset>

          <fieldset><legend>Location</legend>
            <div className="filter-fields">
              <label>State<input value={filters.state} onChange={(event) => updateFilter("state", event.target.value)} /></label>
              <label>City<input value={filters.city} onChange={(event) => updateFilter("city", event.target.value)} /></label>
              <label>Pincode<input value={filters.pincode} onChange={(event) => updateFilter("pincode", event.target.value)} /></label>
            </div>
          </fieldset>
        </div>

        <div className="filter-actions">
          <label>Sort by<select value={filters.sort} onChange={(event) => updateFilter("sort", event.target.value)}>
            <option value="newest">Newest</option><option value="oldest">Oldest</option><option value="highestCreditScore">Highest credit score</option><option value="highestIncome">Highest income</option>
          </select></label>
          <button className="filter-apply" type="submit" disabled={loading}>Apply filters <span>→</span></button>
        </div>
      </form>

      <section className="leads-content">
        {error && <p className="leads-error">{error}</p>}
        <div className="leads-table-wrap">
          {loading ? <p className="leads-state">Loading matched leads...</p> : leads.length === 0 ? <p className="leads-state">No leads match this lender&apos;s rules.</p> : (
            <table className="leads-table">
              <thead><tr><th className="lead-selection-column"><input type="checkbox" aria-label="Select all leads on this page" checked={allPageLeadsSelected} onChange={togglePageSelection} /></th><th>Borrower</th><th>Contact</th><th>Age</th><th>Employment</th><th>Income</th><th>Credit</th><th>Location</th></tr></thead>
              <tbody>{leads.map((lead) => {
                const leadId = lead._id || lead._doc_id || "";
                const isAssigned = Boolean(lead.isAssigned);

                return <tr key={lead._doc_id || leadId} className={isAssigned ? "is-assigned-row" : ""}>
                  <td className="lead-selection-column">
                    <input
                      type="checkbox"
                      aria-label={`Select ${lead.personal?.firstName || "lead"}`}
                      checked={Boolean(leadId && selectedLeadIds.includes(leadId))}
                      disabled={isAssigned}
                      onChange={() => {
                        if (leadId) toggleLeadSelection(leadId);
                      }}
                    />
                  </td>
                  <td>
                    <strong>{lead.personal?.firstName} {lead.personal?.lastName}</strong>
                    <small>{lead._doc_id}</small>
                    {isAssigned && <span className="lead-assigned-badge">Assigned</span>}
                  </td>
                  <td>{lead.contact?.phone || "—"}</td>
                  <td>{lead.personal?.age ?? "—"}</td>
                  <td>{lead.employment?.type?.replace("_", " ") || "—"}</td>
                  <td>{lead.employment?.income ? `₹${lead.employment.income.toLocaleString()}` : "—"}</td>
                  <td>{lead.credit?.creditScore ?? "—"}</td>
                  <td>{[lead.addresses?.[0]?.city, lead.addresses?.[0]?.state].filter(Boolean).join(", ") || "—"}</td>
                </tr>;
              })}</tbody>
            </table>
          )}
        </div>
        <div className="leads-selection-summary" aria-live="polite">
          <span>{selectedLeadIds.length} lead{selectedLeadIds.length === 1 ? "" : "s"} selected{selectedOnPageCount > 0 ? ` · ${selectedOnPageCount} on this page` : ""}</span>
          <div className="leads-selection-actions">
            <button className="leads-assign-selected" type="button" onClick={assignAutomatically} disabled={selectedLeadIds.length === 0 || bulkAssigning}>
              {bulkAssigning ? "Assigning..." : "Assign selected →"}
            </button>
            {selectedLeadIds.length > 0 && <button type="button" onClick={clearSelectedLeads}>Clear selection</button>}
          </div>
        </div>
        {bulkAssignmentError && <p className="leads-error">{bulkAssignmentError}</p>}
        {bulkAssignmentNotice && <p className="assignment-notice">{bulkAssignmentNotice}</p>}
        {totalPages > 0 && <nav className="leads-pagination" aria-label="Lead pages">
          <span>Page {page} of {totalPages}</span>
          <div><button type="button" onClick={() => changePage(page - 1)} disabled={page === 1 || loading}>← Previous</button><button type="button" onClick={() => changePage(page + 1)} disabled={page === totalPages || loading}>Next →</button></div>
        </nav>}
      </section>
    </main>
  );
}
