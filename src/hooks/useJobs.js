import { useState, useEffect, useRef } from "react";
import INITIAL_JOBS from "../../data/initialJobs.js";
import { csvToJobs } from "../utils/csv.js";

const STORAGE_KEY = "arti-jobs";

export function useJobs() {
  const [jobs, setJobs] = useState(INITIAL_JOBS);
  const [jobsLoaded, setJobsLoaded] = useState(false);
  const importRef = useRef(null);

  // Load from file on startup, fall back to localStorage for migration
  useEffect(() => {
    fetch("/api/jobs")
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setJobs(data);
        } else {
          try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) setJobs(JSON.parse(saved));
          // eslint-disable-next-line no-empty
          } catch {}
        }
        setJobsLoaded(true);
      })
      .catch(() => {
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) setJobs(JSON.parse(saved));
        // eslint-disable-next-line no-empty
        } catch {}
        setJobsLoaded(true);
      });
  }, []);

  // Save to file whenever jobs change (after initial load)
  useEffect(() => {
    if (!jobsLoaded) return;
    fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(jobs),
    }).catch(() => {});
  }, [jobs, jobsLoaded]);

  function updateStatus(id, status) {
    const date = new Date().toISOString().split("T")[0];
    const appendHistory = (j) => ({
      ...j,
      status,
      statusHistory: [...(j.statusHistory || []), { status, date }],
    });
    setJobs(prev => prev.map(j => j.id === id ? appendHistory(j) : j));
  }

  function updateField(id, field, value) {
    const updater = (j) => {
      const updated = { ...j, [field]: value };
      if (field === "appliedDate" && value) {
        const alreadyLogged = (j.statusHistory || []).some(
          e => e.status === "Applied ✅" && e.date === value
        );
        if (!alreadyLogged) {
          updated.statusHistory = [...(j.statusHistory || []), { status: "Applied ✅", date: value }];
        }
      }
      return updated;
    };
    setJobs(prev => prev.map(j => j.id === id ? updater(j) : j));
  }

  function deleteJob(id) {
    setJobs(prev => prev.filter(j => j.id !== id));
  }

  function addJob(job) {
    setJobs(prev => [job, ...prev]);
  }

  function importCSV(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        setJobs(csvToJobs(ev.target.result));
      } catch {
        alert("Failed to parse CSV. Make sure it was exported from arti.jobs.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return { jobs, importRef, updateStatus, updateField, deleteJob, addJob, importCSV };
}
