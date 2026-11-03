import { useAuth } from "../../context/AuthContext";
import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

const AppShell = ({ roleName, navItems, user, onLogout }) => {
  const { error, loggingOut } = useAuth();
  const { pathname } = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar
        brand={roleName}
        navItems={navItems}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onLogout={onLogout}
        loggingOut={loggingOut}
      />
      <div className="app-content">
        <Navbar
          title={`${roleName} ${pathname.endsWith("/dashboard") ? "Dashboard" : "Workspace"}`}
          onMenuClick={() => setIsSidebarOpen(true)}
          user={user}
          onLogout={onLogout}
          loggingOut={loggingOut}
        />
        <main className="main-content" tabIndex="-1">
          {error && <div className="alert alert-danger" role="alert">{error}</div>}
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppShell;
