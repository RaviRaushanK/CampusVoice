import NotificationBell from "../notifications/NotificationBell";
import { Link } from "react-router-dom";

const Navbar = ({ title, onMenuClick, menuOpen, user, onLogout, loggingOut }) => {
  const initials = user?.name?.trim().split(/\s+/).slice(0, 2).map(word => Array.from(word)[0]).join("").toUpperCase() || "?";
  return <header className="app-navbar">
    <button className="btn btn-icon d-lg-none" type="button" onClick={onMenuClick} aria-label="Open navigation" aria-expanded={menuOpen} aria-controls="app-sidebar"><i className="bi bi-list" aria-hidden="true" /></button>
    <div className="navbar-identity"><p className="navbar-eyebrow mb-0">CampusVoice / {user?.role}</p><h1 className="navbar-title mb-0">{title}</h1></div>
    <div className="navbar-actions ms-auto">
      {user && <Link to="/profile" className="navbar-user" aria-label="Open my profile"><span className="cv-avatar" aria-hidden="true">{initials}</span><span className="navbar-user-details"><span className="navbar-user-name">{user.name}</span><small>{user.role}</small></span></Link>}
      {user && <NotificationBell />}
      <button className="btn btn-outline-secondary flex-shrink-0" type="button" onClick={onLogout} disabled={loggingOut}><i className="bi bi-box-arrow-right me-2" aria-hidden="true" />{loggingOut ? "Logging out..." : "Logout"}</button>
    </div>
  </header>;
};
export default Navbar;
