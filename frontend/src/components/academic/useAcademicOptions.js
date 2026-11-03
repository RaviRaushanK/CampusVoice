import { useEffect, useState } from "react";
import { getAcademicOptions } from "../../services/academicService";
export default function useAcademicOptions(resource, status = "all", enabled = true) {
  const [data, setData] = useState({ academicYears: [], sections: [] });
  const [loading, setLoading] = useState(enabled), [error, setError] = useState(""), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let active = true; const controller = new AbortController(); setLoading(true); setError("");
    getAcademicOptions(resource, status, { signal: controller.signal }).then(result => { if (active) setData(result.data); })
      .catch(err => { if (active && err.name !== "AbortError") setError("Unable to load academic dropdown options. Please try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [resource, status, enabled, attempt]);
  return { ...data, loading, error, refresh: () => setAttempt(value => value + 1) };
}
