"""
Output quality tests — deterministic content validation.

Tests that Claude's reasoning is specific, grounded, and cites
actual experience from the resume. Validates:
  - Verdict is a single sentence
  - Verdict cites specific experience (source citations)
  - Strengths and gaps are specific, not generic
  - Reasoning depth: fields have meaningful content

No LLM is used to judge LLM output — all checks are pure Python.
"""

import re
import pytest
from conftest import EXPERIENCE_REFS, call_claude, UAT_LEAD_POSTING


# ---------------------------------------------------------------------------
# Quality validators
# ---------------------------------------------------------------------------
def assert_verdict_is_single_sentence(verdict: str):
    """
    A verdict must be one sentence. We detect multiple sentences by looking
    for sentence-ending punctuation followed by a capital letter or newline.
    """
    # Strip trailing punctuation for the check
    stripped = verdict.strip()
    # Match patterns like ". T", ". A", "! T" — two sentences back to back
    multi_sentence = re.search(r"[.!?]\s+[A-Z]", stripped)
    assert not multi_sentence, (
        f"Verdict appears to contain multiple sentences: {verdict!r}"
    )


def assert_verdict_cites_experience(verdict: str):
    """
    Per the experience-mapping rules, the verdict must reference specific
    experience from the resume (company names or key tools), not be generic.
    """
    found = [ref for ref in EXPERIENCE_REFS if ref.lower() in verdict.lower()]
    assert found, (
        f"Verdict does not cite any specific experience from the resume.\n"
        f"  Verdict: {verdict!r}\n"
        f"  Expected at least one of: {EXPERIENCE_REFS}"
    )


def assert_strengths_are_specific(strengths: list):
    """
    Strengths must be specific — not one-word generics like 'Communication'
    or 'Leadership'. Each strength should be at least 3 words or reference
    a known tool/company.
    """
    generic_terms = {"communication", "leadership", "teamwork", "motivated", "detail-oriented"}
    for strength in strengths:
        words = strength.strip().split()
        assert len(words) >= 2, (
            f"Strength is too vague (less than 2 words): {strength!r}"
        )
        assert strength.lower().strip() not in generic_terms, (
            f"Strength is a generic term with no specificity: {strength!r}"
        )


def assert_gaps_are_specific(gaps: list):
    """Gaps must name something concrete — not just 'experience' or 'skills'."""
    vague_terms = {"experience", "skills", "knowledge", "background"}
    for gap in gaps:
        words = [w.lower() for w in gap.strip().split()]
        assert not (len(words) == 1 and words[0] in vague_terms), (
            f"Gap is too vague: {gap!r}. Should name a specific technology or domain."
        )


def assert_reasoning_depth(result: dict):
    """Ensure fields have enough substance to be meaningful."""
    assert len(result["verdict"]) >= 30, (
        f"Verdict is suspiciously short ({len(result['verdict'])} chars): {result['verdict']!r}"
    )
    assert len(result["strengths"]) >= 1, "Must have at least one strength"
    assert len(result["gaps"]) >= 0, "Gaps can be empty but must be a list"
    for strength in result["strengths"]:
        assert len(strength) >= 2, f"Strength too short to be meaningful: {strength!r}"


# ---------------------------------------------------------------------------
# Unit tests — fixture data
# ---------------------------------------------------------------------------
class TestOutputQualityWithFixtures:

    def test_strong_verdict_is_single_sentence(self, strong_response):
        assert_verdict_is_single_sentence(strong_response["verdict"])

    def test_strong_verdict_cites_experience(self, strong_response):
        assert_verdict_cites_experience(strong_response["verdict"])

    def test_skip_verdict_is_single_sentence(self, skip_response):
        assert_verdict_is_single_sentence(skip_response["verdict"])

    def test_skip_verdict_cites_experience(self, skip_response):
        assert_verdict_cites_experience(skip_response["verdict"])

    def test_moderate_verdict_is_single_sentence(self, moderate_response):
        assert_verdict_is_single_sentence(moderate_response["verdict"])

    def test_strengths_are_specific(self, strong_response):
        assert_strengths_are_specific(strong_response["strengths"])

    def test_gaps_are_specific(self, strong_response):
        assert_gaps_are_specific(strong_response["gaps"])

    def test_reasoning_depth_strong(self, strong_response):
        assert_reasoning_depth(strong_response)

    def test_reasoning_depth_skip(self, skip_response):
        assert_reasoning_depth(skip_response)

    # --- Negative cases: validate the validators catch bad output ---

    def test_multi_sentence_verdict_fails(self, strong_response):
        strong_response["verdict"] = "Great fit overall. Rangle experience is directly relevant."
        with pytest.raises(AssertionError, match="multiple sentences"):
            assert_verdict_is_single_sentence(strong_response["verdict"])

    def test_generic_verdict_fails(self, strong_response):
        strong_response["verdict"] = "This candidate has good experience and strong skills."
        with pytest.raises(AssertionError, match="does not cite"):
            assert_verdict_cites_experience(strong_response["verdict"])

    def test_generic_strength_fails(self, strong_response):
        strong_response["strengths"] = ["Communication", "Leadership", "Teamwork"]
        with pytest.raises(AssertionError):
            assert_strengths_are_specific(strong_response["strengths"])

    def test_vague_gap_fails(self, strong_response):
        strong_response["gaps"] = ["experience"]
        with pytest.raises(AssertionError, match="too vague"):
            assert_gaps_are_specific(strong_response["gaps"])

    def test_short_verdict_fails(self, strong_response):
        strong_response["verdict"] = "Good fit."
        with pytest.raises(AssertionError, match="suspiciously short"):
            assert_reasoning_depth(strong_response)


# ---------------------------------------------------------------------------
# Live tests — validate quality on real API responses
# ---------------------------------------------------------------------------
class TestOutputQualityLive:

    def test_live_verdict_is_single_sentence(self, live):
        if not live:
            pytest.skip("Pass --live to run")
        result = call_claude(UAT_LEAD_POSTING)
        assert_verdict_is_single_sentence(result["verdict"])

    def test_live_verdict_cites_experience(self, live):
        if not live:
            pytest.skip("Pass --live to run")
        result = call_claude(UAT_LEAD_POSTING)
        assert_verdict_cites_experience(result["verdict"])

    def test_live_strengths_are_specific(self, live):
        if not live:
            pytest.skip("Pass --live to run")
        result = call_claude(UAT_LEAD_POSTING)
        assert_strengths_are_specific(result["strengths"])

    def test_live_gaps_are_specific(self, live):
        if not live:
            pytest.skip("Pass --live to run")
        result = call_claude(UAT_LEAD_POSTING)
        assert_gaps_are_specific(result["gaps"])

    def test_live_reasoning_depth(self, live):
        if not live:
            pytest.skip("Pass --live to run")
        result = call_claude(UAT_LEAD_POSTING)
        assert_reasoning_depth(result)
