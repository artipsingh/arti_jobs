import { Component } from "react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#070709",
          fontFamily: "'DM Mono', monospace",
        }}>
          <div style={{
            background: "#1f0a0a",
            border: "1px solid #ef444430",
            borderRadius: "8px",
            padding: "32px",
            maxWidth: "480px",
            width: "100%",
          }}>
            <div style={{ fontSize: "11px", color: "#ef4444", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px" }}>
              something went wrong
            </div>
            <div style={{ fontSize: "13px", color: "#fca5a5", marginBottom: "20px", lineHeight: "1.6" }}>
              {this.state.error.message || "An unexpected error occurred."}
            </div>
            <button
              className="btn-primary"
              onClick={() => this.setState({ error: null })}
            >
              try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
