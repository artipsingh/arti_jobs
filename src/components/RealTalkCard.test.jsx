import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RealTalkCard } from "./RealTalkCard.jsx";

const REAL_TALK = "This is a one-person QA army role disguised as leadership.";

describe("RealTalkCard", () => {

  it("renders the realTalk text", () => {
    render(<RealTalkCard realTalk={REAL_TALK} judgeResult={null} />);
    expect(screen.getByText(REAL_TALK)).toBeTruthy();
  });

  it("shows verifying state when judgeResult is null", () => {
    render(<RealTalkCard realTalk={REAL_TALK} judgeResult={null} />);
    expect(screen.getByText("verifying…")).toBeTruthy();
  });

  it("shows grounded badge when judge says grounded", () => {
    const judgeResult = { grounded: true, flags: [], summary: "All claims supported." };
    render(<RealTalkCard realTalk={REAL_TALK} judgeResult={judgeResult} />);
    expect(screen.getByTestId("judge-verified")).toBeTruthy();
    expect(screen.queryByTestId("judge-warning")).toBeNull();
  });

  it("shows warning badge when judge says not grounded", () => {
    const judgeResult = { grounded: false, flags: ["Unsupported claim"], summary: "One flag." };
    render(<RealTalkCard realTalk={REAL_TALK} judgeResult={judgeResult} />);
    expect(screen.getByTestId("judge-warning")).toBeTruthy();
    expect(screen.queryByTestId("judge-verified")).toBeNull();
  });

  it("shows flagged claims when judge is not grounded", () => {
    const judgeResult = { grounded: false, flags: ["Claim A is unsupported", "Claim B is invented"], summary: "Two flags." };
    render(<RealTalkCard realTalk={REAL_TALK} judgeResult={judgeResult} />);
    expect(screen.getByText(/Claim A is unsupported/)).toBeTruthy();
    expect(screen.getByText(/Claim B is invented/)).toBeTruthy();
  });

  it("does not show flagged section when grounded", () => {
    const judgeResult = { grounded: true, flags: [], summary: "All good." };
    render(<RealTalkCard realTalk={REAL_TALK} judgeResult={judgeResult} />);
    expect(screen.queryByText("flagged")).toBeNull();
  });

  it("does not show flagged section when flags array is empty", () => {
    const judgeResult = { grounded: false, flags: [], summary: "No specific flags." };
    render(<RealTalkCard realTalk={REAL_TALK} judgeResult={judgeResult} />);
    expect(screen.queryByText(/— /)).toBeNull();
  });

  it("uses amber border when grounded", () => {
    const judgeResult = { grounded: true, flags: [], summary: "All good." };
    const { container } = render(<RealTalkCard realTalk={REAL_TALK} judgeResult={judgeResult} />);
    const card = container.firstChild;
    expect(card.style.borderLeft).toContain("rgb(245, 158, 11)");
  });

  it("uses red border when not grounded", () => {
    const judgeResult = { grounded: false, flags: ["A flag"], summary: "A flag." };
    const { container } = render(<RealTalkCard realTalk={REAL_TALK} judgeResult={judgeResult} />);
    const card = container.firstChild;
    expect(card.style.borderLeft).toContain("rgb(239, 68, 68)");
  });

  it("uses amber border when judgeResult is null (verifying state)", () => {
    const { container } = render(<RealTalkCard realTalk={REAL_TALK} judgeResult={null} />);
    const card = container.firstChild;
    expect(card.style.borderLeft).toContain("rgb(245, 158, 11)");
  });
});
