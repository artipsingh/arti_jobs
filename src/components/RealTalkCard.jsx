export function RealTalkCard({ realTalk, judgeResult }) {
  const borderColor = judgeResult && !judgeResult.grounded ? "#ef4444" : "#f59e0b";

  return (
    <div data-testid="result-real-talk" style={{ background: "#0d0a00", borderRadius: "8px", padding: "14px", marginBottom: "20px", borderLeft: `3px solid ${borderColor}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
        <div style={{ fontSize: "10px", color: "#92400e", textTransform: "uppercase", letterSpacing: "1px" }}>real talk</div>
        {judgeResult && !judgeResult.grounded && (
          <span data-testid="judge-warning" title={judgeResult.summary} style={{ fontSize: "10px", background: "#450a0a", color: "#fca5a5", padding: "2px 7px", borderRadius: "4px", cursor: "help" }}>
            ⚠ unverified claims
          </span>
        )}
        {judgeResult && judgeResult.grounded && (
          <span data-testid="judge-verified" style={{ fontSize: "10px", background: "#052e16", color: "#86efac", padding: "2px 7px", borderRadius: "4px" }}>
            ✓ grounded
          </span>
        )}
        {!judgeResult && (
          <span style={{ fontSize: "10px", color: "#475569" }}>verifying…</span>
        )}
      </div>

      <div style={{ fontSize: "13px", color: "#fcd34d", lineHeight: "1.6" }}>{realTalk}</div>

      {judgeResult && !judgeResult.grounded && judgeResult.flags?.length > 0 && (
        <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #1f0a0a" }}>
          <div style={{ fontSize: "10px", color: "#92400e", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "1px" }}>flagged</div>
          {judgeResult.flags.map((flag, i) => (
            <div key={i} style={{ fontSize: "12px", color: "#fca5a5", padding: "2px 0" }}>— {flag}</div>
          ))}
        </div>
      )}
    </div>
  );
}
