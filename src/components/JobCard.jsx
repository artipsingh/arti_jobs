import { STATUS_OPTIONS } from "../constants.js";
import "./JobCard.css";

const REC_COLORS = {
  "Apply": { color: "#86efac", border: "#86efac40" },
  "Apply with caution": { color: "#fbbf24", border: "#fbbf2440" },
  "Skip": { color: "#fca5a5", border: "#fca5a540" },
};

export function JobCard({ job, colors, onSelect, onStatusChange, onFieldChange, onDelete }) {
  const c = colors(job.fitScore);
  const rec = REC_COLORS[job.recommendation] || { color: "#475569", border: "#1e2535" };
  return (
    <div
      data-testid="job-card"
      className="card job-card"
      onClick={() => onSelect(job)}
    >
      <button
        data-testid="job-card-delete"
        className="job-card__delete"
        onClick={e => { e.stopPropagation(); onDelete(job.id); }}
        title="Delete job"
      >✕</button>
      <div className="job-card__grid">
        <div>
          <div className="job-card__title-row">
            <div data-testid="job-card-company" className="job-card__company">{job.company}</div>
            <div className="job-card__separator">—</div>
            <div data-testid="job-card-role" className="job-card__role">{job.role}</div>
          </div>
        </div>
        <input
          data-testid="job-card-source"
          type="text"
          value={job.source || ""}
          placeholder="source"
          className="job-card__input"
          onClick={e => e.stopPropagation()}
          onChange={e => onFieldChange(job.id, "source", e.target.value)}
          title="Where you found this job"
        />
        <div data-testid="job-card-date" className="job-card__date">{job.dateAdded}</div>
        <div className="job-card__salary">{job.salary}</div>
        <div style={{ whiteSpace: "nowrap" }}>
          <span data-testid="job-card-fit-score" className={`tag ${c.bg} ${c.text}`} style={{ border: `1px solid`, borderColor: c.border.replace("border-", "").replace("/40", "4D") }}>
            <span style={{ marginRight: "5px" }}>●</span>{job.fitScore}
          </span>
        </div>
        <input
          data-testid="job-card-applied-date"
          type="date"
          value={job.appliedDate || ""}
          className={`job-card__date-input${job.appliedDate ? " has-value" : ""}`}
          onClick={e => e.stopPropagation()}
          onChange={e => onFieldChange(job.id, "appliedDate", e.target.value)}
          title="Date applied"
        />
        <textarea
          data-testid="job-card-resume"
          value={job.resumeUsed || ""}
          placeholder="resume used"
          rows={2}
          className="job-card__resume"
          onClick={e => e.stopPropagation()}
          onChange={e => onFieldChange(job.id, "resumeUsed", e.target.value)}
        />
        <select
          data-testid="job-card-status"
          value={job.status}
          onClick={e => e.stopPropagation()}
          onChange={e => onStatusChange(job.id, e.target.value)}
          style={{ padding: "4px 4px" }}
        >
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div data-testid="job-card-verdict" className="job-card__verdict">{job.verdict}</div>
      {job.recommendation && (
        <div data-testid="job-card-recommendation" className="job-card__recommendation">
          <span className="job-card__rec-label">recommendation</span>
          <span
            className="job-card__rec-badge"
            style={{ color: rec.color, border: `1px solid ${rec.border}` }}
          >{job.recommendation}</span>
          <input
            data-testid="job-card-posting-url"
            type="text"
            value={job.postingUrl || ""}
            placeholder="job posting url"
            className="job-card__posting-url"
            onClick={e => e.stopPropagation()}
            onChange={e => onFieldChange(job.id, "postingUrl", e.target.value)}
            title="Job posting URL"
          />
          {job.postingUrl && (
            <a
              href={job.postingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="job-card__posting-link"
              onClick={e => e.stopPropagation()}
              title="Open job posting"
            >↗</a>
          )}
        </div>
      )}
    </div>
  );
}
