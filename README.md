# arti.jobs — AI-Powered Job Search Tracker

[![CI](https://github.com/artipsingh/arti_jobs/actions/workflows/ci.yml/badge.svg)](https://github.com/artipsingh/arti_jobs/actions/workflows/ci.yml)

A job evaluation and tracking tool built to demonstrate AI quality engineering in practice.

Paste a job posting, and the app uses the Claude API to evaluate fit against a specific candidate profile — returning a structured assessment with a fit score, strengths, gaps, and a recommendation. Results are saved locally so you can track every role in one place.

Built as a portfolio project to showcase:
- Prompt engineering for structured, deterministic LLM output
- Input sanitization before sending data to an LLM (PII redaction, hyperlink stripping)
- LLM-as-judge: a second Claude call that verifies the first call's output for hallucinations
- Prompt injection defence: XML boundary isolation, anti-injection rules, adversarial test coverage
- Purple team security testing: adversarial job postings designed to break the system, with pytest regression tests that run in CI
- Self-healing Playwright tests: L2 fallback selectors + L3 Claude AI healer for broken locators
- Test automation against LLM responses (Vitest unit tests + pytest LLM evaluation suite)

---

## Getting Started

### Prerequisites
- Node.js v18+
- Python 3.9+ (for the pytest LLM evaluation suite)
- An Anthropic API key ([console.anthropic.com](https://console.anthropic.com))

### Installation

```bash
git clone  https://github.com/artipsingh/arti_jobs
cd arti-jobs
npm install
```

### Configuration

Create a `.env` file in the project root:

```
VITE_ANTHROPIC_API_KEY=your_api_key_here
```

### Run locally

```bash
npm run dev
# Opens at http://localhost:5173
```

---

## How to Use

Paste a job posting and Claude returns a structured evaluation: fit score, strengths, gaps, verdict, and a subtext analysis (Real Talk) verified by a second LLM-as-judge call. Results are saved locally and exportable as CSV.

---

## Running the Tests

### JavaScript unit tests (Vitest)

Tests cover: CSV parsing, input sanitization (PII redaction, sensitive content flagging), the `evaluateJob` API function, and initial job data integrity.

```bash
npm test
```

42 tests, runs in ~1 second, no API calls required.

### Python LLM evaluation suite (pytest)

Tests cover: output schema validation, reasoning quality, experience citation, business rule enforcement (auto-skip conditions, salary floor/anchor gaps, fitScore/recommendation alignment), and prompt injection resistance.

```bash
cd tests/python
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install pytest requests

# Unit tests only (fixture data, no API calls):
pytest

# Live tests against the real Claude API:
pytest --live
```

76 tests total: 51 unit (fast, no API) + 25 live (require `--live` and a valid API key).

The security test suite (`test_security.py`) encodes three adversarial job postings as regression tests:
- **XML tag escape**: closes `</job_posting>` mid-posting and injects a fake JSON response — verifies `fitScore` is never a planted value
- **Instruction override**: buries "Ignore all scoring rules" in the requirements list — verifies gaps are still scored
- **Role-change**: tells Claude it is now a career coach — verifies it still applies hard-requirement caps

All three run in CI on every push with no API calls. The live variants call the real API and additionally assert that `realTalk` never echoes injection instructions back.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite (JavaScript) |
| AI | Claude API (`claude-sonnet-4-20250514`) |
| API proxy | Vite `configureServer` middleware (avoids CORS, keeps API key server-side) |
| Persistence | Local `data/jobs.json` via custom Vite plugin endpoints |
| JS tests | Vitest |
| Python tests | pytest |
| Fonts | DM Mono + Syne (Google Fonts) |

---

## Project Structure

```
arti_jobs/
├── src/
│   ├── JobTracker.jsx          # Main app shell — composes hooks + views
│   ├── constants.js            # FIT_COLORS, STATUS_OPTIONS
│   ├── api/
│   │   ├── evaluateJob.js      # Claude API call + sanitization
│   │   ├── evaluateJob.test.js
│   │   └── judgeRealTalk.js    # LLM-as-judge: second Claude call verifying realTalk
│   ├── components/
│   │   ├── ErrorBoundary.jsx   # React error boundary
│   │   ├── EvaluateView.jsx    # Evaluate tab UI
│   │   ├── JobCard.jsx         # Dashboard list row
│   │   ├── JobDetail.jsx       # Full detail panel
│   │   └── RealTalkCard.jsx    # Real Talk display + judge verdict badge
│   ├── hooks/
│   │   ├── useEvaluate.js      # Evaluation state: posting, result, judge, loading
│   │   └── useJobs.js          # Jobs state: CRUD, persistence, import/export
│   ├── prompts/
│   │   └── systemPrompt.js     # System prompt (imports resume + rules from txt files)
│   └── utils/
│       ├── csv.js              # Export/import helpers
│       ├── csv.test.js
│       ├── sanitize.js         # PII redaction + sensitive content flagging
│       └── sanitize.test.js
├── data/
│   └── resume.txt              # Plain text resume (imported by system prompt)
├── tests/
│   ├── e2e/                    # Playwright end-to-end tests
│   ├── helpers/
│   │   ├── selfHealingLocator.ts  # L2: fallback selector chain with healing log
│   │   └── aiHealer.ts            # L3: Claude AI healer for broken locators
│   └── python/
│       ├── conftest.py            # Fixtures, call_claude(), job posting constants
│       ├── test_output_format.py
│       ├── test_output_quality.py
│       ├── test_business_rules.py
│       └── test_security.py       # Prompt injection + adversarial input resistance
└── vite.config.js              # Anthropic proxy + jobs persistence plugins
```

---

## Why This Project Exists

I'm a Senior SDET with 14 years of experience who was laid off in March 2026. I built this tool to solve a real problem (tracking job applications during a job search) while also demonstrating that I can build *and* test AI-powered applications — not just test someone else's.

The engineering decisions here are deliberate portfolio choices:

**LLM-as-judge** — a second Claude call verifies the first call's `realTalk` output for grounded claims. This is the pattern used in production AI systems to detect hallucinations without human review at scale.

**Purple team security testing** — I ran adversarial job postings against the system (XML tag escape injection, instruction override, role-change attacks) and encoded the results as pytest regression tests. The defenses held; the tests lock that in permanently.

**Self-healing Playwright tests** — two-level architecture: L2 tries fallback selectors and logs healing events to a JSON file; L3 captures the DOM, sends it to Claude, and asks it to suggest a working selector. The AI healer is guarded behind `ENABLE_AI_HEALING=true` to prevent accidental token consumption.

**Deterministic LLM validation** — pytest tests assert output schema, reasoning quality, experience citation, and business rule enforcement without using another LLM to judge. This keeps the test suite fast, cheap, and auditable.
