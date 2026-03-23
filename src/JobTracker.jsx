import { useState, useEffect, useRef } from "react";
import INITIAL_JOBS from "../data/initialJobs.js";
import { FIT_COLORS, STATUS_OPTIONS } from "./constants.js";
import { evaluateJob } from "./api/evaluateJob.js";
import { JobCard } from "./components/JobCard.jsx";
import { JobDetail } from "./components/JobDetail.jsx";
import { buildSystemPrompt } from "./prompts/systemPrompt.js";
import { downloadCSV, csvToJobs } from "./utils/csv.js";
import "./styles/global.css";

const STORAGE_KEY = "arti-jobs";

export default function JobTracker() {
  const [jobs, setJobs] = useState(INITIAL_JOBS);
  const [jobsLoaded, setJobsLoaded] = useState(false);
  const importRef = useRef(null);

  // Load from file on startup, fall back to localStorage for migration
  useEffect(() => {
    fetch('/api/jobs')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setJobs(data);
        } else {
          try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) setJobs(JSON.parse(saved));
          } catch {}
        }
        setJobsLoaded(true);
      })
      .catch(() => {
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) setJobs(JSON.parse(saved));
        } catch {}
        setJobsLoaded(true);
      });
  }, []);
  const [view, setView] = useState("dashboard");
  const [posting, setPosting] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedJob, setSelectedJob] = useState(null);
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterFit, setFilterFit] = useState("All");

  const stats = {
    total: jobs.length,
    strong: jobs.filter(j => j.fitScore === "Strong").length,
    applied: jobs.filter(j => j.status?.includes("Applied")).length,
    skip: jobs.filter(j => j.fitScore === "Skip").length,
  };
  async function evaluatePosting() {
    if (!posting.trim()) return;
    setLoading(true);
    setError("");
    setEvaluationResult(null);
    try {
      const result = await evaluateJob(posting, buildSystemPrompt());
      setEvaluationResult(result);
    } catch (err) {
      setError(err.message || "Evaluation failed. Check the posting and try again.");
    } finally {
      setLoading(false);
    }
  }

  function addToTracker() {
    if (!evaluationResult) return;
    const dateAdded = new Date().toISOString().split("T")[0];
    const newJob = {
      ...evaluationResult,
      id: Date.now(),
      status: "Considering 🤔",
      dateAdded,
      statusHistory: [{ status: "Considering 🤔", date: dateAdded }],
    };
    setJobs(prev => [newJob, ...prev]);
    setEvaluationResult(null);
    setPosting("");
    setView("dashboard");
  }

  function updateStatus(id, status) {
    const date = new Date().toISOString().split("T")[0];
    const appendHistory = (j) => ({
      ...j,
      status,
      statusHistory: [...(j.statusHistory || []), { status, date }],
    });
    setJobs(prev => prev.map(j => j.id === id ? appendHistory(j) : j));
    setSelectedJob(prev => prev?.id === id ? appendHistory(prev) : prev);
  }

  function updateField(id, field, value) {
    const updater = (j) => {
      const updated = { ...j, [field]: value };
      if (field === "appliedDate" && value) {
        const alreadyLogged = (j.statusHistory || []).some(
          e => e.status === "Applied ✅" && e.date === value
        );
        if (!alreadyLogged) {
          updated.statusHistory = [...(j.statusHistory || []), { status: "Applied ✅", date: value }];
        }
      }
      return updated;
    };
    setJobs(prev => prev.map(j => j.id === id ? updater(j) : j));
    setSelectedJob(prev => prev?.id === id ? updater(prev) : prev);
  }

  function deleteJob(id) {
    setJobs(prev => prev.filter(j => j.id !== id));
    setSelectedJob(null);
  }

  // Save to file whenever jobs change (after initial load)
  useEffect(() => {
    if (!jobsLoaded) return;
    fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jobs),
    }).catch(() => {});
  }, [jobs, jobsLoaded]);

  function importCSV(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = csvToJobs(ev.target.result);
        setJobs(imported);
      } catch {
        alert("Failed to parse CSV. Make sure it was exported from arti.jobs.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  const colors = (score) => FIT_COLORS[score] || FIT_COLORS.Moderate;

  const visibleJobs = jobs
    .filter(j => filterStatus === "All" || j.status === filterStatus)
    .filter(j => filterFit === "All" || j.fitScore === filterFit);

  return (
    <div>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #1e2535", padding: "20px 0" }}>
        <div className="header-inner">
        <div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "20px", fontWeight: 800, color: "#e2e8f0", letterSpacing: "-0.5px" }}>
            <span style={{ color: "#6366f1" }}>arti</span>.jobs
          </div>
          <div style={{ fontSize: "10px", color: "#475569", marginTop: "2px" }}>job search tracker // march 2026</div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button data-testid="nav-dashboard" className={`btn-ghost ${view === "dashboard" ? "active" : ""}`} onClick={() => { setView("dashboard"); setSelectedJob(null); }}>dashboard</button>
          <button data-testid="nav-evaluate" className={`btn-ghost ${view === "evaluate" ? "active" : ""}`} onClick={() => { setView("evaluate"); setSelectedJob(null); }}>+ evaluate</button>
          <div style={{ width: "1px", height: "20px", background: "#1e2535", margin: "0 4px" }} />
          <button data-testid="btn-export-csv" className="btn-ghost" onClick={() => downloadCSV(jobs)} style={{ fontSize: "11px" }}>export csv</button>
          <button data-testid="btn-import-csv" className="btn-ghost" onClick={() => importRef.current.click()} style={{ fontSize: "11px" }}>import csv</button>
          <input ref={importRef} type="file" accept=".csv" onChange={importCSV} style={{ display: "none" }} />
        </div>
        </div>
      </div>

      <div className="page-container">

        {/* Stats Bar */}
        <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "32px" }}>
          {[
            { label: "total roles", value: stats.total, color: "#6366f1", testid: "stat-total" },
            { label: "strong fit", value: stats.strong, color: "#10b981", testid: "stat-strong" },
            { label: "applied", value: stats.applied, color: "#f59e0b", testid: "stat-applied" },
            { label: "skipped", value: stats.skip, color: "#ef4444", testid: "stat-skipped" },
          ].map(s => (
            <div key={s.label} data-testid={s.testid} className="card" style={{ padding: "20px 24px" }}>
              <div style={{ fontSize: "32px", fontWeight: 800, fontFamily: "'Syne', sans-serif", color: s.color }}>{s.value}</div>
              <div style={{ fontSize: "10px", color: "#475569", marginTop: "4px", textTransform: "uppercase", letterSpacing: "1px" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Dashboard View */}
        {view === "dashboard" && !selectedJob && (
          <div className="slide-in">
            {/* Filters */}
            <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "16px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "11px", color: "#475569" }}>filter by</span>
              <select
                data-testid="filter-status"
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                style={{ fontSize: "12px", padding: "6px 10px" }}
              >
                <option value="All">all statuses</option>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                data-testid="filter-fit"
                value={filterFit}
                onChange={e => setFilterFit(e.target.value)}
                style={{ fontSize: "12px", padding: "6px 10px" }}
              >
                <option value="All">all recommendations</option>
                {Object.keys(FIT_COLORS).map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              {(filterStatus !== "All" || filterFit !== "All") && (
                <button
                  className="btn-ghost"
                  style={{ fontSize: "11px", padding: "4px 10px", color: "#ef4444", borderColor: "#ef444430" }}
                  onClick={() => { setFilterStatus("All"); setFilterFit("All"); }}
                >clear</button>
              )}
              <span style={{ fontSize: "11px", color: "#475569", marginLeft: "auto" }}>
                {visibleJobs.length} of {jobs.length} roles
              </span>
            </div>

            <div className="job-list-scroll">
              <div data-testid="job-list" style={{ display: "flex", flexDirection: "column", gap: "10px", minWidth: "900px" }}>
                {visibleJobs.map(job => (
                  <JobCard key={job.id} job={job} colors={colors} onSelect={setSelectedJob} onStatusChange={updateStatus} onFieldChange={updateField} onDelete={deleteJob} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Job Detail View */}
        {view === "dashboard" && selectedJob && (
          <JobDetail
            job={selectedJob}
            colors={colors}
            onBack={() => setSelectedJob(null)}
            onStatusChange={updateStatus}
            onDelete={deleteJob}
          />
        )}

        {/* Evaluate View */}
        {view === "evaluate" && (
          <div className="slide-in">
            <div style={{ marginBottom: "24px" }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "16px", color: "#e2e8f0", marginBottom: "4px" }}>evaluate a new role</div>
              <div style={{ fontSize: "12px", color: "#475569" }}>paste the full job posting below and claude will evaluate it against your resume</div>
            </div>

            <textarea
              data-testid="job-posting-input"
              value={posting}
              onChange={e => setPosting(e.target.value)}
              placeholder="paste job posting here..."
              rows={14}
              style={{ marginBottom: "16px" }}
            />

            <div style={{ display: "flex", gap: "10px", marginBottom: "24px" }}>
              <button data-testid="btn-evaluate" className="btn-primary" onClick={evaluatePosting} disabled={loading || !posting.trim()}>
                {loading ? <span className="pulse">evaluating...</span> : "evaluate posting →"}
              </button>
              {posting && <button data-testid="btn-clear" className="btn-ghost" onClick={() => { setPosting(""); setEvaluationResult(null); setError(""); }}>clear</button>}
            </div>

            {error && (
              <div data-testid="evaluate-error" style={{ background: "#1f0a0a", border: "1px solid #ef444430", borderRadius: "8px", padding: "16px", color: "#fca5a5", fontSize: "12px", marginBottom: "16px" }}>
                {error}
              </div>
            )}

            {evaluationResult && (
              <div data-testid="evaluation-result" className="card slide-in" style={{ padding: "28px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
                  <div>
                    <div data-testid="result-company" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "20px", color: "#e2e8f0" }}>{evaluationResult.company}</div>
                    <div data-testid="result-role" style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>{evaluationResult.role}</div>
                    <div data-testid="result-salary" style={{ fontSize: "12px", color: "#475569", marginTop: "4px" }}>{evaluationResult.salary}</div>
                  </div>
                  <span data-testid="result-fit-score" className={`tag ${colors(evaluationResult.fitScore).bg} ${colors(evaluationResult.fitScore).text}`} style={{ fontSize: "13px", padding: "6px 14px" }}>
                    {evaluationResult.fitScore}
                  </span>
                </div>

                <div style={{ background: "#070709", borderRadius: "8px", padding: "14px", marginBottom: "20px", borderLeft: "3px solid #6366f1" }}>
                  <div style={{ fontSize: "10px", color: "#475569", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "1px" }}>verdict</div>
                  <div data-testid="result-verdict" style={{ fontSize: "13px", color: "#cbd5e1" }}>{evaluationResult.verdict}</div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                  <div data-testid="result-strengths">
                    <div style={{ fontSize: "10px", color: "#475569", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "1px" }}>✓ strengths</div>
                    {evaluationResult.strengths?.map((s, i) => (
                      <div key={i} data-testid="strength-item" style={{ fontSize: "12px", color: "#86efac", padding: "3px 0" }}>+ {s}</div>
                    ))}
                  </div>
                  <div data-testid="result-gaps">
                    <div style={{ fontSize: "10px", color: "#475569", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "1px" }}>✗ gaps</div>
                    {evaluationResult.gaps?.map((g, i) => (
                      <div key={i} data-testid="gap-item" style={{ fontSize: "12px", color: "#fca5a5", padding: "3px 0" }}>— {g}</div>
                    ))}
                  </div>
                </div>

                <div data-testid="result-recommendation" style={{ fontSize: "11px", color: "#475569", marginBottom: "16px" }}>
                  recommendation: <span style={{ color: "#a5b4fc" }}>{evaluationResult.recommendation}</span>
                </div>

                <button data-testid="btn-add-to-tracker" className="btn-primary" onClick={addToTracker}>add to tracker →</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}