import AppShell from "../components/common/AppShell";
import { facultyNavItems } from "../routes/roleNavigation";
import { useAuth } from "../context/AuthContext";

const FacultyLayout = () => {
  const { user, doLogout } = useAuth();
  return <AppShell roleName="Faculty" navItems={facultyNavItems} user={user} onLogout={doLogout} />;
};

export default FacultyLayout;
