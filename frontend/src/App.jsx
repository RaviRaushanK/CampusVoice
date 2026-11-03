import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import PrincipalLayout from "./layouts/PrincipalLayout";
import HodLayout from "./layouts/HodLayout";
import FacultyLayout from "./layouts/FacultyLayout";
import StudentLayout from "./layouts/StudentLayout";
import PrincipalDashboard from "./pages/principal/PrincipalDashboard";
import HodDashboard from "./pages/hod/HodDashboard";
import FacultyDashboard from "./pages/faculty/FacultyDashboard";
import MySessions from "./pages/faculty/MySessions";
import SessionEditor from "./pages/faculty/SessionEditor";
import SessionResults from "./pages/faculty/SessionResults";
import StudentDashboard from "./pages/student/StudentDashboard";
import FeedbackSessions from "./pages/student/FeedbackSessions";
import SessionQuestionnaire from "./pages/student/SessionQuestionnaire";
import Login from "./pages/auth/Login";
import ChangePassword from "./pages/auth/ChangePassword";
import ProtectedRoute from "./routes/ProtectedRoute";
import Profile from "./pages/profile/Profile";
import Notifications from "./pages/notifications/Notifications";
import { NotificationProvider } from "./context/NotificationContext";
import { Departments, Hods, Faculty, Students, Subjects, Classes, FacultyAssignments, MyAssignments } from "./pages/academic/AcademicPages";
import StudentGeneralFeedback from "./pages/student/GeneralFeedback";
import StudentSuggestions from "./pages/student/Suggestions";
import FacultyGeneralFeedback from "./pages/faculty/GeneralFeedback";
import FacultySuggestions from "./pages/faculty/Suggestions";
import DepartmentGeneralFeedback from "./pages/hod/GeneralFeedback";
import FeedbackOverview from "./pages/principal/FeedbackOverview";
import RaiseComplaint from "./pages/student/RaiseComplaint";
import ComplaintList from "./components/complaints/ComplaintList";
import ComplaintDetail from "./components/complaints/ComplaintDetail";
import AnalyticsPage from "./components/analytics/AnalyticsPage";
import ComplaintProcessing from "./components/analytics/ComplaintProcessing";

const SharedRoleLayout = () => {
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
      <NotificationProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/change-password" element={<ProtectedRoute allowPasswordChange><ChangePassword /></ProtectedRoute>} />
        <Route element={<ProtectedRoute><SharedRoleLayout /></ProtectedRoute>}>
          <Route path="/profile" element={<Profile />} />
          <Route path="/notifications" element={<Notifications />} />
        </Route>
        <Route element={<ProtectedRoute expectedRole="PRINCIPAL"><SharedRoleLayout /></ProtectedRoute>}>
          <Route path="/departments" element={<Departments />} /><Route path="/hods" element={<Hods />} />
          <Route path="/principal/feedback-overview" element={<FeedbackOverview />} />
          <Route path="/principal/complaints" element={<ComplaintList />} />
          <Route path="/principal/analytics" element={<AnalyticsPage />} />
          <Route path="/principal/complaint-processing" element={<ComplaintProcessing />} />
          <Route path="/principal/complaints/:complaintId" element={<ComplaintDetail />} />
        </Route>
        <Route element={<ProtectedRoute expectedRole="HOD"><SharedRoleLayout /></ProtectedRoute>}>
          <Route path="/faculty" element={<Faculty />} /><Route path="/students" element={<Students />} />
          <Route path="/subjects" element={<Subjects />} /><Route path="/classes" element={<Classes />} />
          <Route path="/faculty-assignments" element={<FacultyAssignments />} />
          <Route path="/hod/general-feedback" element={<DepartmentGeneralFeedback />} />
          <Route path="/hod/complaints" element={<ComplaintList />} />
          <Route path="/hod/analytics" element={<AnalyticsPage />} />
          <Route path="/hod/complaint-processing" element={<ComplaintProcessing />} />
          <Route path="/hod/complaints/:complaintId" element={<ComplaintDetail />} />
        </Route>
        <Route element={<ProtectedRoute expectedRole="FACULTY"><SharedRoleLayout /></ProtectedRoute>}>
          <Route path="/my-assignments" element={<MyAssignments />} />
          <Route path="/my-sessions" element={<MySessions />} />
          <Route path="/my-sessions/new" element={<SessionEditor />} />
          <Route path="/my-sessions/:sessionId/edit" element={<SessionEditor />} />
          <Route path="/my-sessions/:sessionId/results" element={<SessionResults />} />
          <Route path="/faculty/general-feedback" element={<FacultyGeneralFeedback />} />
          <Route path="/faculty/suggestions" element={<FacultySuggestions />} />
          <Route path="/faculty/complaints" element={<ComplaintList />} />
          <Route path="/faculty/analytics" element={<AnalyticsPage />} />
          <Route path="/faculty/complaint-processing" element={<ComplaintProcessing />} />
          <Route path="/faculty/complaints/:complaintId" element={<ComplaintDetail />} />
        </Route>
        <Route element={<ProtectedRoute expectedRole="STUDENT"><SharedRoleLayout /></ProtectedRoute>}>
          <Route path="/feedback-sessions" element={<FeedbackSessions />} />
          <Route path="/feedback-sessions/:sessionId/respond" element={<SessionQuestionnaire />} />
          <Route path="/student/general-feedback" element={<StudentGeneralFeedback />} />
          <Route path="/student/suggestions" element={<StudentSuggestions />} />
          <Route path="/student/complaints/new" element={<RaiseComplaint />} />
          <Route path="/student/complaints" element={<ComplaintList />} />
          <Route path="/student/complaints/:complaintId" element={<ComplaintDetail />} />
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
      </NotificationProvider>
    </AuthProvider>
  );
};

export default App;
