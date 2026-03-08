"""
Output format tests — deterministic schema validation.

These tests verify that Claude's response adheres exactly to the
contract defined in systemPrompt.js. No API calls are made here;
they run against fixture data and can also validate any live response.

To validate a live response, run: pytest --live
"""

import pytest
from conftest import (
    VALID_FIT_SCORES,
    VALID_RECOMMENDATIONS,
    REQUIRED_FIELDS,
    call_claude,
    UAT_LEAD_POSTING,
)


# ---------------------------------------------------------------------------
# Schema validator — reusable across unit and live tests
# ---------------------------------------------------------------------------
def assert_valid_schema(result: dict):
    """Assert the full output contract. Used in both unit and live tests."""

    # All required fields present
    for field in REQUIRED_FIELDS:
        assert field in result, f"Missing required field: '{field}'"

    # No extra unexpected top-level keys
    extra = set(result.keys()) - set(REQUIRED_FIELDS)
    assert not extra, f"Unexpected fields in response: {extra}"

    # String fields are non-empty strings
    for field in ["company", "role", "salary", "fitScore", "verdict", "recommendation"]:
        assert isinstance(result[field], str), f"'{field}' must be a string, got {type(result[field])}"
        assert result[field].strip(), f"'{field}' must not be empty or whitespace"

    # Enum fields have valid values
    assert result["fitScore"] in VALID_FIT_SCORES, (
        f"fitScore '{result['fitScore']}' is not one of {VALID_FIT_SCORES}"
    )
    assert result["recommendation"] in VALID_RECOMMENDATIONS, (
        f"recommendation '{result['recommendation']}' is not one of {VALID_RECOMMENDATIONS}"
    )

    # Array fields are lists
    assert isinstance(result["strengths"], list), "strengths must be a list"
    assert isinstance(result["gaps"], list), "gaps must be a list"

    # Array items are non-empty strings
    for item in result["strengths"]:
        assert isinstance(item, str) and item.strip(), f"Each strength must be a non-empty string, got: {item!r}"
    for item in result["gaps"]:
        assert isinstance(item, str) and item.strip(), f"Each gap must be a non-empty string, got: {item!r}"


# ---------------------------------------------------------------------------
# Unit tests — fixture data
# ---------------------------------------------------------------------------
class TestSchemaWithFixtures:

    def test_strong_response_passes_schema(self, strong_response):
        assert_valid_schema(strong_response)

    def test_skip_response_passes_schema(self, skip_response):
        assert_valid_schema(skip_response)

    def test_moderate_response_passes_schema(self, moderate_response):
        assert_valid_schema(moderate_response)

    def test_missing_company_fails(self, strong_response):
        del strong_response["company"]
        with pytest.raises(AssertionError, match="company"):
            assert_valid_schema(strong_response)

    def test_missing_fit_score_fails(self, strong_response):
        del strong_response["fitScore"]
        with pytest.raises(AssertionError, match="fitScore"):
            assert_valid_schema(strong_response)

    def test_invalid_fit_score_fails(self, strong_response):
        strong_response["fitScore"] = "Great"
        with pytest.raises(AssertionError, match="fitScore"):
            assert_valid_schema(strong_response)

    def test_invalid_recommendation_fails(self, strong_response):
        strong_response["recommendation"] = "Maybe"
        with pytest.raises(AssertionError, match="recommendation"):
            assert_valid_schema(strong_response)

    def test_strengths_must_be_list(self, strong_response):
        strong_response["strengths"] = "Cypress, CI/CD"
        with pytest.raises(AssertionError, match="strengths must be a list"):
            assert_valid_schema(strong_response)

    def test_gaps_must_be_list(self, strong_response):
        strong_response["gaps"] = "No Kubernetes"
        with pytest.raises(AssertionError, match="gaps must be a list"):
            assert_valid_schema(strong_response)

    def test_empty_verdict_fails(self, strong_response):
        strong_response["verdict"] = "   "
        with pytest.raises(AssertionError, match="verdict"):
            assert_valid_schema(strong_response)

    def test_unexpected_field_fails(self, strong_response):
        strong_response["score"] = 95
        with pytest.raises(AssertionError, match="Unexpected fields"):
            assert_valid_schema(strong_response)


# ---------------------------------------------------------------------------
# Live tests — validate schema on a real API response
# ---------------------------------------------------------------------------
class TestSchemaLive:

    def test_live_response_passes_full_schema(self, live):
        if not live:
            pytest.skip("Pass --live to run")
        result = call_claude(UAT_LEAD_POSTING)
        assert_valid_schema(result)

    def test_live_response_is_pure_json(self, live):
        """Claude must return raw JSON — no markdown fences or prose."""
        if not live:
            pytest.skip("Pass --live to run")
        import requests, re, json
        from conftest import _read_api_key, _build_system_prompt, ENV_PATH
        api_key = _read_api_key()
        if not api_key:
            pytest.skip("No API key")
        response = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
            json={
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 1000,
                "system": _build_system_prompt(),
                "messages": [{"role": "user", "content": f"Evaluate this job posting for Arti:\n\n{UAT_LEAD_POSTING}"}],
            },
            timeout=30,
        )
        raw_text = response.json()["content"][0]["text"]
        assert "```" not in raw_text, "Response contains markdown code fences — prompt needs reinforcing"
        json.loads(raw_text.strip())  # must be directly parseable
