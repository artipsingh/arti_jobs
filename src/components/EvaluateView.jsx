import { RealTalkCard } from "./RealTalkCard.jsx";

export function EvaluateView({
  posting, setPosting,
  loading, error,
  evaluationResult, judgeResult,
  sanitizationFlags = [],
  cooldown = 0,
  sessionCount = 0,
  sessionWarning = false,
  onEvaluate, onAddToTracker, onClear,
  colors,
}) {
  return (
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

      <div style={{ display: "flex", gap: "10px", marginBottom: "8px", alignItems: "center" }}>
        <button data-testid="btn-evaluate" className="btn-primary" onClick={onEvaluate} disabled={loading || !posting.trim() || cooldown > 0}>
          {loading ? <span className="pulse">evaluating...</span> : cooldown > 0 ? `wait ${cooldown}s...` : "evaluate posting →"}
        </button>
        {posting && (
          <button data-testid="btn-clear" className="btn-ghost" onClick={onClear}>clear</button>
        )}
        {sessionCount > 0 && (
          <span data-testid="session-count" style={{ fontSize: "11px", color: "#475569", marginLeft: "auto" }}>
            {sessionCount} evaluated this session
          </span>
        )}
      </div>

      {sessionWarning && (
        <div data-testid="session-warning" style={{ background: "#1c1500", border: "1px solid #f59e0b40", borderRadius: "8px", padding: "10px 14px", color: "#fcd34d", fontSize: "12px", marginBottom: "16px", borderLeft: "3px solid #f59e0b" }}>
          You have evaluated {sessionCount} postings this session. Take a break — each evaluation costs API tokens.
        </div>
      )}

      <div style={{ marginBottom: "16px" }} />

      {sanitizationFlags.length > 0 && (
        <div data-testid="sanitization-flags" style={{ marginBottom: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {sanitizationFlags.map((flag, i) => (
            <div key={i} data-testid="sanitization-flag" style={{ background: "#1c1500", border: "1px solid #f59e0b40", borderRadius: "8px", padding: "12px 16px", color: "#fcd34d", fontSize: "12px", borderLeft: "3px solid #f59e0b" }}>
              ⚠ {flag.message}
            </div>
          ))}
        </div>
      )}

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

          {evaluationResult.realTalk && (
            <RealTalkCard realTalk={evaluationResult.realTalk} judgeResult={judgeResult} />
          )}

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

          <button data-testid="btn-add-to-tracker" className="btn-primary" onClick={onAddToTracker}>add to tracker →</button>
        </div>
      )}
    </div>
  );
}
