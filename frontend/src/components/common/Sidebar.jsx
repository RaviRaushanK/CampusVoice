import { NavLink } from "react-router-dom";

const Sidebar = ({ brand, navItems, isOpen, onClose, onLogout, loggingOut }) => {

  const handleItemClick = async (item) => {
    onClose();
    if (item.action === "logout" && onLogout) {
      await onLogout();
    }
  };

  return (
    <>
      <aside id="app-sidebar" className={`app-sidebar ${isOpen ? "is-open" : ""}`} aria-label={`${brand} navigation`}>
        <div className="sidebar-brand">
          <span className="brand-mark" aria-hidden="true">
            CV
          </span>
          <div>
            <p className="brand-title mb-0">CampusVoice</p>
            <span>{brand}</span>
          </div>
          <button className="btn btn-icon d-lg-none ms-auto" type="button" onClick={onClose} aria-label="Close navigation">
            <i className="bi bi-x-lg" aria-hidden="true"></i>
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) =>
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
              <NavLink key={item.label} to={item.path} className="sidebar-link" onClick={onClose}>
                <i className={`bi ${item.icon}`} aria-hidden="true"></i>
                <span>{item.label}</span>
              </NavLink>
            )
          )}
        </nav>
      </aside>
      {isOpen && <button className="sidebar-backdrop d-lg-none" type="button" aria-label="Close navigation" onClick={onClose} />}
    </>
  );
};

export default Sidebar;
