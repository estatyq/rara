import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';

// Role-based code splitting (Patient never downloads Staff/Admin chunks!)
const PatientHomePage = lazy(() => import('./pages/patient/PatientHomePage'));
const HealthMonitorPage = lazy(() => import('./pages/patient/HealthMonitorPage'));
const EducationPage = lazy(() => import('./pages/patient/EducationPage'));
const ChatPage = lazy(() => import('./pages/patient/ChatPage'));
const ProfilePage = lazy(() => import('./pages/patient/ProfilePage'));
const StaffDashboardPage = lazy(() => import('./pages/staff/StaffDashboardPage'));

function Spinner() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full" />
    </div>
  );
}

function ProtectedLayout() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <AppShell>
      <Suspense fallback={<Spinner />}>
        <Outlet />
      </Suspense>
    </AppShell>
  );
}

export default function App() {
  const { isStaff } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={isStaff ? <Navigate to="/staff" replace /> : <PatientHomePage />} />
        <Route path="/health" element={isStaff ? <Navigate to="/staff" replace /> : <HealthMonitorPage />} />
        <Route path="/education" element={isStaff ? <Navigate to="/staff" replace /> : <EducationPage />} />
        <Route path="/chat" element={isStaff ? <Navigate to="/staff" replace /> : <ChatPage />} />
        <Route path="/profile" element={isStaff ? <Navigate to="/staff" replace /> : <ProfilePage />} />
        <Route path="/staff" element={isStaff ? <StaffDashboardPage /> : <Navigate to="/" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
