/**
 * Routes (SPEC 4). Owner: WP-08. Served under `/app/`.
 *
 * M-A: `/app/` sends people to their last home, or to onboarding when they have none yet.
 * `/app/start` is onboarding (five steps, ending in the Reveal), `/app/home/:id` the home stage
 * (a sample or a person's own). Other SPEC 4 routes arrive with their milestones.
 */
import type React from 'react';
import { useEffect, useState } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { HomePage } from './home/HomePage.tsx';
import { landingPath } from './home/homes.ts';
import { HomeScorePage, PortfolioPage } from './portfolio/PortfolioPages.tsx';
import { Shell } from './shell/Shell.tsx';
import { useServices } from './shell/services.ts';
import { StartPage } from './start/StartPage.tsx';
import { DesignFlow } from './studio/pages/DesignFlow.tsx';
import { NewFlow } from './studio/pages/NewFlow.tsx';
import { SettingsPage } from './studio/pages/SettingsPage.tsx';
import { StudioHome } from './studio/pages/StudioHome.tsx';
import { StudioPage } from './studio/pages/StudioPage.tsx';
import { bootStudio } from './studio/state/persist.ts';

export const SAMPLE_HOME_PATH = '/home/gh1';
export const START_PATH = '/start';

/** Boots the studio session once (IndexedDB read, then the sample if empty). */
function Studio({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void bootStudio();
  }, []);
  return <>{children}</>;
}

/** v2 landing: the last own home, else onboarding (SPEC 4). Kept for `/app/homes`. */
export function Landing() {
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

/** Unknown addresses (review m2). */
function NotFound() {
  return (
    <div className="st-notfound">
      <h1>Nothing here</h1>
      <p>There is nothing at this address.</p>
      <a className="ib-btn" href="/app/">
        Back to your places
      </a>
    </div>
  );
}

/** A route that throws still lands on Andon paper, with one next step (never a stack trace). */
function RouteError() {
  return (
    <Shell>
      <div className="st-empty" role="alert">
        <p>Something on this page stopped working. Your places and drawings are safe on this device.</p>
        <a className="ib-btn" href="/app/">
          Back to your places
        </a>
      </div>
    </Shell>
  );
}

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Shell />,
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        element: (
          <Studio>
            <StudioHome />
          </Studio>
        ),
      },
      {
        path: 'design',
        element: (
          <Studio>
            <DesignFlow />
          </Studio>
        ),
      },
      {
        path: 'new',
        element: (
          <Studio>
            <NewFlow />
          </Studio>
        ),
      },
      {
        path: 'p/:placeId',
        element: (
          <Studio>
            <StudioPage />
          </Studio>
        ),
      },
      {
        path: 'p/:placeId/b/:buildingId',
        element: (
          <Studio>
            <StudioPage />
          </Studio>
        ),
      },
      {
        path: 'settings',
        element: (
          <Studio>
            <SettingsPage />
          </Studio>
        ),
      },
      { path: 'portfolio', element: <PortfolioPage /> },
      { path: 'portfolio/:id', element: <HomeScorePage /> },
      { path: 'homes', element: <Landing /> },
      { path: 'start', element: <StartPage /> },
      { path: 'home/:id', element: <HomePage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
];

export function createRouter() {
  return createBrowserRouter(routes, { basename: '/app' });
}
