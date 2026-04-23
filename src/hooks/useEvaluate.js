import { useState } from "react";
import { evaluateJob } from "../api/evaluateJob.js";
import { judgeRealTalk } from "../api/judgeRealTalk.js";
import { buildSystemPrompt } from "../prompts/systemPrompt.js";

export function useEvaluate(onAddToTracker) {
  const [posting, setPosting] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [judgeResult, setJudgeResult] = useState(null);

  async function evaluatePosting() {
    if (!posting.trim()) return;
    setLoading(true);
    setError("");
    setEvaluationResult(null);
    setJudgeResult(null);
    try {
      const result = await evaluateJob(posting, buildSystemPrompt());
      setEvaluationResult(result);
      if (result.realTalk) {
        judgeRealTalk(posting, result.realTalk)
          .then(setJudgeResult)
          .catch(() => {}); // judge failure is silent — don't break the main result
      }
    } catch (err) {
      setError(err.message || "Evaluation failed. Check the posting and try again.");
    } finally {
      setLoading(false);
    }
  }

  function addToTracker() {
    if (!evaluationResult) return;
    const dateAdded = new Date().toISOString().split("T")[0];
    onAddToTracker({
      ...evaluationResult,
      id: Date.now(),
      status: "Considering 🤔",
      dateAdded,
      statusHistory: [{ status: "Considering 🤔", date: dateAdded }],
    });
    setEvaluationResult(null);
    setJudgeResult(null);
    setPosting("");
  }

  function clearEvaluate() {
    setPosting("");
    setEvaluationResult(null);
    setJudgeResult(null);
    setError("");
  }

  return {
    posting, setPosting,
    loading, error,
    evaluationResult, judgeResult,
    evaluatePosting, addToTracker, clearEvaluate,
  };
}
