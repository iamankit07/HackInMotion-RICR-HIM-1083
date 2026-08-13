import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { useAuth } from './context/AuthContext.jsx';
import { AppLayout } from './components/AppLayout.jsx';
import { Loading } from './components/ui/Feedback.jsx';

/*
  One chunk per screen. Loading every page up front meant a student opening the
  sign-in form also downloaded the quiz, the planner and the tutor, which is the
  slowest thing to do on a phone on exam-hall wifi. Each screen is now fetched
  the first time it is opened and cached after that.

  Landing and the two auth screens are the exception: they are the first thing
  anyone sees, and splitting them would add a second round trip before the page
  can paint at all.
*/
import Landing from './pages/Landing.jsx';
import SignIn from './pages/SignIn.jsx';
import SignUp from './pages/SignUp.jsx';

const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const NewGoal = lazy(() => import('./pages/NewGoal.jsx'));
const GoalSetup = lazy(() => import('./pages/GoalSetup.jsx'));
const Quiz = lazy(() => import('./pages/Quiz.jsx'));
const StudyPlan = lazy(() => import('./pages/StudyPlan.jsx'));
const TopicExplorer = lazy(() => import('./pages/TopicExplorer.jsx'));
const Tutor = lazy(() => import('./pages/Tutor.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));

export default function App() {
  return (
    <Suspense fallback={<Loading label="Loading" />}>
      <AppRoutes />
    </Suspense>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PublicOnly><Landing /></PublicOnly>} />
      <Route path="/sign-in" element={<PublicOnly><SignIn /></PublicOnly>} />
      <Route path="/sign-up" element={<PublicOnly><SignUp /></PublicOnly>} />

      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route path="/goals" element={<Dashboard />} />
        <Route path="/goals/new" element={<NewGoal />} />
        <Route path="/goals/:goalId/setup" element={<GoalSetup />} />
        <Route path="/goals/:goalId/quiz/:assessmentId" element={<Quiz />} />
        <Route path="/goals/:goalId/plan" element={<StudyPlan />} />
        <Route path="/goals/:goalId/explore/:topicKey" element={<TopicExplorer />} />
        <Route path="/goals/:goalId/tutor" element={<Tutor />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function RequireAuth({ children }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'checking') {
    return <Loading label="Signing you in" />;
  }

  if (status !== 'signed-in') {
    // Remember where they were headed so the sign-in screen can send them back.
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  }

  return children;
}

function PublicOnly({ children }) {
  const { status } = useAuth();

  if (status === 'checking') {
    return <Loading label="Checking your session" />;
  }

  return status === 'signed-in' ? <Navigate to="/goals" replace /> : children;
}
