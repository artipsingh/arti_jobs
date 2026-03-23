import { STATUS_OPTIONS } from "../constants.js";
import "../styles/JobDetail.css";

export function JobDetail({ job, colors, onBack, onStatusChange, onDelete }) {
  return (
    <div data-testid="job-detail" className="slide-in">
      <button data-testid="btn-back" className="btn-ghost job-detail-back" onClick={onBack}>← back</button>
      <div className="card job-detail-card">
        <div className="job-detail-header">
          <div>
            <div data-testid="job-detail-company" className="job-detail-company">{job.company}</div>
            <div data-testid="job-detail-role" className="job-detail-role">{job.role}</div>
            <div className="job-detail-meta">{job.salary} · added {job.dateAdded}</div>
          </div>
          <div className="job-detail-actions">
            <span data-testid="job-detail-fit-score" className={`tag job-detail-fit-score ${colors(job.fitScore).bg} ${colors(job.fitScore).text}`}>
              {job.fitScore}
            </span>
            <button data-testid="btn-delete" className="btn-ghost btn-delete" onClick={() => onDelete(job.id)}>delete</button>
          </div>
        </div>

        <div className="job-detail-verdict-box">
          <div className="section-label">verdict</div>
          <div data-testid="job-detail-verdict" className="job-detail-verdict-text">{job.verdict}</div>
        </div>

        <div className="job-detail-grid">
          <div data-testid="job-detail-strengths">
            <div className="job-detail-strengths-label">✓ strengths</div>
            {job.strengths?.map((s, i) => (
              <div key={i} data-testid="strength-item" className="strength-item">+ {s}</div>
            ))}
          </div>
          <div data-testid="job-detail-gaps">
            <div className="job-detail-gaps-label">✗ gaps</div>
            {job.gaps?.map((g, i) => (
              <div key={i} data-testid="gap-item" className="gap-item">— {g}</div>
            ))}
          </div>
        </div>

        <div className="job-detail-status-row">
          <div className="job-detail-status-label">status</div>
          <select
            data-testid="job-detail-status"
            value={job.status}
            onChange={e => onStatusChange(job.id, e.target.value)}
            className="job-detail-status-select"
          >
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <div data-testid="job-detail-recommendation" className="job-detail-recommendation">recommendation: <span>{job.recommendation}</span></div>
        </div>

        {job.statusHistory && job.statusHistory.length > 0 && (
          <div data-testid="job-detail-history">
            <div className="job-detail-history-label">audit trail</div>
            <div className="history-timeline">
              {job.statusHistory.map((entry, i) => (
                <div key={i} className="history-entry">
                  <div className="history-connector">
                    <div className="history-dot" />
                    {i < job.statusHistory.length - 1 && <div className="history-line" />}
                  </div>
                  <div className={`history-content${i < job.statusHistory.length - 1 ? "" : " last"}`}>
                    <span className="history-status">{entry.status}</span>
                    <span className="history-date">{entry.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
