# arti.jobs — AI-Powered Job Search Tracker

[![CI](https://github.com/artipsingh/arti_jobs/actions/workflows/ci.yml/badge.svg)](https://github.com/artipsingh/arti_jobs/actions/workflows/ci.yml)

A job evaluation and tracking tool built to demonstrate AI quality engineering in practice.

Paste a job posting, and the app uses the Claude API to evaluate fit against a specific candidate profile — returning a structured assessment with a fit score, strengths, gaps, and a recommendation. Results are saved locally so you can track every role in one place.

Built as a portfolio project to showcase:
- Prompt engineering for structured, deterministic LLM output
- Input sanitization before sending data to an LLM (PII redaction, hyperlink stripping)
- Test automation against LLM responses (Vitest unit tests + pytest LLM evaluation suite)
- Full-stack AI application design with React + Vite

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

### Evaluate a job posting
1. Open the app at `http://localhost:5173`
2. Paste a full job posting into the text area
3. Click **Evaluate** — Claude assesses fit and returns:
   - **Fit score**: Strong / Moderate / Stretch / Skip
   - **Recommendation**: Apply / Consider / Skip
   - **Strengths**: resume elements that match the role
   - **Gaps**: requirements not covered by the resume
   - **Verdict**: one-sentence summary

### Track your applications
- Change the status of any role (Applied, Reaching out, Interview scheduled, etc.)
- Click any card to see the full strengths vs gaps breakdown
- Delete roles you no longer want to track

### Export / Import
- **Export CSV**: Downloads all tracked roles as a `.csv` file — useful for backups or spreadsheet analysis
- **Import CSV**: Re-load a previously exported file to restore your tracker

Job data is saved automatically to `data/jobs.json` on your local machine (gitignored).

---

## Running the Tests

### JavaScript unit tests (Vitest)

Tests cover: CSV parsing, input sanitization (PII redaction, sensitive content flagging), the `evaluateJob` API function, and initial job data integrity.

```bash
npm test
```

42 tests, runs in ~1 second, no API calls required.

### Python LLM evaluation suite (pytest)

Tests cover: output schema validation, reasoning quality, experience citation, and business rule enforcement (auto-skip conditions, salary floor/anchor gaps, fitScore/recommendation alignment).

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

49 tests total: 34 unit (fast, no API) + 15 live (require `--live` and a valid API key).

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
│   ├── JobTracker.jsx          # Main app component
│   ├── constants.js            # FIT_COLORS, STATUS_OPTIONS
│   ├── api/
│   │   ├── evaluateJob.js      # Claude API call + hyperlink stripping
│   │   └── evaluateJob.test.js
│   ├── components/
│   │   ├── JobCard.jsx         # Dashboard list row
│   │   └── JobDetail.jsx       # Full detail panel
│   ├── prompts/
│   │   └── systemPrompt.js     # System prompt (imports resume.txt)
│   └── utils/
│       ├── csv.js              # Export/import helpers
│       ├── csv.test.js
│       ├── sanitize.js         # PII redaction + sensitive content flagging
│       └── sanitize.test.js
├── data/
│   └── resume.txt              # Plain text resume (imported by system prompt)
├── tests/
│   └── python/
│       ├── conftest.py         # Fixtures, call_claude(), job posting constants
│       ├── test_output_format.py
│       ├── test_output_quality.py
│       └── test_business_rules.py
└── vite.config.js              # Anthropic proxy + jobs persistence plugins
```

---

## Why This Project Exists

I'm a Senior SDET with 14 years of experience who was laid off in March 2026. I built this tool to solve a real problem (tracking job applications during a job search) while also demonstrating that I can build *and* test AI-powered applications — not just test someone else's.

The test suite is the portfolio piece: it shows how to validate LLM outputs systematically using deterministic rules, fixture data, and live API evaluation — skills that are increasingly valuable as AI features become standard in software products.
