const CSV_HEADERS = ["id", "company", "role", "salary", "fitScore", "verdict", "strengths", "gaps", "recommendation", "status", "dateAdded"];

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
    ].map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")
  );
  return [CSV_HEADERS.join(","), ...rows].join("\n");
}

export function csvToJobs(csvText) {
  const lines = csvText.trim().split("\n");
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const job = {};
    CSV_HEADERS.forEach((h, i) => { job[h] = values[i] ?? ""; });
    job.strengths = job.strengths ? job.strengths.split("; ") : [];
    job.gaps = job.gaps ? job.gaps.split("; ") : [];
    return job;
  });
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
