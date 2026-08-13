import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { useAuth } from './context/AuthContext.jsx';
import { AppLayout } from './components/AppLayout.jsx';
import { Loading } from './components/ui/Feedback.jsx';

import Landing from './pages/Landing.jsx';
import SignIn from './pages/SignIn.jsx';
import SignUp from './pages/SignUp.jsx';
import Dashboard from './pages/Dashboard.jsx';
import NewGoal from './pages/NewGoal.jsx';
import GoalSetup from './pages/GoalSetup.jsx';
import Quiz from './pages/Quiz.jsx';
import StudyPlan from './pages/StudyPlan.jsx';
import TopicExplorer from './pages/TopicExplorer.jsx';
import Tutor from './pages/Tutor.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
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
