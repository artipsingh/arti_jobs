const CSV_HEADERS = ["id", "company", "role", "salary", "fitScore", "verdict", "strengths", "gaps", "recommendation", "status", "dateAdded", "statusHistory", "postingUrl"];

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (line[i] === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += line[i];
    }
  }
  result.push(current);
  return result;
}

export function serializeStatusHistory(history) {
  return (history || []).map(e => `${e.status}|${e.date}`).join("; ");
}

export function deserializeStatusHistory(str) {
  if (!str) return [];
  return str.split("; ").map(entry => {
    const pipeIdx = entry.lastIndexOf("|");
    return { status: entry.slice(0, pipeIdx), date: entry.slice(pipeIdx + 1) };
  }).filter(e => e.status && e.date);
}

export function jobsToCSV(jobs) {
  const rows = jobs.map(job =>
    [
      job.id,
      job.company,
      job.role,
      job.salary,
      job.fitScore,
      job.verdict,
      (job.strengths || []).join("; "),
      (job.gaps || []).join("; "),
      job.recommendation,
      job.status,
      job.dateAdded,
      serializeStatusHistory(job.statusHistory),
      job.postingUrl,
    ].map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")
  );
  return [CSV_HEADERS.join(","), ...rows].join("\n");
}

export function csvToJobs(csvText) {
  const lines = csvText.trim().split("\n");
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const job = {};
    headers.forEach((h, i) => { job[h] = values[i] ?? ""; });
    job.strengths = job.strengths ? job.strengths.split("; ") : [];
    job.gaps = job.gaps ? job.gaps.split("; ") : [];

    // Deserialize statusHistory if present, otherwise reconstruct from existing fields
    if (job.statusHistory) {
      job.statusHistory = deserializeStatusHistory(job.statusHistory);
    } else {
      job.statusHistory = buildStatusHistory(job);
    }

    return job;
  });
}

// Reconstruct audit trail from legacy data (no statusHistory column)
function buildStatusHistory(job) {
  const history = [];
  if (job.dateAdded) {
    history.push({ status: job.status || "Considering 🤔", date: job.dateAdded });
  }
  if (job.appliedDate && job.appliedDate !== job.dateAdded) {
    history.push({ status: "Applied ✅", date: job.appliedDate });
  }
  return history;
}

export function downloadCSV(jobs) {
  const blob = new Blob([jobsToCSV(jobs)], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "arti-jobs.csv";
  a.click();
  URL.revokeObjectURL(url);
}
