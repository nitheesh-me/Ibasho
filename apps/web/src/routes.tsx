/**
 * Routes (SPEC 4). Owner: WP-08. Served under `/app/`.
 *
 * M-A: `/app/` sends people to their last home, or to onboarding when they have none yet.
 * `/app/start` is onboarding (five steps, ending in the Reveal), `/app/home/:id` the home stage
 * (a sample or a person's own). Other SPEC 4 routes arrive with their milestones.
 */
import { useEffect, useState } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { HomePage } from './home/HomePage.tsx';
import { landingPath } from './home/homes.ts';
import { Shell } from './shell/Shell.tsx';
import { useServices } from './shell/services.ts';
import { StartPage } from './start/StartPage.tsx';

export const SAMPLE_HOME_PATH = '/home/gh1';
export const START_PATH = '/start';

/** `/app/`: the last own home, else onboarding (SPEC 4). */
function Landing() {
  const services = useServices();
  const [to, setTo] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    landingPath(services.store()).then(
      (p) => live && setTo(p),
      () => live && setTo(START_PATH),
    );
    return () => {
      live = false;
    };
  }, [services]);
  return to ? <Navigate to={to} replace /> : null;
}

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <Landing /> },
      { path: 'start', element: <StartPage /> },
      { path: 'home/:id', element: <HomePage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];

export function createRouter() {
  return createBrowserRouter(routes, { basename: '/app' });
}
