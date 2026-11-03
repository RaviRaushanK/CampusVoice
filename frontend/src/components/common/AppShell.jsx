import { useAuth } from "../../context/AuthContext";
import { useCallback, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

const AppShell = ({ roleName, navItems, user, onLogout }) => {
  const { error, loggingOut } = useAuth();
  const { pathname } = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);

  return (
    <div className="app-shell">
      <a className="cv-sr-link" href="#main-content">Skip to main content</a>
      <Sidebar
        brand={roleName}
        navItems={navItems}
        isOpen={isSidebarOpen}
        onClose={closeSidebar}
        onLogout={onLogout}
        loggingOut={loggingOut}
      />
      <div className="app-content">
        <Navbar
          title={`${roleName} ${pathname.endsWith("/dashboard") ? "Dashboard" : "Workspace"}`}
          onMenuClick={() => setIsSidebarOpen(true)}
          menuOpen={isSidebarOpen}
          user={user}
          onLogout={onLogout}
          loggingOut={loggingOut}
        />
        <main id="main-content" className="main-content" tabIndex="-1">
          {error && <div className="alert alert-danger" role="alert">{error}</div>}
          <Outlet />
        </main>
        <footer className="app-footer" aria-label="CampusVoice footer">
          <span><strong>CampusVoice</strong><span className="footer-separator" aria-hidden="true"> / </span>College feedback, surveys &amp; grievances</span>
          <span>&copy; {new Date().getFullYear()} CampusVoice</span>
        </footer>
      </div>
    </div>
  );
};

export default AppShell;
