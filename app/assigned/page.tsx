'use client';

import axios from "axios";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AssignedCase, AssignedCasesResponse, CaseStatus } from "@/features/case/case.types";

type CaseNode = {
  _id: string;
  caseId: string;
  type: "QUESTION" | "OUTCOME";
  parentId?: string | null;
  question?: { text?: string; answerType?: string; options?: { value: string; label: string }[] };
  answer?: { value?: unknown; label?: string | null };
  outcome?: { code?: string; label?: string };
};

type CaseNodesResponse = { success: boolean; data: CaseNode[] };

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
  const [selectedCase, setSelectedCase] = useState<AssignedCase | null>(null);
  const [nodes, setNodes] = useState<CaseNode[]>([]);
  const [nodeLoading, setNodeLoading] = useState(false);
  const [nodeError, setNodeError] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [answerType, setAnswerType] = useState("TEXT");
  const [optionsText, setOptionsText] = useState("");
  const [outcomeLabel, setOutcomeLabel] = useState("");
  const [outcomeStatus, setOutcomeStatus] = useState<"COMPLETED" | "REJECTED" | "CANCELLED">("COMPLETED");
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const loadCases = () => {
    setLoading(true);
    setError("");
    return axios.get<AssignedCasesResponse>("/api/cases")
      .then((response) => setCases(response.data.data || []))
      .catch(() => setError("Unable to load your assigned leads right now. Please try again."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let active = true;
    axios.get<AssignedCasesResponse>("/api/cases")
      .then((response) => { if (active) setCases(response.data.data || []); })
      .catch(() => { if (active) setError("Unable to load your assigned leads right now. Please try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const openCase = async (assignedCase: AssignedCase) => {
    setSelectedCase(assignedCase);
    setNodeLoading(true);
    setNodeError("");
    try {
      const response = await axios.get<CaseNodesResponse>(`/api/cases/node?caseId=${assignedCase._id}`);
      setNodes(response.data.data || []);
    } catch {
      setNodeError("This case path could not be loaded.");
      setNodes([]);
    } finally {
      setNodeLoading(false);
    }
  };

  const createNode = async (type: "QUESTION" | "OUTCOME") => {
    if (!selectedCase) return;
    setSaving(true);
    setNodeError("");
    try {
      const lastNode = nodes[nodes.length - 1];
      const payload = type === "QUESTION" ? {
        caseId: selectedCase._id,
        parentId: lastNode?._id || null,
        type,
        question: {
          text: questionText.trim(),
          answerType,
          options: optionsText.split(",").map((option) => option.trim()).filter(Boolean).map((option) => ({ value: option, label: option })),
        },
      } : {
        caseId: selectedCase._id,
        parentId: lastNode?._id || null,
        type,
        status: outcomeStatus,
        outcome: { code: outcomeStatus.toLowerCase(), label: outcomeLabel.trim() },
      };
      const response = await axios.post<{ data: CaseNode }>("/api/cases/node", payload);
      setNodes((current) => [...current, response.data.data]);
      setCases((current) => current.map((item) => item._id === selectedCase._id ? {
        ...item,
        status: type === "OUTCOME" ? outcomeStatus : item.status === "ASSIGNED" ? "IN_PROGRESS" : item.status,
      } : item));
      setSelectedCase((current) => current ? { ...current, status: type === "OUTCOME" ? outcomeStatus : current.status === "ASSIGNED" ? "IN_PROGRESS" : current.status } : current);
      setQuestionText("");
      setOptionsText("");
      setOutcomeLabel("");
    } catch (error) {
      setNodeError(axios.isAxiosError(error) ? error.response?.data?.message || "Unable to update this case." : "Unable to update this case.");
    } finally {
      setSaving(false);
    }
  };

  const submitAnswer = async (node: CaseNode) => {
    if (!selectedCase || !answerDrafts[node._id]?.trim()) return;
    setSaving(true);
    setNodeError("");
    try {
      const response = await axios.post<{ data: CaseNode }>("/api/cases/node", {
        action: "answer",
        caseId: selectedCase._id,
        nodeId: node._id,
        answer: { value: answerDrafts[node._id].trim() },
      });
      setNodes((current) => current.map((item) => item._id === node._id ? response.data.data : item));
    } catch (error) {
      setNodeError(axios.isAxiosError(error) ? error.response?.data?.message || "Unable to save the answer." : "Unable to save the answer.");
    } finally {
      setSaving(false);
    }
  };

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
              return <article className={`assigned-card${selectedCase?._id === assignedCase._id ? " is-selected" : ""}`} key={assignedCase._id}>
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
                <div className="assigned-card-actions"><a className="assigned-contact" href={lead?.contact?.phone ? `tel:${lead.contact.phone}` : undefined} aria-disabled={!lead?.contact?.phone}>Contact borrower <span>→</span></a><button className="process-case" type="button" onClick={() => void openCase(assignedCase)}>Process case <span>↗</span></button></div>
              </article>;
            })}
          </div>
          {visibleCases.length === 0 && <p className="leads-state">No assigned leads match these filters.</p>}
        </section>
      )}
      {selectedCase && <section className="case-workbench" aria-labelledby="case-workbench-title">
        <div className="case-workbench-heading"><div><span className="section-kicker">active case path</span><h2 id="case-workbench-title">Build the borrower’s <em>next step.</em></h2></div><button className="close-workbench" type="button" onClick={() => setSelectedCase(null)} aria-label="Close case workspace">Close ×</button></div>
        <div className="case-workbench-grid">
          <aside className="case-context"><span className="case-context-label">borrower context</span><h3>{selectedCase.leadId?.personal?.firstName} {selectedCase.leadId?.personal?.lastName}</h3><p>{selectedCase.leadId?._doc_id || "Lead ID unavailable"}</p><dl><div><dt>Phone</dt><dd>{selectedCase.leadId?.contact?.phone || "-"}</dd></div><div><dt>Income</dt><dd>{selectedCase.leadId?.employment?.income ? `₹${selectedCase.leadId.employment.income.toLocaleString("en-IN")}` : "-"}</dd></div><div><dt>Credit</dt><dd>{selectedCase.leadId?.credit?.creditScore || "-"}</dd></div><div><dt>Purpose</dt><dd>{selectedCase.leadId?.loan?.purpose || "-"}</dd></div></dl><span className={`case-status case-status-${selectedCase.status.toLowerCase()}`}>{formatStatus(selectedCase.status)}</span></aside>
          <div className="case-path-panel">
            {nodeError && <p className="case-node-error">{nodeError}</p>}
            {nodeLoading ? <p className="leads-state">Loading case path...</p> : <>
              <div className="case-path-list">{nodes.length === 0 && <p className="case-path-empty">No questions yet. Start the path with the first question below.</p>}{nodes.map((node, index) => <article className={`case-node case-node-${node.type.toLowerCase()}`} key={node._id}><span className="case-node-index">{String(index + 1).padStart(2, "0")}</span><div className="case-node-body"><span className="case-node-type">{node.type === "QUESTION" ? "Question" : "Outcome"}</span>{node.type === "QUESTION" ? <><h3>{node.question?.text}</h3>{node.answer?.value !== undefined && node.answer?.value !== null ? <p className="node-answer"><span>Answer</span>{String(node.answer.label || node.answer.value)}</p> : <div className="node-answer-form"><input value={answerDrafts[node._id] || ""} onChange={(event) => setAnswerDrafts((current) => ({ ...current, [node._id]: event.target.value }))} placeholder={node.question?.answerType === "BOOLEAN" ? "yes or no" : "Record an answer"} aria-label={`Answer: ${node.question?.text}`} /><button type="button" onClick={() => void submitAnswer(node)} disabled={saving || !answerDrafts[node._id]?.trim()}>Save answer</button></div>}</> : <><h3>{node.outcome?.label}</h3><p className="node-answer"><span>Case result</span>{node.outcome?.code}</p></>}</div></article>)}</div>
              {!(["COMPLETED", "REJECTED", "CANCELLED"] as string[]).includes(selectedCase.status) && <div className="node-builder"><div className="builder-heading"><span className="case-node-type">Add to path</span><span>{nodes.length ? `Follows node ${String(nodes.length).padStart(2, "0")}` : "First node"}</span></div><label>New question<textarea value={questionText} onChange={(event) => setQuestionText(event.target.value)} placeholder="What should the agent learn next?" rows={2} /></label><div className="builder-row"><label>Answer format<select value={answerType} onChange={(event) => setAnswerType(event.target.value)}><option value="TEXT">Text</option><option value="NUMBER">Number</option><option value="BOOLEAN">Yes / no</option><option value="SINGLE_SELECT">Single choice</option><option value="MULTI_SELECT">Multiple choice</option></select></label><label>Choice options<input value={optionsText} onChange={(event) => setOptionsText(event.target.value)} placeholder="Separate with commas" /></label></div><button className="builder-primary" type="button" onClick={() => void createNode("QUESTION")} disabled={saving || !questionText.trim()}>Add question <span>+</span></button><div className="outcome-builder"><label>Close with outcome<input value={outcomeLabel} onChange={(event) => setOutcomeLabel(event.target.value)} placeholder="e.g. Ready for documentation" /></label><select value={outcomeStatus} onChange={(event) => setOutcomeStatus(event.target.value as typeof outcomeStatus)} aria-label="Outcome status"><option value="COMPLETED">Complete</option><option value="REJECTED">Reject</option><option value="CANCELLED">Cancel</option></select><button className="builder-secondary" type="button" onClick={() => void createNode("OUTCOME")} disabled={saving || !outcomeLabel.trim()}>Finish case</button></div></div>}
            </>}
          </div>
        </div>
      </section>}
    </main>
  );
}
