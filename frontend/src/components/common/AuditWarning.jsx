import { useEffect, useState } from "react";
const AuditWarning = () => {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const show = () => setVisible(true); window.addEventListener("audit:unconfirmed", show); return () => window.removeEventListener("audit:unconfirmed", show); }, []);
  return visible ? <div className="audit-warning alert alert-warning" role="alert"><p className="mb-2">Audit confirmation is unavailable. Review the current record before retrying or contact the administrator.</p><button className="btn btn-outline-secondary" onClick={() => setVisible(false)}>Dismiss audit notice</button></div> : null;
};
export default AuditWarning;
