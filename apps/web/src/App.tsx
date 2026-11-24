import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Intro from './pages/Intro';
import Overview from './pages/Overview';
import Analysis from './pages/Analysis';
import Simulation from './pages/Simulation';
import Onboarding from './pages/Onboarding';
import Outcomes from './pages/Outcomes';
const Chapel = lazy(() => import('./pages/Chapel'));
const previousRoutes = {
  '/face': '/you/profile',
  '/voice': '/you',
  '/result': '/lives',
  '/connect': '/you',
};
function Editor() {
  const { pathname } = useLocation();
  return <Onboarding key={pathname} />;
}
export default function App() {
  const { search, hash } = useLocation();
  return (
    <Routes>
      <Route path="/" element={<Intro />} />
      <Route path="/you" element={<Overview />} />
      <Route path="/you/profile" element={<Editor />} />
      <Route path="/you/person/:id" element={<Editor />} />
      <Route path="/analysis" element={<Analysis />} />
      <Route path="/simulate" element={<Simulation />} />
      <Route path="/lives" element={<Outcomes />} />
      <Route
        path="/chapel"
        element={
          <Suspense
            fallback={
              <main className="page" role="status">
                Opening the chapel…
              </main>
            }
          >
            <Chapel />
          </Suspense>
        }
      />
      {Object.entries(previousRoutes).map(([path, pathname]) => (
        <Route
          key={path}
          path={path}
          element={<Navigate replace to={{ pathname, search, hash }} />}
        />
      ))}
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  );
}
