import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LoadingSpinner from "../components/common/LoadingSpinner";
const ProtectedRoute = ({ expectedRole, allowPasswordChange = false, children }) => {
  const { user, loading, getDashboardPath } = useAuth();
  if (loading) return <div className="d-flex min-vh-100 justify-content-center align-items-center"><LoadingSpinner label="Verifying session" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword && !allowPasswordChange) return <Navigate to="/change-password" replace />;
  if (expectedRole && user.role !== expectedRole) return <Navigate to={getDashboardPath(user.role)} replace />;
  return children || <Outlet />;
};
export default ProtectedRoute;
