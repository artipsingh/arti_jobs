"""
Fixtures and live API helpers for arti.jobs LLM evaluation tests.

Two modes:
  - Unit mode (default): tests run against fixture data, no API calls.
  - Live mode: tests call the Anthropic API directly.
    Run with: pytest --live
"""

import json
import re
import pytest
import requests
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT = Path(__file__).parent.parent.parent
RESUME_PATH = ROOT / "data" / "resume.txt"
ENV_PATH = ROOT / ".env"

# ---------------------------------------------------------------------------
# Constants mirrored from systemPrompt.js and constants.js
# ---------------------------------------------------------------------------
VALID_FIT_SCORES = {"Strong", "Moderate", "Stretch", "Skip"}
VALID_RECOMMENDATIONS = {"Apply", "Apply with caution", "Skip", "Reach out to contact first"}

# Specific experience refs the verdict should cite per experience-mapping rules
EXPERIENCE_REFS = [
    "Rangle", "Loopio", "LoblawDigital", "Loblaw", "Globe",
    "Cypress", "Jenkins", "Datadog", "CI/CD", "UAT",
    "AWS", "Docker", "Python", "TypeScript", "JavaScript",
    "Playwright", "Selenium", "Postman", "Newman",
]

REQUIRED_FIELDS = [
    "company", "role", "salary", "fitScore",
    "verdict", "gaps", "strengths", "recommendation",
]

# ---------------------------------------------------------------------------
# Pytest option: --live
# ---------------------------------------------------------------------------
def pytest_addoption(parser):
    parser.addoption(
        "--live",
        action="store_true",
        default=False,
        help="Run tests that call the Anthropic API",
    )

@pytest.fixture(scope="session")
def live(request):
    return request.config.getoption("--live")

# ---------------------------------------------------------------------------
# API helpers
# ---------------------------------------------------------------------------
def _read_api_key():
    try:
        content = ENV_PATH.read_text()
        match = re.search(r"^VITE_ANTHROPIC_API_KEY=(.+)$", content, re.MULTILINE)
        return match.group(1).strip() if match else None
    except FileNotFoundError:
        return None


def _build_system_prompt():
    """Reconstruct the system prompt from source files — mirrors systemPrompt.js."""
    resume = RESUME_PATH.read_text()
    return f"""
Act as a deterministic job-fit evaluation engine. Evaluate each provided job posting against Arti's resume using only the rules, mappings, and resume context below.

SCORING RULES:
- If a HARD requirement is missing, maximum score is "Moderate"
- If more than 2 hard requirements are missing, score is "Skip"
- Nice-to-haves and bonus points do not lower the score
- 14+ years always clears any years-of-experience requirement
- Salary below $120K CAD is treated as a hard gap

SALARY RULES:
- Arti's floor is $130K CAD
- If salary is listed and under $120K CAD, add "Below salary floor" as a gap
- If salary is listed between $120K-$129K, add "Below preferred salary anchor" as a gap
- If salary is not listed, note "Not listed" but do not penalize the score

EXPERIENCE MAPPING:
- Client-facing UAT, delivery quality, go/no-go, QA Lead roles → lead with Rangle experience
- CI/CD, pipeline engineering, developer tooling, SDET roles → lead with Loopio experience
- AI testing, LLM validation, prompt injection roles → Loopio AI quality work is directly relevant
- Team leadership, mentorship roles → both Rangle and LoblawDigital are relevant

AUTOMATIC SKIP CONDITIONS — score must be "Skip" if the posting requires ANY of these:
- Kubernetes as the core product or primary skill
- Java as the primary or required language
- Vendor transition leadership as the main responsibility
- Performance/load testing tools (JMeter, Gatling, k6) as a hard requirement

Here is Arti's resume:
{resume}

When given a job posting, evaluate the fit and respond with ONLY a valid JSON object (no markdown, no backticks) in this exact format:
{{
  "company": "Company name",
  "role": "Job title",
  "salary": "Salary range or 'Not listed'",
  "fitScore": "Strong" | "Moderate" | "Stretch" | "Skip",
  "verdict": "One sentence verdict that references the most relevant experience",
  "gaps": ["gap 1", "gap 2", "gap 3"],
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "recommendation": "Apply" | "Apply with caution" | "Skip" | "Reach out to contact first"
}}"""


def call_claude(posting: str) -> dict:
    """Call the Anthropic API and return the parsed JSON evaluation."""
    api_key = _read_api_key()
    if not api_key:
        pytest.skip("VITE_ANTHROPIC_API_KEY not found in .env")

    response = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 1000,
            "system": _build_system_prompt(),
            "messages": [
                {"role": "user", "content": f"Evaluate this job posting for Arti:\n\n{posting}"}
            ],
        },
        timeout=30,
    )
    response.raise_for_status()
    text = response.json()["content"][0]["text"]
    clean = re.sub(r"```json|```", "", text).strip()
    return json.loads(clean)

# ---------------------------------------------------------------------------
# Fixture data — representative responses used in unit tests
# ---------------------------------------------------------------------------
@pytest.fixture
def strong_response():
    """A well-formed Strong fit response with proper experience citations."""
    return {
        "company": "nesto",
        "role": "SaaS Delivery Quality Manager",
        "salary": "Not listed",
        "fitScore": "Strong",
        "verdict": "Best natural fit — client UAT orchestration from Rangle and CI/CD depth from Loopio are exact matches.",
        "gaps": ["Fintech/mortgage domain experience"],
        "strengths": ["Client UAT orchestration from Rangle", "Cypress/Postman/Jira match", "CI/CD depth from Loopio"],
        "recommendation": "Apply",
    }

@pytest.fixture
def skip_response():
    """A well-formed Skip response for a Kubernetes-core role."""
    return {
        "company": "vCluster Labs",
        "role": "Senior QA Engineer",
        "salary": "CA$100K–$145K",
        "fitScore": "Skip",
        "verdict": "Despite CI/CD depth from Loopio, Kubernetes is the entire product and is an automatic skip condition.",
        "gaps": ["Kubernetes (core product)", "Distributed systems testing", "Go language"],
        "strengths": ["CI/CD pipelines from Loopio", "Python scripting", "AWS infrastructure"],
        "recommendation": "Skip",
    }

@pytest.fixture
def moderate_response():
    """A well-formed Moderate fit response with one hard gap."""
    return {
        "company": "Veeva Systems",
        "role": "Senior Quality Engineer",
        "salary": "CA$90K–$165K",
        "fitScore": "Moderate",
        "verdict": "Strong technical alignment from Loopio CI/CD work, but Java is a hard requirement and is not on the resume.",
        "gaps": ["Java (hard requirement)", "REST Assured"],
        "strengths": ["14 years clears experience bar", "API testing from Loopio", "Framework builds from scratch"],
        "recommendation": "Skip",
    }

# ---------------------------------------------------------------------------
# Job posting fixtures used in live tests
# ---------------------------------------------------------------------------
UAT_LEAD_POSTING = """
Company: FinServ Co
Role: QA Lead
Salary: Not listed

We need a QA Lead to own end-to-end quality delivery for enterprise client implementations.
Responsibilities include designing UAT strategy, facilitating client UAT sessions,
owning go/no-go decisions, and building repeatable test suites.
Required: 5+ years QA experience, Cypress or Selenium, Jira, client-facing UAT experience.
"""

JAVA_REQUIRED_POSTING = """
Company: Acme Corp
Role: Senior QA Engineer
Salary: CA$130K–$150K

Required: Java (primary language), REST Assured, TestNG.
Experience with Spring Boot testing required.
Must have 5+ years Java-based test automation.
"""

KUBERNETES_POSTING = """
Company: CloudNative Inc
Role: Senior QA Engineer
Salary: CA$120K–$145K

We build and test Kubernetes-native infrastructure.
The core product is a Kubernetes operator.
Required: Deep Kubernetes knowledge, Go, distributed systems testing.
"""

JMETER_POSTING = """
Company: LoadTest Co
Role: Performance QA Engineer
Salary: CA$125K–$145K

Must have hands-on experience with JMeter as a hard requirement.
You will own all performance and load testing across the platform.
"""

BELOW_FLOOR_POSTING = """
Company: SmallStartup
Role: QA Engineer
Salary: CA$85K–$100K

Looking for a QA engineer with Cypress experience.
Required: 3+ years, Cypress, CI/CD, API testing.
"""

BELOW_ANCHOR_POSTING = """
Company: MidStartup
Role: Senior QA Engineer
Salary: CA$120K–$128K

Looking for a Senior QA engineer with strong CI/CD experience.
Required: Cypress, Jenkins, API testing, 5+ years.
"""
