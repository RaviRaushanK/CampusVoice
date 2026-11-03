import { NavLink } from "react-router-dom";
import { useEffect, useRef } from "react";

const Sidebar = ({ brand, navItems, isOpen, onClose, onLogout, loggingOut }) => {
  const drawer = useRef(null);
  useEffect(() => {
    if (!isOpen) return;
    const mobile = window.matchMedia("(max-width: 991.98px)");
    if (!mobile.matches) return;
    const previous = document.activeElement, previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const controls = () => [...drawer.current.querySelectorAll("*")].filter(element =>
      (element.matches("a[href]") || (element.tagName === "BUTTON" && !element.disabled)) && element.getClientRects().length);
    // Move focus after the 180ms drawer transition has made its controls visible.
    const focusTimer = window.setTimeout(() => controls()[0]?.focus({ preventScroll: true }), 200);
    const keydown = event => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key !== "Tab") return;
      const elements = controls();
      const first = elements[0], last = elements.at(-1);
      if (!drawer.current.contains(document.activeElement)) { event.preventDefault(); first?.focus(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const resize = () => { if (!mobile.matches) onClose(); };
    document.addEventListener("keydown", keydown); mobile.addEventListener("change", resize);
    return () => { window.clearTimeout(focusTimer); document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", keydown); mobile.removeEventListener("change", resize); previous?.focus(); };
  }, [isOpen, onClose]);

  const handleItemClick = async (item) => {
    onClose();
    if (item.action === "logout" && onLogout) {
      await onLogout();
    }
  };

  return (
    <>
      <aside ref={drawer} id="app-sidebar" className={`app-sidebar ${isOpen ? "is-open" : ""}`} aria-label={`${brand} navigation`}>
        <div className="sidebar-brand">
          <span className="brand-mark" aria-hidden="true">
            CV
          </span>
          <div>
            <p className="brand-title mb-0">CampusVoice</p>
            <small>{brand} workspace</small>
          </div>
          <button className="btn btn-icon d-lg-none ms-auto" type="button" onClick={onClose} aria-label="Close navigation">
            <i className="bi bi-x-lg" aria-hidden="true"></i>
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item, index) => <div key={item.label}>
            {(index === 0 || item.label === "Notifications") && <p className="sidebar-group-label">{index === 0 ? "Workspace" : "Your account"}</p>}
            {
            item.disabled ? (
              <button key={item.label} type="button" className="sidebar-link sidebar-placeholder" disabled>
                <i className={`bi ${item.icon}`} aria-hidden="true"></i>
                <span>{item.label}</span>
              </button>
            ) : item.action === "logout" ? (
              <button key={item.label} type="button" className="sidebar-link sidebar-command" disabled={loggingOut} onClick={() => handleItemClick(item)}>
                <i className={`bi ${item.icon}`} aria-hidden="true"></i>
                <span>{item.label}</span>
              </button>
            ) : (
              <NavLink key={item.label} to={item.path} end={item.label === "Raise Complaint" || item.label === "My Complaints"} className="sidebar-link" onClick={onClose}>
                <i className={`bi ${item.icon}`} aria-hidden="true"></i>
                <span>{item.label}</span>
              </NavLink>
            )}</div>
          )}
        </nav>
        <div className="sidebar-footer"><i className="bi bi-mortarboard me-2" aria-hidden="true" />College feedback &amp; support</div>
      </aside>
      {isOpen && <button className="sidebar-backdrop d-lg-none" type="button" aria-label="Close navigation" onClick={onClose} />}
    </>
  );
};

export default Sidebar;
