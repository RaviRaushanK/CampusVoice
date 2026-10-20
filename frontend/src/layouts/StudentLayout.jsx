import AppShell from "../components/common/AppShell";
import { studentNavItems } from "../routes/roleNavigation";
import { useAuth } from "../context/AuthContext";

const StudentLayout = () => {
  const { user, doLogout } = useAuth();
  return <AppShell roleName="Student" navItems={studentNavItems} user={user} onLogout={doLogout} />;
};

export default StudentLayout;
