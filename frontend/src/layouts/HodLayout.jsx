import AppShell from "../components/common/AppShell";
import { hodNavItems } from "../routes/roleNavigation";
import { useAuth } from "../context/AuthContext";

const HodLayout = () => {
  const { user, doLogout } = useAuth();
  return <AppShell roleName="HOD" navItems={hodNavItems} user={user} onLogout={doLogout} />;
};

export default HodLayout;
