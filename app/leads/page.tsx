"use client"

import axios from "axios";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Lead, LeadFilters, Agent, Eligibility } from "@/features/leads/leads.type";
import RangeSlider from "@/component/range-slider";

type FilterSectionKey = "profile" | "credit" | "location";

const employmentOptions: Record<string, string> = {
  salaried: "Salaried",
  self_employed: "Self-employed",
  business: "Business",
  professional: "Professional",
};

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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [openSections, setOpenSections] = useState<Record<FilterSectionKey, boolean>>({
    profile: true,
    credit: true,
    location: true,
  });
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

  const toNumberOrEmpty = (value: string) => {
    if (value === "") return "";
    const num = Number(value);
    return Number.isFinite(num) ? num : "";
  };

  const ageBounds = useMemo<{ min: number; max: number }>(() => {
    if (eligibility) {
      return {
        min: Math.max(18, eligibility.age.min - 5),
        max: Math.max(eligibility.age.max + 10, 80),
      };
    }
    return { min: 18, max: 80 };
  }, [eligibility]);

  const incomeBounds = useMemo<{ min: number; max: number; step: number }>(() => {
    const baseMin = eligibility?.income.minAnnual ?? 100000;
    const min = Math.max(0, baseMin - 100000);
    const max = Math.max(baseMin * 6, 5000000);
    return { min, max, step: 25000 };
  }, [eligibility]);

  const creditBounds = useMemo<{ min: number; max: number; step: number }>(() => {
    if (eligibility) {
      return {
        min: Math.max(300, eligibility.creditScore.minExclusive - 50),
        max: Math.min(900, eligibility.creditScore.maxInclusive + 50),
        step: 10,
      };
    }
    return { min: 300, max: 900, step: 10 };
  }, [eligibility]);

  const loanBounds = useMemo<{ min: number; max: number; step: number }>(() => {
    return { min: 0, max: 10000000, step: 50000 };
  }, []);

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

  const toggleSection = (section: FilterSectionKey) => {
    setOpenSections((current) => ({ ...current, [section]: !current[section] }));
  };

  const toggleEmployment = (type: string) => {
    setFilters((current) => ({
      ...current,
      employmentType: current.employmentType.includes(type)
        ? current.employmentType.filter((item) => item !== type)
        : [...current.employmentType, type],
    }));
  };

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string }> = [];
    if (filters.search) chips.push({ key: "search", label: `Search: ${filters.search}` });
    if (filters.ageMin || filters.ageMax) {
      chips.push({ key: "age", label: `Age: ${filters.ageMin || "0"}–${filters.ageMax || "∞"}` });
    }
    if (filters.incomeMin || filters.incomeMax) {
      chips.push({
        key: "income",
        label: `Income: ${filters.incomeMin ? "₹" + Number(filters.incomeMin).toLocaleString() : "0"}–${filters.incomeMax ? "₹" + Number(filters.incomeMax).toLocaleString() : "∞"}`,
      });
    }
    if (filters.creditMin || filters.creditMax) {
      chips.push({ key: "credit", label: `Credit: ${filters.creditMin || "0"}–${filters.creditMax || "∞"}` });
    }
    if (filters.employmentType.length > 0) {
      chips.push({
        key: "emp",
        label: `Employment: ${filters.employmentType.map((t) => employmentOptions[t] ?? t).join(", ")}`,
      });
    }
    if (filters.state || filters.city || filters.pincode) {
      chips.push({
        key: "loc",
        label: `Location: ${[filters.state, filters.city, filters.pincode].filter(Boolean).join(", ") || "set"}`,
      });
    }
    if (filters.loanAmountMin || filters.loanAmountMax) {
      chips.push({
        key: "loanamt",
        label: `Loan amount: ${filters.loanAmountMin ? "₹" + Number(filters.loanAmountMin).toLocaleString() : "0"}–${filters.loanAmountMax ? "₹" + Number(filters.loanAmountMax).toLocaleString() : "∞"}`,
      });
    }
    if (filters.loanPurpose) chips.push({ key: "loanpurpose", label: `Purpose: ${filters.loanPurpose}` });
    return chips;
  }, [filters]);

  const clearChip = (key: string) => {
    setFilters((current) => {
      switch (key) {
        case "search":
          return { ...current, search: "" };
        case "age":
          return { ...current, ageMin: "", ageMax: "" };
        case "income":
          return { ...current, incomeMin: "", incomeMax: "" };
        case "credit":
          return { ...current, creditMin: "", creditMax: "" };
        case "emp":
          return { ...current, employmentType: [] };
        case "loc":
          return { ...current, state: "", city: "", pincode: "" };
        case "loanamt":
          return { ...current, loanAmountMin: "", loanAmountMax: "" };
        case "loanpurpose":
          return { ...current, loanPurpose: "" };
        default:
          return current;
      }
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
  const applyFromButton = () => {
    getLeads(1, filters).catch(() => {
      setError("Unable to apply these filters right now. Please try again.");
      setLoading(false);
    });
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
        {activeFilterChips.length > 0 && (
          <div className="leads-toolbar">
            <div className="leads-chip-wrap" role="list" aria-label="Active filters">
              {activeFilterChips.map((chip) => (
                <button key={chip.key} type="button" className="leads-chip" onClick={() => clearChip(chip.key)} aria-label={`Remove filter ${chip.label}`}>
                  <span>{chip.label}</span><span aria-hidden="true">×</span>
                </button>
              ))}
            </div>
            <button className="leads-clear-chips" type="button" onClick={clearFilters}>Clear all</button>
            <button type="button" className="leads-sidebar-toggle" aria-label="Toggle filter sidebar" onClick={() => setSidebarOpen((cur) => !cur)}>
              <span className="leads-sidebar-icon" aria-hidden="true" />
              Filters
            </button>
          </div>
        )}
      </section>

      <div className={`leads-workspace ${sidebarOpen ? "is-sidebar-open" : ""}`}>
        <aside className="leads-sidebar" aria-label="Filter sidebar">
          <div className="sidebar-header">
            <div>
              <span className="sidebar-kicker">refine results</span>
              <h2>Find a lead</h2>
            </div>
            <button className="sidebar-close" type="button" onClick={() => setSidebarOpen(false)} aria-label="Close filter sidebar">×</button>
          </div>

          <label className="sidebar-search">
            <span>Search name, phone, or lead ID</span>
            <div className="sidebar-search-field">
              <span className="sidebar-search-icon" aria-hidden="true">⌕</span>
              <input value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Start typing..." />
            </div>
          </label>

          {eligibility && (
            <div className="sidebar-eligibility">
              <span className="sidebar-kicker">lender eligibility</span>
              <ul>
                <li><span>Age</span><strong>{eligibility.age.min}–{eligibility.age.max}</strong></li>
                <li><span>Income</span><strong>₹{eligibility.income.minAnnual.toLocaleString()}+</strong></li>
                <li><span>Credit</span><strong>{eligibility.creditScore.minExclusive}+ – {eligibility.creditScore.maxInclusive}</strong></li>
                <li><span>Employment</span><strong>{eligibility.employmentTypes.join(", ")}</strong></li>
              </ul>
            </div>
          )}

          <form onSubmit={submitFilters} className="sidebar-form" onReset={(e) => { e.preventDefault(); clearFilters(); }}>
            <section className={`sidebar-section ${openSections.profile ? "is-open" : ""}`}>
              <button type="button" className="sidebar-section-toggle" onClick={() => toggleSection("profile")}>
                <span className="sidebar-section-eyebrow">01</span>
                <span className="sidebar-section-title">
                  <span className="sidebar-section-name">Profile</span>
                  {(filters.ageMin || filters.ageMax || filters.incomeMin || filters.incomeMax || filters.employmentType.length > 0) && (
                    <span className="sidebar-section-count">Updated</span>
                  )}
                </span>
                <span className="sidebar-section-caret" aria-hidden="true">▾</span>
              </button>
              <div className="sidebar-section-body">
                <RangeSlider
                  label="Age"
                  min={ageBounds.min}
                  max={ageBounds.max}
                  step={1}
                  suffix=" yrs"
                  from={toNumberOrEmpty(filters.ageMin)}
                  to={toNumberOrEmpty(filters.ageMax)}
                  onChange={(next) => {
                    setFilters((current) => ({
                      ...current,
                      ageMin: typeof next.from === "number" ? String(next.from) : "",
                      ageMax: typeof next.to === "number" ? String(next.to) : "",
                    }));
                  }}
                />
                <RangeSlider
                  label="Annual income"
                  min={incomeBounds.min}
                  max={incomeBounds.max}
                  step={incomeBounds.step}
                  prefix="₹"
                  from={toNumberOrEmpty(filters.incomeMin)}
                  to={toNumberOrEmpty(filters.incomeMax)}
                  onChange={(next) => {
                    setFilters((current) => ({
                      ...current,
                      incomeMin: typeof next.from === "number" ? String(next.from) : "",
                      incomeMax: typeof next.to === "number" ? String(next.to) : "",
                    }));
                  }}
                />
                <div className="sidebar-employment">
                  <span className="sidebar-field-label">Employment type</span>
                  <div className="sidebar-chips" role="group" aria-label="Employment type filters">
                    {(eligibility?.employmentTypes || []).map((type) => {
                      const active = filters.employmentType.includes(type);
                      return (
                        <button
                          key={type}
                          type="button"
                          className={`sidebar-chip ${active ? "is-active" : ""}`}
                          aria-pressed={active}
                          onClick={() => toggleEmployment(type)}
                        >
                          {employmentOptions[type] ?? type.replaceAll("_", " ")}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            <section className={`sidebar-section ${openSections.credit ? "is-open" : ""}`}>
              <button type="button" className="sidebar-section-toggle" onClick={() => toggleSection("credit")}>
                <span className="sidebar-section-eyebrow">02</span>
                <span className="sidebar-section-title">
                  <span className="sidebar-section-name">Credit &amp; loan</span>
                  {(filters.creditMin || filters.creditMax || filters.loanAmountMin || filters.loanAmountMax || filters.loanPurpose) && (
                    <span className="sidebar-section-count">Updated</span>
                  )}
                </span>
                <span className="sidebar-section-caret" aria-hidden="true">▾</span>
              </button>
              <div className="sidebar-section-body">
                <RangeSlider
                  label="Credit score"
                  min={creditBounds.min}
                  max={creditBounds.max}
                  step={creditBounds.step}
                  from={toNumberOrEmpty(filters.creditMin)}
                  to={toNumberOrEmpty(filters.creditMax)}
                  onChange={(next) => {
                    setFilters((current) => ({
                      ...current,
                      creditMin: typeof next.from === "number" ? String(next.from) : "",
                      creditMax: typeof next.to === "number" ? String(next.to) : "",
                    }));
                  }}
                />
                <RangeSlider
                  label="Loan amount"
                  min={loanBounds.min}
                  max={loanBounds.max}
                  step={loanBounds.step}
                  prefix="₹"
                  from={toNumberOrEmpty(filters.loanAmountMin)}
                  to={toNumberOrEmpty(filters.loanAmountMax)}
                  onChange={(next) => {
                    setFilters((current) => ({
                      ...current,
                      loanAmountMin: typeof next.from === "number" ? String(next.from) : "",
                      loanAmountMax: typeof next.to === "number" ? String(next.to) : "",
                    }));
                  }}
                />
                <label className="sidebar-wide">Loan purpose<input value={filters.loanPurpose} onChange={(event) => updateFilter("loanPurpose", event.target.value)} placeholder="e.g. home, personal, business" /></label>
              </div>
            </section>

            <section className={`sidebar-section ${openSections.location ? "is-open" : ""}`}>
              <button type="button" className="sidebar-section-toggle" onClick={() => toggleSection("location")}>
                <span className="sidebar-section-eyebrow">03</span>
                <span className="sidebar-section-title">
                  <span className="sidebar-section-name">Location</span>
                  {(filters.state || filters.city || filters.pincode) && (
                    <span className="sidebar-section-count">Updated</span>
                  )}
                </span>
                <span className="sidebar-section-caret" aria-hidden="true">▾</span>
              </button>
              <div className="sidebar-section-body">
                <div className="sidebar-field">
                  <label>State<input value={filters.state} onChange={(event) => updateFilter("state", event.target.value)} placeholder="e.g. Maharashtra" /></label>
                  <label>City<input value={filters.city} onChange={(event) => updateFilter("city", event.target.value)} placeholder="e.g. Mumbai" /></label>
                </div>
                <label className="sidebar-wide">Pincode<input value={filters.pincode} onChange={(event) => updateFilter("pincode", event.target.value)} placeholder="e.g. 400001" /></label>
              </div>
            </section>

            <div className="sidebar-footer">
              <label className="sidebar-sort">
                <span>Sort by</span>
                <select value={filters.sort} onChange={(event) => updateFilter("sort", event.target.value)}>
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="highestCreditScore">Highest credit score</option>
                  <option value="highestIncome">Highest income</option>
                </select>
              </label>
              <div className="sidebar-actions">
                <button type="reset" className="sidebar-reset">Reset</button>
                <button type="submit" className="sidebar-apply" disabled={loading}>
                  Apply<span>→</span>
                </button>
              </div>
            </div>
          </form>
        </aside>

        {sidebarOpen && <div className="leads-sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-hidden="true" />}

        <section className="leads-content">
          <div className="leads-content-toolbar">
            <button type="button" className="leads-filter-button" onClick={() => setSidebarOpen(true)} aria-label="Open filter sidebar">
              <span className="leads-sidebar-icon" aria-hidden="true" />
              Filters
              {activeFilterChips.length > 0 && <span className="leads-filter-count">{activeFilterChips.length}</span>}
            </button>
            <div className="leads-results-label">
              <span className="sidebar-kicker">results</span>
              <strong>{leads.length}</strong>
              <span> of {totalCount}</span>
            </div>
            <label className="leads-sort-inline" title="Sort leads">
              <select value={filters.sort} onChange={(event) => { updateFilter("sort", event.target.value); applyFromButton(); }}>
                <option value="newest">Sort: Newest</option>
                <option value="oldest">Sort: Oldest</option>
                <option value="highestCreditScore">Sort: Highest credit</option>
                <option value="highestIncome">Sort: Highest income</option>
              </select>
            </label>
          </div>
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
      </div>
    </main>
  );
}
