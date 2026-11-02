import NotificationBell from "../notifications/NotificationBell";

const Navbar = ({ title, onMenuClick, user, onLogout, loggingOut }) => {
  return <header className="app-navbar">
    <button className="btn btn-icon d-lg-none" type="button" onClick={onMenuClick} aria-label="Open navigation"><i className="bi bi-list" aria-hidden="true" /></button>
    <div className="navbar-identity"><p className="navbar-eyebrow mb-0">{user?.role}</p><h1 className="navbar-title mb-0">{title}</h1><span className="text-muted small">{user?.name}</span></div>
    <div className="navbar-actions ms-auto d-flex align-items-center gap-2">
      {user && <NotificationBell />}
      <button className="btn btn-outline-secondary flex-shrink-0" type="button" onClick={onLogout} disabled={loggingOut}><i className="bi bi-box-arrow-right me-2" aria-hidden="true" />{loggingOut ? "Logging out..." : "Logout"}</button>
    </div>
  </header>;
};
export default Navbar;
