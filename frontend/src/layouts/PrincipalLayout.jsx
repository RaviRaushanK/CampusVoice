import AppShell from "../components/common/AppShell";
import { principalNavItems } from "../routes/roleNavigation";
import { useAuth } from "../context/AuthContext";

const PrincipalLayout = () => {
  const { user, doLogout } = useAuth();
  return <AppShell roleName="Principal" navItems={principalNavItems} user={user} onLogout={doLogout} />;
};

export default PrincipalLayout;
