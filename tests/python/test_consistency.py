"""
Consistency tests — verify the model returns the same fitScore and recommendation
for the same posting across multiple calls.

LLMs are non-deterministic by nature. These tests prove that the system prompt
rules constrain the output enough to produce stable, repeatable evaluations.

Run with: pytest --live
"""

import pytest
from conftest import call_claude, UAT_LEAD_POSTING, JAVA_REQUIRED_POSTING, KUBERNETES_POSTING


CONSISTENCY_RUNS = 3


class TestConsistencyLive:

    def _collect_results(self, posting: str) -> list[dict]:
        return [call_claude(posting) for _ in range(CONSISTENCY_RUNS)]

    def test_fit_score_is_stable_for_strong_match(self, live):
        if not live:
            pytest.skip("consistency tests require --live")

        results = self._collect_results(UAT_LEAD_POSTING)
        scores = [r["fitScore"] for r in results]

        assert len(set(scores)) == 1, (
            f"fitScore was inconsistent across {CONSISTENCY_RUNS} runs: {scores}"
        )

    def test_recommendation_is_stable_for_strong_match(self, live):
        if not live:
            pytest.skip("consistency tests require --live")

        results = self._collect_results(UAT_LEAD_POSTING)
        recommendations = [r["recommendation"] for r in results]

        assert len(set(recommendations)) == 1, (
            f"recommendation was inconsistent across {CONSISTENCY_RUNS} runs: {recommendations}"
        )

    def test_auto_skip_is_stable_for_kubernetes_posting(self, live):
        if not live:
            pytest.skip("consistency tests require --live")

        results = self._collect_results(KUBERNETES_POSTING)
        scores = [r["fitScore"] for r in results]

        assert all(s == "Skip" for s in scores), (
            f"Auto-skip was not stable across {CONSISTENCY_RUNS} runs: {scores}"
        )

    def test_auto_skip_is_stable_for_java_posting(self, live):
        if not live:
            pytest.skip("consistency tests require --live")

        results = self._collect_results(JAVA_REQUIRED_POSTING)
        scores = [r["fitScore"] for r in results]

        assert all(s == "Skip" for s in scores), (
            f"Auto-skip was not stable across {CONSISTENCY_RUNS} runs: {scores}"
        )
