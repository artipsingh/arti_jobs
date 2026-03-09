import { STATUS_OPTIONS } from "../constants.js";

export function JobCard({ job, colors, onSelect, onStatusChange }) {
  const c = colors(job.fitScore);
  return (
    <div
      data-testid="job-card"
      className="card"
      style={{ padding: "18px 24px", cursor: "pointer", display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: "16px", alignItems: "center" }}
      onClick={() => onSelect(job)}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
          <div data-testid="job-card-company" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "14px", color: "#e2e8f0" }}>{job.company}</div>
          <div style={{ fontSize: "11px", color: "#64748b" }}>—</div>
          <div data-testid="job-card-role" style={{ fontSize: "12px", color: "#94a3b8" }}>{job.role}</div>
        </div>
        <div data-testid="job-card-verdict" style={{ fontSize: "11px", color: "#475569" }}>{job.verdict}</div>
      </div>
      <div style={{ fontSize: "11px", color: "#475569", whiteSpace: "nowrap" }}>{job.salary}</div>
      <div style={{ whiteSpace: "nowrap" }}>
        <span data-testid="job-card-fit-score" className={`tag ${c.bg} ${c.text}`} style={{ border: `1px solid`, borderColor: c.border.replace("border-", "").replace("/40", "4D") }}>
          <span style={{ marginRight: "5px" }}>●</span>{job.fitScore}
        </span>
      </div>
      <select
        data-testid="job-card-status"
        value={job.status}
        onClick={e => e.stopPropagation()}
        onChange={e => onStatusChange(job.id, e.target.value)}
      >
        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>
  );
}
