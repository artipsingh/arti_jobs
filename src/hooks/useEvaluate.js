import { useState, useEffect, useRef } from "react";
import { evaluateJob } from "../api/evaluateJob.js";
import { judgeRealTalk } from "../api/judgeRealTalk.js";
import { buildSystemPrompt } from "../prompts/systemPrompt.js";

const COOLDOWN_SECONDS = 10;
const SESSION_WARN_THRESHOLD = 30;

export function useEvaluate(onAddToTracker) {
  const [posting, setPosting] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [judgeResult, setJudgeResult] = useState(null);
  const [sanitizationFlags, setSanitizationFlags] = useState([]);
  const [cooldown, setCooldown] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const cooldownRef = useRef(null);

  useEffect(() => {
    return () => clearInterval(cooldownRef.current);
  }, []);

  function startCooldown() {
    setCooldown(COOLDOWN_SECONDS);
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function evaluatePosting() {
    if (!posting.trim() || cooldown > 0) return;
    setLoading(true);
    setError("");
    setEvaluationResult(null);
    setJudgeResult(null);
    setSanitizationFlags([]);
    try {
      const result = await evaluateJob(posting, buildSystemPrompt());
      setSanitizationFlags(result._flags || []);
      setEvaluationResult(result);
      const newCount = sessionCount + 1;
      setSessionCount(newCount);
      if (result.realTalk) {
        judgeRealTalk(posting, result.realTalk)
          .then(setJudgeResult)
          .catch(() => {});
      }
    } catch (err) {
      setError(err.message || "Evaluation failed. Check the posting and try again.");
    } finally {
      setLoading(false);
      startCooldown();
    }
  }

  function addToTracker() {
    if (!evaluationResult) return;
    const dateAdded = new Date().toISOString().split("T")[0];
    const { _flags: _ignored, ...resultToSave } = evaluationResult;
    onAddToTracker({
      ...resultToSave,
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
    setSanitizationFlags([]);
    setError("");
  }

  return {
    posting, setPosting,
    loading, error,
    evaluationResult, judgeResult,
    sanitizationFlags,
    cooldown,
    sessionCount,
    sessionWarning: sessionCount >= SESSION_WARN_THRESHOLD,
    evaluatePosting, addToTracker, clearEvaluate,
  };
}
