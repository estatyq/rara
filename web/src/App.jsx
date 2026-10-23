import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';

// Patient Pages
import PatientDashboard from './pages/patient/Dashboard';
import PatientMedications from './pages/patient/Medications';
import PatientChat from './pages/patient/Chat';
import PatientEducation from './pages/patient/Education';
import ArticleDetail from './pages/patient/ArticleDetail';
import PatientSurveys from './pages/patient/Surveys';
import PatientProfile from './pages/patient/Profile';

// Staff Pages
import StaffDashboard from './pages/staff/Dashboard';
import StaffPatientDetail from './pages/staff/PatientDetail';
import StaffConversations from './pages/staff/Conversations';
import StaffEducationManager from './pages/staff/EducationManager';
import StaffQuestionnairesManager from './pages/staff/QuestionnairesManager';
import ResearchExport from './pages/staff/ResearchExport';

function ProtectedLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}

function PatientRoute({ children }) {
  const { isStaff } = useAuth();
  if (isStaff) return <Navigate to="/staff" replace />;
  return children;
}

function StaffRoute({ children }) {
  const { isStaff } = useAuth();
  if (!isStaff) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Authenticated Routes with Navbar */}
      <Route element={<ProtectedLayout />}>
        {/* Patient Portal */}
        <Route path="/" element={<PatientRoute><PatientDashboard /></PatientRoute>} />
        <Route path="/medications" element={<PatientRoute><PatientMedications /></PatientRoute>} />
        <Route path="/chat" element={<PatientRoute><PatientChat /></PatientRoute>} />
        <Route path="/education" element={<PatientRoute><PatientEducation /></PatientRoute>} />
        <Route path="/education/:slug" element={<PatientRoute><ArticleDetail /></PatientRoute>} />
        <Route path="/surveys" element={<PatientRoute><PatientSurveys /></PatientRoute>} />
        <Route path="/profile" element={<PatientRoute><PatientProfile /></PatientRoute>} />

        {/* Staff & Researcher Portal */}
        <Route path="/staff" element={<StaffRoute><StaffDashboard /></StaffRoute>} />
        <Route path="/staff/patients/:id" element={<StaffRoute><StaffPatientDetail /></StaffRoute>} />
        <Route path="/staff/inbox" element={<StaffRoute><StaffConversations /></StaffRoute>} />
        <Route path="/staff/education" element={<StaffRoute><StaffEducationManager /></StaffRoute>} />
        <Route path="/staff/questionnaires" element={<StaffRoute><StaffQuestionnairesManager /></StaffRoute>} />
        <Route path="/staff/export" element={<StaffRoute><ResearchExport /></StaffRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
