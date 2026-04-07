#!/usr/bin/env python3
"""
job_search.py — Automated job search pipeline

Runs twice daily Mon-Fri via cron:
  0 8,14 * * 1-5 /path/to/python3 /path/to/scripts/job_search.py

For each search term in search_config.json:
  - Calls JSearch API (remote → Canada-wide, otherwise Toronto)
  - Deduplicates against data/seen_jobs.json
  - Evaluates new jobs with Claude API
  - Emails Strong/Moderate results
  - Adds Strong/Moderate jobs to data/jobs.json with source: "auto-scan"
  - Saves all seen job IDs back to data/seen_jobs.json
"""

import json
import os
import re
import smtplib
import sys
import time
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

import requests

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT = Path(__file__).parent.parent
CONFIG_FILE = ROOT / "scripts" / "search_config.json"
SEEN_JOBS_FILE = ROOT / "data" / "seen_jobs.json"
JOBS_FILE = ROOT / "data" / "jobs.json"
RESUME_PATH = ROOT / "data" / "resume.txt"
ENV_PATH = ROOT / ".env"
PROMPTS_PATH = ROOT / "src" / "prompts"
PROMPT_TEMPLATE_PATH = PROMPTS_PATH / "promptTemplate.txt"
SALARY_RULES_PATH = PROMPTS_PATH / "salaryRules.txt"
EXPERIENCE_MAPPING_PATH = PROMPTS_PATH / "experienceMapping.txt"
SKIP_CONDITIONS_PATH = PROMPTS_PATH / "skipConditions.txt"

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------
def load_env():
    """Load .env into os.environ."""
    if not ENV_PATH.exists():
        return
    for line in ENV_PATH.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())


def require_env(key):
    value = os.environ.get(key)
    if not value:
        print(f"ERROR: {key} not set in .env", file=sys.stderr)
        sys.exit(1)
    return value


# ---------------------------------------------------------------------------
# Config + state
# ---------------------------------------------------------------------------
def load_config():
    with open(CONFIG_FILE) as f:
        return json.load(f)


def load_seen_jobs():
    if SEEN_JOBS_FILE.exists():
        with open(SEEN_JOBS_FILE) as f:
            return set(json.load(f))
    return set()


def save_seen_jobs(seen):
    SEEN_JOBS_FILE.parent.mkdir(exist_ok=True)
    with open(SEEN_JOBS_FILE, "w") as f:
        json.dump(sorted(seen), f, indent=2)


def load_jobs_tracker():
    if JOBS_FILE.exists():
        with open(JOBS_FILE) as f:
            return json.load(f)
    return []


def save_jobs_tracker(jobs):
    with open(JOBS_FILE, "w") as f:
        json.dump(jobs, f, indent=2)


# ---------------------------------------------------------------------------
# Mock JSearch data (used with --mock-jsearch to avoid burning API quota)
# ---------------------------------------------------------------------------
def _mock_jsearch_results():
    """Returns one realistic fake job to exercise the full pipeline."""
    return [
        {
            "job_id": "mock-job-001",
            "job_title": "Senior SDET",
            "employer_name": "Mock Corp",
            "job_description": (
                "We are looking for a Senior SDET to own our test automation platform. "
                "You will build and maintain Cypress E2E suites, integrate with Jenkins CI/CD pipelines, "
                "and work closely with developers to shift quality left. "
                "Requirements: 5+ years QA/SDET experience, Cypress or Selenium, "
                "CI/CD experience (Jenkins, GitHub Actions), REST API testing (Postman, Newman). "
                "Salary: CA$130,000 - CA$150,000. Remote-friendly."
            ),
            "job_is_remote": True,
            "job_city": "Toronto",
            "job_state": "ON",
            "job_country": "Canada",
            "job_min_salary": 130000,
            "job_max_salary": 150000,
            "job_salary_currency": "CA$",
            "job_apply_link": "https://example.com/apply/mock-job-001",
        }
    ]


# ---------------------------------------------------------------------------
# JSearch API
# ---------------------------------------------------------------------------
def search_jobs(query, location, remote_only, api_key):
    """
    Search JSearch API for a single query term.
    Returns a list of raw job objects.
    """
    url = "https://jsearch.p.rapidapi.com/search"
    params = {
        "query": f"{query} in {location}",
        "date_posted": "today",
        "remote_jobs_only": "true" if remote_only else "false",
        "num_pages": "1",
    }
    headers = {
        "X-RapidAPI-Key": api_key,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
    }
    try:
        time.sleep(7)  # JSearch free tier: ~10 req/min — 7s gap keeps us safely under
        response = requests.get(url, headers=headers, params=params, timeout=30)
        response.raise_for_status()
        return response.json().get("data", [])
    except requests.RequestException as e:
        print(f"  JSearch error for '{query}': {e}", file=sys.stderr)
        return []


def build_posting_text(job):
    """Convert a JSearch job object to plain text for Claude."""
    salary = "Not listed"
    if job.get("job_min_salary") and job.get("job_max_salary"):
        currency = job.get("job_salary_currency", "CA$")
        salary = f"{currency}{job['job_min_salary']:,.0f} – {currency}{job['job_max_salary']:,.0f}"

    if job.get("job_is_remote"):
        location = "Remote"
    else:
        parts = [job.get("job_city", ""), job.get("job_state", ""), job.get("job_country", "")]
        location = ", ".join(p for p in parts if p)

    return f"""{job.get('job_title', 'Unknown Title')}
{job.get('employer_name', 'Unknown Company')}
{location}
Salary: {salary}

{job.get('job_description', '')}""".strip()


# ---------------------------------------------------------------------------
# Claude evaluation (mirrors conftest.py)
# ---------------------------------------------------------------------------
def _build_system_prompt():
    """Reconstruct the system prompt from source files — mirrors conftest.py."""
    template = PROMPT_TEMPLATE_PATH.read_text()
    return (
        template
        .replace("__SALARY_RULES__", SALARY_RULES_PATH.read_text())
        .replace("__EXPERIENCE_MAPPING__", EXPERIENCE_MAPPING_PATH.read_text())
        .replace("__SKIP_CONDITIONS__", SKIP_CONDITIONS_PATH.read_text())
        .replace("__RESUME__", RESUME_PATH.read_text())
    )


def evaluate_job(posting_text, api_key):
    """Call Claude and return parsed evaluation dict, or None on failure."""
    try:
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
                    {"role": "user", "content": f"Evaluate this job posting for Arti:\n\n{posting_text}"}
                ],
            },
            timeout=30,
        )
        response.raise_for_status()
        text = response.json()["content"][0]["text"]
        clean = re.sub(r"```json|```", "", text).strip()
        return json.loads(clean)
    except Exception as e:
        print(f"  Claude evaluation error: {e}", file=sys.stderr)
        return None


# ---------------------------------------------------------------------------
# Email
# ---------------------------------------------------------------------------
def build_email_html(matches):
    """Build an HTML email body for a list of evaluated job matches."""
    FIT_COLORS = {
        "Strong": "#10b981",
        "Moderate": "#f59e0b",
    }

    rows = ""
    for m in matches:
        color = FIT_COLORS.get(m["result"]["fitScore"], "#94a3b8")
        strengths = "".join(f"<li>{s}</li>" for s in m["result"].get("strengths", []))
        gaps = "".join(f"<li>{g}</li>" for g in m["result"].get("gaps", []))

        rows += f"""
        <div style="background:#0f1117;border:1px solid #1e2535;border-radius:12px;padding:24px;margin-bottom:20px;font-family:'Courier New',monospace;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
            <div>
              <div style="font-size:18px;font-weight:bold;color:#e2e8f0;">{m["result"]["company"]}</div>
              <div style="font-size:13px;color:#64748b;margin-top:4px;">{m["result"]["role"]}</div>
              <div style="font-size:12px;color:#475569;margin-top:2px;">{m["result"]["salary"]}</div>
            </div>
            <span style="background:{color}22;color:{color};border:1px solid {color};border-radius:6px;padding:4px 12px;font-size:12px;font-weight:bold;">
              {m["result"]["fitScore"]}
            </span>
          </div>

          <div style="background:#070709;border-left:3px solid #6366f1;border-radius:6px;padding:12px;margin-bottom:16px;">
            <div style="font-size:10px;color:#475569;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">verdict</div>
            <div style="font-size:13px;color:#cbd5e1;">{m["result"]["verdict"]}</div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
            <div>
              <div style="font-size:10px;color:#475569;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">✓ strengths</div>
              <ul style="margin:0;padding-left:16px;color:#86efac;font-size:12px;">{strengths}</ul>
            </div>
            <div>
              <div style="font-size:10px;color:#475569;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">✗ gaps</div>
              <ul style="margin:0;padding-left:16px;color:#fca5a5;font-size:12px;">{gaps}</ul>
            </div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div style="font-size:11px;color:#475569;">
              recommendation: <span style="color:#a5b4fc;">{m["result"]["recommendation"]}</span>
            </div>
            <a href="{m.get('apply_link', '#')}" style="background:#6366f1;color:white;text-decoration:none;border-radius:6px;padding:6px 16px;font-size:12px;">
              view job →
            </a>
          </div>
        </div>"""

    run_time = datetime.now().strftime("%A %B %-d, %Y at %-I:%M %p")
    return f"""
    <div style="background:#0a0a0f;min-height:100vh;padding:32px;font-family:'Courier New',monospace;color:#e2e8f0;">
      <div style="max-width:700px;margin:0 auto;">
        <div style="margin-bottom:28px;">
          <div style="font-size:22px;font-weight:bold;color:#e2e8f0;">
            <span style="color:#6366f1;">arti</span>.jobs — new matches found
          </div>
          <div style="font-size:11px;color:#475569;margin-top:4px;">
            auto-scan · {run_time} · {len(matches)} role{"s" if len(matches) != 1 else ""}
          </div>
        </div>
        {rows}
        <div style="font-size:10px;color:#334155;margin-top:24px;text-align:center;">
          All matched roles have been added to your arti.jobs tracker with source: auto-scan
        </div>
      </div>
    </div>"""


def send_email(matches, config, gmail_address, gmail_app_password):
    """Send HTML email with matched jobs."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"arti.jobs — {len(matches)} new match{'es' if len(matches) != 1 else ''} found"
    msg["From"] = gmail_address
    msg["To"] = config["notification_email"]

    html = build_email_html(matches)
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(gmail_address, gmail_app_password)
        server.sendmail(gmail_address, config["notification_email"], msg.as_string())

    print(f"  Email sent to {config['notification_email']}")


# ---------------------------------------------------------------------------
# Tracker integration
# ---------------------------------------------------------------------------
def add_to_tracker(job, result):
    """Append an auto-scanned job to data/jobs.json."""
    tracker = load_jobs_tracker()
    new_entry = {
        **result,
        "id": int(datetime.now().timestamp() * 1000),
        "status": "Considering 🤔",
        "dateAdded": datetime.now().strftime("%Y-%m-%d"),
        "source": "auto-scan",
        "applyLink": job.get("job_apply_link", ""),
    }
    tracker.insert(0, new_entry)
    save_jobs_tracker(tracker)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    dry_run = "--dry-run" in sys.argv
    mock_jsearch = "--mock-jsearch" in sys.argv

    load_env()

    jsearch_key = require_env("JSEARCH_API_KEY")
    anthropic_key = require_env("VITE_ANTHROPIC_API_KEY")
    gmail_address = require_env("GMAIL_ADDRESS")
    gmail_app_password = require_env("GMAIL_APP_PASSWORD")

    config = load_config()
    seen = load_seen_jobs()

    print(f"\n{'='*60}")
    print(f"arti.jobs auto-scan — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    if dry_run:
        print("DRY RUN — no writes to jobs.json, seen_jobs.json, or email")
    if mock_jsearch:
        print("MOCK JSEARCH — no JSearch API calls, using hardcoded test job")
    print(f"{'='*60}")

    all_new_jobs = []

    # Search once remote (Canada-wide) and once local (Toronto) per term
    search_runs = [
        (True,  config["remote_location"]),
        (False, config["local_location"]),
    ]

    for search_term in config["search_terms"]:
        for remote_only, location in search_runs:
            label = "remote" if remote_only else "local"
            print(f"\n→ '{search_term}' [{label}]")

            if mock_jsearch:
                jobs = _mock_jsearch_results()
                print(f"  {len(jobs)} results (MOCKED — no API call made)")
            else:
                jobs = search_jobs(search_term, location, remote_only, jsearch_key)
                print(f"  {len(jobs)} results from JSearch")

            if dry_run and jobs:
                # Print first result's raw keys so we can verify field names
                print(f"  Sample fields: {list(jobs[0].keys())}")
                sample = jobs[0]
                print(f"  Sample job_id:      {sample.get('job_id')}")
                print(f"  Sample job_title:   {sample.get('job_title')}")
                print(f"  Sample employer:    {sample.get('employer_name')}")
                print(f"  Sample is_remote:   {sample.get('job_is_remote')}")
                print(f"  Sample city:        {sample.get('job_city')}")
                print(f"  Sample min_salary:  {sample.get('job_min_salary')}")
                print(f"  Sample apply_link:  {sample.get('job_apply_link', '')[:60]}...")

            for job in jobs:
                job_id = job.get("job_id")
                if not job_id or job_id in seen:
                    continue
                if not dry_run:
                    seen.add(job_id)
                all_new_jobs.append((search_term, job))

    print(f"\n{'─'*60}")
    print(f"New jobs to evaluate: {len(all_new_jobs)}")

    # In dry-run, cap evaluations at 3 to avoid burning API credits
    jobs_to_evaluate = all_new_jobs[:3] if dry_run else all_new_jobs
    if dry_run and len(all_new_jobs) > 3:
        print(f"DRY RUN — evaluating first 3 of {len(all_new_jobs)} to save API credits")

    matches = []

    for search_term, job in jobs_to_evaluate:
        title = job.get("job_title", "?")
        company = job.get("employer_name", "?")
        print(f"\n  Evaluating: {title} @ {company}")

        posting_text = build_posting_text(job)
        result = evaluate_job(posting_text, anthropic_key)

        if not result:
            print(f"    ✗ evaluation failed, skipping")
            continue

        fit = result.get("fitScore", "")
        print(f"    fitScore:       {fit}")
        print(f"    recommendation: {result.get('recommendation')}")
        print(f"    verdict:        {result.get('verdict')}")

        if fit in ("Strong", "Moderate"):
            if dry_run:
                print(f"    ✓ match — DRY RUN, would add to tracker and send email")
            else:
                print(f"    ✓ match — adding to tracker")
                add_to_tracker(job, result)
            matches.append({
                "result": result,
                "apply_link": job.get("job_apply_link", ""),
            })
        else:
            print(f"    — {fit}, skipping")

    if not dry_run:
        save_seen_jobs(seen)

    print(f"\n{'─'*60}")
    print(f"Matches found: {len(matches)}")

    if matches and not dry_run:
        print("Sending email...")
        try:
            send_email(matches, config, gmail_address, gmail_app_password)
        except Exception as e:
            print(f"  Email failed: {e}", file=sys.stderr)
    elif matches and dry_run:
        print("DRY RUN — email would be sent with the above matches")
    else:
        print("No Strong/Moderate matches — no email sent.")

    if not dry_run:
        print(f"\nDone. Seen jobs total: {len(seen)}")
    else:
        print(f"\nDry run complete. seen_jobs.json was NOT modified.")


if __name__ == "__main__":
    main()
