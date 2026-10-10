/**
 * Routes (SPEC 4). Owner: WP-08. Served under `/app/`.
 *
 * M-0: `/app/home/:id` (sample GH1). `/app/` sends people to their last home; with no home and no
 * onboarding yet (M-A), it opens the sample. Other SPEC 4 routes arrive with their milestones.
 */
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { HomePage } from './home/HomePage.tsx';
import { Shell } from './shell/Shell.tsx';

export const SAMPLE_HOME_PATH = '/home/gh1';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <Navigate to={SAMPLE_HOME_PATH} replace /> },
      { path: 'home/:id', element: <HomePage /> },
      { path: '*', element: <Navigate to={SAMPLE_HOME_PATH} replace /> },
    ],
  },
];

export function createRouter() {
  return createBrowserRouter(routes, { basename: '/app' });
}
