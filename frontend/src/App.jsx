import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import PrincipalLayout from "./layouts/PrincipalLayout";
import HodLayout from "./layouts/HodLayout";
import FacultyLayout from "./layouts/FacultyLayout";
import StudentLayout from "./layouts/StudentLayout";
import PrincipalDashboard from "./pages/principal/PrincipalDashboard";
import HodDashboard from "./pages/hod/HodDashboard";
import FacultyDashboard from "./pages/faculty/FacultyDashboard";
import StudentDashboard from "./pages/student/StudentDashboard";
import Login from "./pages/auth/Login";
import ChangePassword from "./pages/auth/ChangePassword";
import ProtectedRoute from "./routes/ProtectedRoute";
import Profile from "./pages/profile/Profile";

const ProfileLayout = () => {
  const { user } = useAuth();
  const Layout = { PRINCIPAL: PrincipalLayout, HOD: HodLayout, FACULTY: FacultyLayout, STUDENT: StudentLayout }[user.role];
  return <Layout />;
};

const DashboardRedirect = () => {
  const { user, getDashboardPath } = useAuth();
  return <Navigate to={getDashboardPath(user.role)} replace />;
};

const App = () => {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/change-password" element={<ProtectedRoute allowPasswordChange><ChangePassword /></ProtectedRoute>} />
        <Route element={<ProtectedRoute><ProfileLayout /></ProtectedRoute>}>
          <Route path="/profile" element={<Profile />} />
        </Route>

        <Route
          path="/principal"
          element={
            <ProtectedRoute expectedRole="PRINCIPAL">
              <PrincipalLayout />
            </ProtectedRoute>
          }
        >
          <Route
            path="dashboard"
            element={<PrincipalDashboard />}
          />
        </Route>

        <Route
          path="/hod"
          element={
            <ProtectedRoute expectedRole="HOD">
              <HodLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<HodDashboard />} />
        </Route>

        <Route
          path="/faculty"
          element={
            <ProtectedRoute expectedRole="FACULTY">
              <FacultyLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<FacultyDashboard />} />
        </Route>

        <Route
          path="/student"
          element={
            <ProtectedRoute expectedRole="STUDENT">
              <StudentLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<StudentDashboard />} />
        </Route>

        <Route path="/" element={<ProtectedRoute><DashboardRedirect /></ProtectedRoute>} />
        <Route path="*" element={<ProtectedRoute><DashboardRedirect /></ProtectedRoute>} />
      </Routes>
    </AuthProvider>
  );
};

export default App;
