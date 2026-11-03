export default function IdentityChoice({ name, value, onChange }) {
  return <div className="cv-identity-options">{[
    ["ANONYMOUS", "Stay Anonymous", "Your identity is hidden from recipients.", "bi-shield-check"],
    ["NAMED", "Reveal Identity", "Recipients can see your name with this submission.", "bi-person-check"],
  ].map(([mode, title, description, icon]) => <label className="cv-identity-option" key={mode}>
    <input type="radio" name={name} checked={value === mode} onChange={() => onChange(mode)} aria-label={title} />
    <span><strong><i className={`bi ${icon} me-1`} aria-hidden="true" />{title}</strong><small>{description}</small></span>
  </label>)}</div>;
}
