import { STATUS_OPTIONS } from "../constants.js";

export function JobDetail({ job, colors, onBack, onStatusChange, onDelete }) {
  return (
    <div className="slide-in">
      <button className="btn-ghost" style={{ marginBottom: "20px" }} onClick={onBack}>← back</button>
      <div className="card" style={{ padding: "32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "22px", color: "#e2e8f0" }}>{job.company}</div>
            <div style={{ fontSize: "14px", color: "#64748b", marginTop: "4px" }}>{job.role}</div>
            <div style={{ fontSize: "12px", color: "#475569", marginTop: "4px" }}>{job.salary} · added {job.dateAdded}</div>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span className={`tag ${colors(job.fitScore).bg} ${colors(job.fitScore).text}`} style={{ fontSize: "12px", padding: "4px 12px" }}>
              {job.fitScore}
            </span>
            <button className="btn-ghost" style={{ color: "#ef4444", borderColor: "#ef444430" }} onClick={() => onDelete(job.id)}>delete</button>
          </div>
        </div>

        <div style={{ background: "#070709", borderRadius: "8px", padding: "16px", marginBottom: "24px", borderLeft: "3px solid #6366f1" }}>
          <div style={{ fontSize: "10px", color: "#475569", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "1px" }}>verdict</div>
          <div style={{ fontSize: "13px", color: "#cbd5e1" }}>{job.verdict}</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "24px" }}>
          <div>
            <div style={{ fontSize: "10px", color: "#475569", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "1px" }}>✓ strengths</div>
            {job.strengths?.map((s, i) => (
              <div key={i} style={{ fontSize: "12px", color: "#86efac", padding: "4px 0", borderBottom: "1px solid #0f2010" }}>+ {s}</div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: "10px", color: "#475569", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "1px" }}>✗ gaps</div>
            {job.gaps?.map((g, i) => (
              <div key={i} style={{ fontSize: "12px", color: "#fca5a5", padding: "4px 0", borderBottom: "1px solid #1f0f0f" }}>— {g}</div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ fontSize: "10px", color: "#475569", textTransform: "uppercase", letterSpacing: "1px" }}>status</div>
          <select
            value={job.status}
            onChange={e => onStatusChange(job.id, e.target.value)}
            style={{ fontSize: "13px", padding: "6px 12px" }}
          >
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <div style={{ fontSize: "11px", color: "#475569" }}>recommendation: <span style={{ color: "#a5b4fc" }}>{job.recommendation}</span></div>
        </div>
      </div>
    </div>
  );
}
