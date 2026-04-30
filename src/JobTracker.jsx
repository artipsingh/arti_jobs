import { useState } from "react";
import { FIT_COLORS, STATUS_OPTIONS } from "./constants.js";
import { useJobs } from "./hooks/useJobs.js";
import { useEvaluate } from "./hooks/useEvaluate.js";
import { JobCard } from "./components/JobCard.jsx";
import { JobDetail } from "./components/JobDetail.jsx";
import { EvaluateView } from "./components/EvaluateView.jsx";
import { downloadCSV } from "./utils/csv.js";
import "./styles/global.css";

export default function JobTracker() {
  const [view, setView] = useState("dashboard");
  const [selectedJob, setSelectedJob] = useState(null);
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterFit, setFilterFit] = useState("All");

  const { jobs, importRef, updateStatus, updateField, deleteJob, addJob, importCSV } = useJobs();

  const evaluate = useEvaluate((job) => {
    addJob(job);
    setView("dashboard");
  });

  const colors = (score) => FIT_COLORS[score] || FIT_COLORS.Moderate;

  const stats = {
    total: jobs.length,
    strong: jobs.filter(j => j.fitScore === "Strong").length,
    applied: jobs.filter(j => j.status?.includes("Applied")).length,
    skip: jobs.filter(j => j.fitScore === "Skip").length,
  };

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
            onStatusChange={(id, status) => { updateStatus(id, status); setSelectedJob(prev => prev?.id === id ? { ...prev, status } : prev); }}
            onDelete={(id) => { deleteJob(id); setSelectedJob(null); }}
          />
        )}

        {/* Evaluate View */}
        {view === "evaluate" && (
          <EvaluateView
            posting={evaluate.posting}
            setPosting={evaluate.setPosting}
            loading={evaluate.loading}
            error={evaluate.error}
            evaluationResult={evaluate.evaluationResult}
            judgeResult={evaluate.judgeResult}
            sanitizationFlags={evaluate.sanitizationFlags}
            cooldown={evaluate.cooldown}
            sessionCount={evaluate.sessionCount}
            sessionWarning={evaluate.sessionWarning}
            onEvaluate={evaluate.evaluatePosting}
            onAddToTracker={evaluate.addToTracker}
            onClear={evaluate.clearEvaluate}
            colors={colors}
          />
        )}
      </div>
    </div>
  );
}
