"""
Business rules tests — deterministic rule enforcement validation.

Tests that the system prompt rules are correctly applied:
  - Auto-skip conditions (Java, Kubernetes, JMeter, vendor transition)
  - Salary rules (below floor, below anchor)
  - fitScore / recommendation alignment
  - Experience mapping (correct company cited for role type)

Unit tests use fixture data. Live tests call the real API with
minimal constructed job postings designed to trigger specific rules.
"""

import pytest
from conftest import (
    call_claude,
    JAVA_REQUIRED_POSTING,
    KUBERNETES_POSTING,
    JMETER_POSTING,
    BELOW_FLOOR_POSTING,
    BELOW_ANCHOR_POSTING,
    UAT_LEAD_POSTING,
)


# ---------------------------------------------------------------------------
# Business rule validators
# ---------------------------------------------------------------------------
def assert_skip_alignment(result: dict):
    """A Skip fitScore must always have a Skip recommendation."""
    if result["fitScore"] == "Skip":
        assert result["recommendation"] == "Skip", (
            f"fitScore is Skip but recommendation is '{result['recommendation']}' — "
            "these must align per scoring rules."
        )


def assert_strong_not_skipped(result: dict):
    """A Strong fitScore must never recommend Skip."""
    if result["fitScore"] == "Strong":
        assert result["recommendation"] != "Skip", (
            f"fitScore is Strong but recommendation is Skip — contradiction."
        )


def assert_salary_below_floor_flagged(result: dict):
    """When salary is clearly below the $5K floor, gaps must call it out."""
    salary_gap_found = any(
        "salary" in g.lower() or "floor" in g.lower() or "$120" in g or "below" in g.lower()
        for g in result["gaps"]
    )
    assert salary_gap_found, (
        f"Salary is below the $5K floor but no salary gap was flagged.\n"
        f"  Gaps: {result['gaps']}"
    )


def assert_salary_below_anchor_flagged(result: dict):
    """When salary is between $5K-$9K, gaps must flag the anchor gap."""
    anchor_gap_found = any(
        "anchor" in g.lower() or "preferred" in g.lower() or "below" in g.lower()
        for g in result["gaps"]
    )
    assert anchor_gap_found, (
        f"Salary is below the $130K anchor but no anchor gap was flagged.\n"
        f"  Gaps: {result['gaps']}"
    )


def assert_uat_cites_rangle(result: dict):
    """Per experience-mapping rules, UAT/QA Lead roles must cite Rangle in strengths or verdict."""
    rangle_cited = (
        any("rangle" in s.lower() for s in result["strengths"])
        or "rangle" in result["verdict"].lower()
    )
    assert rangle_cited, (
        "UAT/QA Lead role should cite Rangle per experience-mapping rules, but Rangle "
        f"not found in strengths or verdict.\n"
        f"  Strengths: {result['strengths']}\n"
        f"  Verdict: {result['verdict']}"
    )


def assert_sdet_cites_loopio(result: dict):
    """Per experience-mapping rules, CI/CD/SDET roles must cite Loopio in strengths or verdict."""
    loopio_cited = (
        any("loopio" in s.lower() for s in result["strengths"])
        or "loopio" in result["verdict"].lower()
    )
    assert loopio_cited, (
        "CI/CD/SDET role should cite Loopio per experience-mapping rules, but Loopio "
        f"not found in strengths or verdict.\n"
        f"  Strengths: {result['strengths']}\n"
        f"  Verdict: {result['verdict']}"
    )


# ---------------------------------------------------------------------------
# Unit tests — fixture data
# ---------------------------------------------------------------------------
class TestBusinessRulesWithFixtures:

    def test_skip_fitness_aligns_with_skip_recommendation(self, skip_response):
        assert_skip_alignment(skip_response)

    def test_strong_fitness_not_skipped(self, strong_response):
        assert_strong_not_skipped(strong_response)

    def test_moderate_skip_recommendation_allowed(self, moderate_response):
        # Moderate fit with a hard disqualifier (Java) can still recommend Skip
        assert moderate_response["fitScore"] == "Moderate"
        assert moderate_response["recommendation"] == "Skip"

    def test_uat_role_cites_rangle(self, strong_response):
        # strong_response fixture is for nesto (UAT role) and cites Rangle
        assert_uat_cites_rangle(strong_response)

    # --- Negative cases: validate rule checkers catch violations ---

    def test_skip_score_with_non_skip_recommendation_fails(self, skip_response):
        skip_response["recommendation"] = "Apply"
        with pytest.raises(AssertionError, match="must align"):
            assert_skip_alignment(skip_response)

    def test_strong_score_with_skip_recommendation_fails(self, strong_response):
        strong_response["recommendation"] = "Skip"
        with pytest.raises(AssertionError, match="contradiction"):
            assert_strong_not_skipped(strong_response)

    def test_missing_salary_gap_fails(self, strong_response):
        strong_response["gaps"] = ["Fintech domain experience"]
        with pytest.raises(AssertionError, match="salary gap"):
            assert_salary_below_floor_flagged(strong_response)

    def test_missing_anchor_gap_fails(self, strong_response):
        strong_response["gaps"] = ["Mobile testing"]
        with pytest.raises(AssertionError, match="anchor gap"):
            assert_salary_below_anchor_flagged(strong_response)

    def test_uat_role_without_rangle_fails(self, strong_response):
        strong_response["strengths"] = ["CI/CD pipelines", "Docker", "Python"]
        strong_response["verdict"] = "Good technical match with CI/CD experience."
        with pytest.raises(AssertionError, match="Rangle"):
            assert_uat_cites_rangle(strong_response)


# ---------------------------------------------------------------------------
# Live tests — rule enforcement against real API calls
# ---------------------------------------------------------------------------
class TestAutoSkipLive:

    def test_java_required_is_always_skip(self, live):
        """Java as the primary required language is an automatic Skip condition."""
        if not live:
            pytest.skip("Pass --live to run")
        result = call_claude(JAVA_REQUIRED_POSTING)
        assert result["fitScore"] == "Skip", (
            f"Java required posting should be Skip, got '{result['fitScore']}'"
        )
        assert result["recommendation"] == "Skip"

    def test_kubernetes_core_is_always_skip(self, live):
        """Kubernetes as the core product is an automatic Skip condition."""
        if not live:
            pytest.skip("Pass --live to run")
        result = call_claude(KUBERNETES_POSTING)
        assert result["fitScore"] == "Skip", (
            f"Kubernetes core posting should be Skip, got '{result['fitScore']}'"
        )

    def test_jmeter_required_is_always_skip(self, live):
        """JMeter as a hard requirement is an automatic Skip condition."""
        if not live:
            pytest.skip("Pass --live to run")
        result = call_claude(JMETER_POSTING)
        assert result["fitScore"] == "Skip", (
            f"JMeter hard requirement should be Skip, got '{result['fitScore']}'"
        )


class TestSalaryRulesLive:

    def test_salary_below_floor_flagged_in_gaps(self, live):
        """CA$1K–$4K salary must appear as a gap."""
        if not live:
            pytest.skip("Pass --live to run")
        result = call_claude(BELOW_FLOOR_POSTING)
        assert_salary_below_floor_flagged(result)

    def test_salary_below_anchor_flagged_in_gaps(self, live):
        """CA$5K–$128K salary must flag the preferred anchor gap."""
        if not live:
            pytest.skip("Pass --live to run")
        result = call_claude(BELOW_ANCHOR_POSTING)
        assert_salary_below_anchor_flagged(result)

    def test_salary_below_floor_does_not_override_auto_skip(self, live):
        """A Java role with low salary is still Skip — auto-skip takes precedence."""
        if not live:
            pytest.skip("Pass --live to run")
        result = call_claude(JAVA_REQUIRED_POSTING)
        assert result["fitScore"] == "Skip"


class TestExperienceMappingLive:

    def test_uat_lead_role_cites_rangle(self, live):
        """Client-facing UAT roles must lead with Rangle per experience-mapping rules."""
        if not live:
            pytest.skip("Pass --live to run")
        result = call_claude(UAT_LEAD_POSTING)
        assert_uat_cites_rangle(result)

    def test_skip_score_aligns_with_recommendation_live(self, live):
        """Skip fitScore must always produce Skip recommendation — live validation."""
        if not live:
            pytest.skip("Pass --live to run")
        result = call_claude(KUBERNETES_POSTING)
        assert_skip_alignment(result)
