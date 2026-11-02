import { useEffect, useId, useState } from "react";
import { listAcademic } from "../../services/academicService";
import AlertMessage from "../common/AlertMessage";
const RecordSelect = ({ label, name, resource, value, onChange, currentLabel, describe }) => {
  const id = useId();
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { const timer = setTimeout(() => setTerm(search), 300); return () => clearTimeout(timer); }, [search]);
  useEffect(() => {
    let active = true; const controller = new AbortController(); setLoading(true); setError("");
    listAcademic(resource, { search: term, status: "active", limit: 100 }, { signal: controller.signal }).then(result => {
      if (active) { setItems(result.data.items); setMore(result.data.pagination.hasNextPage); }
    }).catch(err => { if (active && err.name !== "AbortError") setError(`Unable to load ${label.toLowerCase()} options.`); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [resource, term, label, attempt]);
  return <div className="col-sm-6">
    <label htmlFor={id} className="form-label">{label}</label>
    <input className="form-control mb-2" aria-label={`Find ${label}`} placeholder={`Search ${label.toLowerCase()}`} value={search} onChange={event => setSearch(event.target.value)} maxLength={100} />
    <select id={id} name={name} className="form-select" value={value} onChange={event => onChange(event.target.value)} required>
      <option value="">{loading ? "Loading options..." : `Choose ${label.toLowerCase()}`}</option>
      {value && !items.some(item => item.id === value) && <option value={value}>{currentLabel || "Current selection"}</option>}
      {items.map(item => <option key={item.id} value={item.id}>{describe(item)}</option>)}
    </select>
    {more && <p className="form-text">Refine the search to find more options.</p>}
    {error && <><AlertMessage type="danger" message={error} /><button type="button" className="btn btn-link" onClick={() => setAttempt(number => number + 1)}>Retry options</button></>}
  </div>;
};
export default RecordSelect;
