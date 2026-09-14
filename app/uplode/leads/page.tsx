"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";

type ImportError = { row: number; message: string };
type ImportResult = { success: boolean; message: string; errors?: ImportError[] };

const template = `_doc_id,firstName,lastName,phone,dob,creditScore,employmentTypes,personalEmail,address1,address2,city,state,pinCode,companyName,monthlyIncome,loanAmount
LEAD-001,Anika,Sharma,9876543210,1992-06-15,742,salaried,anika@example.com,14 Lake View Road,Flat 3B,Pune,Maharashtra,411001,Northstar Finance,85000,1200000`;

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const chooseFile = (candidate: File | undefined) => {
    setResult(null);
    if (!candidate) return;
    if (!candidate.name.toLowerCase().endsWith(".csv")) {
      setResult({ success: false, message: "Choose a file with a .csv extension." });
      setFile(null);
      return;
    }
    setFile(candidate);
  };
  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => chooseFile(event.target.files?.[0]);
  const onDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0]); };
  const upload = async () => {
    if (!file || uploading) return;
    setUploading(true); setResult(null);
    try {
      const body = new FormData(); body.append("file", file);
      const response = await fetch("/api/leads", { method: "POST", body });
      const data = (await response.json()) as ImportResult;
      setResult(data); if (response.ok) setFile(null);
    } catch { setResult({ success: false, message: "The import could not reach the server. Check your connection and try again." }); }
    finally { setUploading(false); }
  };
  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([template], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "lead-import-template.csv"; link.click(); URL.revokeObjectURL(url);
  };

  return <main className="workspace-shell">
    <section className="hero-section"><div className="eyebrow"><span>01</span> Lead intake</div><div className="hero-grid"><div><h1>Bring your borrower data <em>into focus.</em></h1><p className="hero-copy">Import a clean CSV and turn every row into a structured lead record, ready for the next conversation.</p></div><div className="hero-note"><span className="note-line" /><p>One row becomes one lead.<br />Addresses stay together.</p></div></div></section>
    <section className="work-area"><div className="section-heading"><div><span className="section-kicker">Import centre</span><h2>Upload your lead file</h2></div><button className="template-button" onClick={downloadTemplate} type="button"><span>↓</span> Download template</button></div>
      <div className={`drop-zone ${dragging ? "is-dragging" : ""} ${file ? "has-file" : ""}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={onDrop} onClick={() => inputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }}>
        <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={onFileChange} hidden /><div className="upload-symbol">↥</div>{file ? <><p className="drop-title">{file.name}</p><p className="drop-subtitle">{(file.size / 1024).toFixed(1)} KB · Ready to import</p></> : <><p className="drop-title">Drop your CSV here</p><p className="drop-subtitle">or click to browse from your computer</p></>}<span className="file-rule">CSV files only · UTF-8 recommended</span>
      </div>
      <div className="action-row"><p className="mapping-hint"><span>↳</span> Required: _doc_id, first name, last name, phone, DOB, credit score, employment type</p><button className="import-button" type="button" onClick={upload} disabled={!file || uploading}>{uploading ? "Importing rows…" : "Import leads"}<span>→</span></button></div>
      {result && <section className={`result-panel ${result.success ? "success" : "failure"}`} aria-live="polite"><div className="result-icon">{result.success ? "✓" : "!"}</div><div className="result-content"><strong>{result.message}</strong>{result.errors?.length ? <div className="error-list">{result.errors.slice(0, 5).map((error) => <p key={`${error.row}-${error.message}`}>Row {error.row}: {error.message}</p>)}</div> : <p>Validated records are now available in your leads collection.</p>}</div></section>}
      <div className="schema-strip"><div><span className="schema-number">A</span><span><strong>Addresses supported</strong><small>address1 and address2 are stored on the same lead</small></span></div><div><span className="schema-number">B</span><span><strong>Flexible headers</strong><small>first_name and firstName both work</small></span></div><div><span className="schema-number">C</span><span><strong>Row-level feedback</strong><small>Invalid rows return with their line number</small></span></div></div>
    </section><footer><span>© 2026 Lendere</span><span>Lead operations / Import centre</span></footer>
  </main>;
}
