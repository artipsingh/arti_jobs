import { useState, useEffect, useRef } from "react";
import INITIAL_JOBS from "../data/initialJobs.js";
import { FIT_COLORS, STATUS_OPTIONS } from "./constants.js";
import { evaluateJob } from "./api/evaluateJob.js";
import { JobCard } from "./components/JobCard.jsx";
import { JobDetail } from "./components/JobDetail.jsx";
import { SYSTEM_PROMPT } from "./prompts/systemPrompt.js";
import { downloadCSV, csvToJobs } from "./utils/csv.js";

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
      const result = await evaluateJob(posting, SYSTEM_PROMPT);
      setEvaluationResult(result);
    } catch (err) {
      setError("Evaluation failed. Check the posting and try again.");
    } finally {
      setLoading(false);
    }
  }

  function addToTracker() {
    if (!evaluationResult) return;
    const newJob = {
      ...evaluationResult,
      id: Date.now(),
      status: "Considering 🤔",
      dateAdded: new Date().toISOString().split("T")[0]
    };
    setJobs(prev => [newJob, ...prev]);
    setEvaluationResult(null);
    setPosting("");
    setView("dashboard");
  }

  function updateStatus(id, status) {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, status } : j));
    setSelectedJob(prev => prev?.id === id ? { ...prev, status } : prev);
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

  return (
    <div style={{ fontFamily: "'DM Mono', 'Courier New', monospace", background: "#0a0a0f", minHeight: "100vh", color: "#e2e8f0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0a0a0f; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
        .card { background: #0f1117; border: 1px solid #1e2535; border-radius: 12px; transition: all 0.2s ease; }
        .card:hover { border-color: #2d3a52; }
        .btn-primary { background: #6366f1; color: white; border: none; border-radius: 8px; padding: 10px 20px; cursor: pointer; font-family: 'DM Mono', monospace; font-size: 13px; transition: all 0.2s; }
        .btn-primary:hover { background: #4f46e5; transform: translateY(-1px); }
        .btn-primary:disabled { background: #2d3a52; cursor: not-allowed; transform: none; }
        .btn-ghost { background: transparent; color: #94a3b8; border: 1px solid #1e2535; border-radius: 8px; padding: 8px 16px; cursor: pointer; font-family: 'DM Mono', monospace; font-size: 13px; transition: all 0.2s; }
        .btn-ghost:hover { border-color: #6366f1; color: #e2e8f0; }
        .btn-ghost.active { border-color: #6366f1; color: #6366f1; background: #6366f115; }
        textarea { background: #070709; border: 1px solid #1e2535; border-radius: 8px; color: #e2e8f0; padding: 16px; font-family: 'DM Mono', monospace; font-size: 12px; resize: vertical; width: 100%; outline: none; transition: border 0.2s; }
        textarea:focus { border-color: #6366f1; }
        select { background: #0f1117; border: 1px solid #1e2535; border-radius: 6px; color: #94a3b8; padding: 4px 8px; font-family: 'DM Mono', monospace; font-size: 11px; cursor: pointer; outline: none; }
        select:hover { border-color: #6366f1; }
        .pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .slide-in { animation: slideIn 0.3s ease; }
        @keyframes slideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 500; }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #1e2535", padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "20px", fontWeight: 800, color: "#e2e8f0", letterSpacing: "-0.5px" }}>
            <span style={{ color: "#6366f1" }}>arti</span>.jobs
          </div>
          <div style={{ fontSize: "10px", color: "#475569", marginTop: "2px" }}>job search tracker // march 2026</div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button className={`btn-ghost ${view === "dashboard" ? "active" : ""}`} onClick={() => { setView("dashboard"); setSelectedJob(null); }}>dashboard</button>
          <button className={`btn-ghost ${view === "evaluate" ? "active" : ""}`} onClick={() => { setView("evaluate"); setSelectedJob(null); }}>+ evaluate</button>
          <div style={{ width: "1px", height: "20px", background: "#1e2535", margin: "0 4px" }} />
          <button className="btn-ghost" onClick={() => downloadCSV(jobs)} style={{ fontSize: "11px" }}>export csv</button>
          <button className="btn-ghost" onClick={() => importRef.current.click()} style={{ fontSize: "11px" }}>import csv</button>
          <input ref={importRef} type="file" accept=".csv" onChange={importCSV} style={{ display: "none" }} />
        </div>
      </div>

      <div style={{ padding: "32px", maxWidth: "1100px", margin: "0 auto" }}>

        {/* Stats Bar */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "32px" }}>
          {[
            { label: "total roles", value: stats.total, color: "#6366f1" },
            { label: "strong fit", value: stats.strong, color: "#10b981" },
            { label: "applied", value: stats.applied, color: "#f59e0b" },
            { label: "skipped", value: stats.skip, color: "#ef4444" },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: "20px 24px" }}>
              <div style={{ fontSize: "32px", fontWeight: 800, fontFamily: "'Syne', sans-serif", color: s.color }}>{s.value}</div>
              <div style={{ fontSize: "10px", color: "#475569", marginTop: "4px", textTransform: "uppercase", letterSpacing: "1px" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Dashboard View */}
        {view === "dashboard" && !selectedJob && (
          <div className="slide-in">
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {jobs.map(job => (
                <JobCard key={job.id} job={job} colors={colors} onSelect={setSelectedJob} onStatusChange={updateStatus} />
              ))}
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
              value={posting}
              onChange={e => setPosting(e.target.value)}
              placeholder="paste job posting here..."
              rows={14}
              style={{ marginBottom: "16px" }}
            />

            <div style={{ display: "flex", gap: "10px", marginBottom: "24px" }}>
              <button className="btn-primary" onClick={evaluatePosting} disabled={loading || !posting.trim()}>
                {loading ? <span className="pulse">evaluating...</span> : "evaluate posting →"}
              </button>
              {posting && <button className="btn-ghost" onClick={() => { setPosting(""); setEvaluationResult(null); setError(""); }}>clear</button>}
            </div>

            {error && (
              <div style={{ background: "#1f0a0a", border: "1px solid #ef444430", borderRadius: "8px", padding: "16px", color: "#fca5a5", fontSize: "12px", marginBottom: "16px" }}>
                {error}
              </div>
            )}

            {evaluationResult && (
              <div className="card slide-in" style={{ padding: "28px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
                  <div>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "20px", color: "#e2e8f0" }}>{evaluationResult.company}</div>
                    <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>{evaluationResult.role}</div>
                    <div style={{ fontSize: "12px", color: "#475569", marginTop: "4px" }}>{evaluationResult.salary}</div>
                  </div>
                  <span className={`tag ${colors(evaluationResult.fitScore).bg} ${colors(evaluationResult.fitScore).text}`} style={{ fontSize: "13px", padding: "6px 14px" }}>
                    {evaluationResult.fitScore}
                  </span>
                </div>

                <div style={{ background: "#070709", borderRadius: "8px", padding: "14px", marginBottom: "20px", borderLeft: "3px solid #6366f1" }}>
                  <div style={{ fontSize: "10px", color: "#475569", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "1px" }}>verdict</div>
                  <div style={{ fontSize: "13px", color: "#cbd5e1" }}>{evaluationResult.verdict}</div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                  <div>
                    <div style={{ fontSize: "10px", color: "#475569", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "1px" }}>✓ strengths</div>
                    {evaluationResult.strengths?.map((s, i) => (
                      <div key={i} style={{ fontSize: "12px", color: "#86efac", padding: "3px 0" }}>+ {s}</div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: "10px", color: "#475569", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "1px" }}>✗ gaps</div>
                    {evaluationResult.gaps?.map((g, i) => (
                      <div key={i} style={{ fontSize: "12px", color: "#fca5a5", padding: "3px 0" }}>— {g}</div>
                    ))}
                  </div>
                </div>

                <div style={{ fontSize: "11px", color: "#475569", marginBottom: "16px" }}>
                  recommendation: <span style={{ color: "#a5b4fc" }}>{evaluationResult.recommendation}</span>
                </div>

                <button className="btn-primary" onClick={addToTracker}>add to tracker →</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}