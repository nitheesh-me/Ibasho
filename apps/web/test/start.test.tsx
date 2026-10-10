// @vitest-environment happy-dom
/**
 * M-A onboarding (SPEC 5.2): five typed steps inside the two minute budget, no budget question
 * (R24, H5), every default marked as an estimate (AC-G2), and the Reveal on the home stage with
 * the real engine worker body on a MessageChannel.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type * as Comlink from 'comlink';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterAll, describe, expect, it } from 'vitest';
import { connectEngine } from '../src/engine/client.ts';
import { manifest } from '../src/manifest.ts';
import { routes } from '../src/routes.tsx';
import { type Services, ServicesContext } from '../src/shell/services.ts';
import { readPostcode } from '../src/start/places.ts';
import { EMPTY_ANSWERS, SeedError, seedTwin } from '../src/start/seed.ts';
import { checkBudget, ONBOARDING_BUDGET_S, STEPS, totalTimeCostS } from '../src/start/steps.ts';
import { serveEngine } from '../src/worker/serve.ts';

const channel = new MessageChannel();
serveEngine(channel.port1 as unknown as Comlink.Endpoint, manifest.engine);
const ready = connectEngine(channel.port2 as unknown as Comlink.Endpoint, manifest);
const services: Services = { engine: () => ready, store: () => null };
afterAll(() => {
  cleanup();
  channel.port1.close();
  channel.port2.close();
});

describe('onboarding steps', () => {
  it('has five steps ending in Reveal, inside the two minute budget', () => {
    expect(STEPS.map((s) => s.id)).toEqual(['where', 'shape', 'tune', 'people', 'reveal']);
    expect(totalTimeCostS(STEPS)).toBeLessThanOrEqual(ONBOARDING_BUDGET_S);
    expect(() => checkBudget(STEPS)).not.toThrow();
  });

  it('refuses a step that asks about money (R24)', () => {
    const bad = STEPS.map((s) => (s.id === 'people' ? { ...s, prompt: 'What is your budget?' } : s));
    expect(() => checkBudget(bad)).toThrow(/money/);
  });

  it('reads a postcode area locally', () => {
    expect(readPostcode('not a postcode').kind).toBe('invalid');
    expect(readPostcode('SW1A 1AA').kind).toBe('place');
  });
});

describe('seeding a home from the answers', () => {
  it('needs a place and a seedable tile', () => {
    expect(() => seedTwin(EMPTY_ANSWERS, 'home-x')).toThrow(SeedError);
  });

  it('keeps nothing from the sample survey as known: unanswered values are estimates', () => {
    const t = seedTwin({ ...EMPTY_ANSWERS, placeId: 'london', tileId: 'terrace-solid' }, 'home-x');
    expect(t.id).toBe('home-x');
    expect(t.legal.designations.conservationArea).toBe('unknown');
    const sources = JSON.stringify(t);
    expect(sources).not.toMatch(/"kind":"(document|measured)"/);
  });

  it('marks what the person told us as stated', () => {
    const t = seedTwin(
      { ...EMPTY_ANSWERS, placeId: 'london', tileId: 'terrace-solid', tenure: 'tenant', people: 3 },
      'home-y',
    );
    expect(t.legal.tenure).toMatchObject({ state: 'known', value: 'tenant', source: { kind: 'stated' } });
    expect(t.occupancy.people).toMatchObject({ state: 'known', value: 3 });
  });
});

describe('/app/start to the Reveal', () => {
  it('sends a first visit to onboarding', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/'] });
    render(
      <ServicesContext.Provider value={services}>
        <RouterProvider router={router} />
      </ServicesContext.Provider>,
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/start'));
    cleanup();
  });

  it('walks Where and Shape, skips to the Reveal and draws the home', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/start'] });
    const { container } = render(
      <ServicesContext.Provider value={services}>
        <RouterProvider router={router} />
      </ServicesContext.Provider>,
    );
    expect(container.textContent).not.toMatch(/budget|afford/i);
    fireEvent.click(screen.getByLabelText('London'));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByLabelText(/Victorian or Edwardian terrace/));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    // Tune: nothing answered, so every group says it is an estimate (AC-G2).
    expect(container.querySelectorAll('.ib-choices[data-estimated]').length).toBeGreaterThan(0);
    expect(container.textContent).not.toMatch(/budget|afford/i);
    fireEvent.click(screen.getByRole('button', { name: 'Skip to my home' }));

    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/home\/home-/));
    expect(router.state.location.state).toEqual({ reveal: true });
    // No WebGL in this DOM: the SVG house, in pencil while the engine computes.
    expect(container.querySelector('.ib-house[data-renderer="svg"] svg.ib-svg-house')).not.toBeNull();
    await waitFor(
      () => expect(container.querySelector('.ib-home')?.getAttribute('data-state')).not.toBe('computing'),
      { timeout: 15_000 },
    );
    expect(container.querySelector('.ib-home')?.getAttribute('data-state')).toBe('ready');
    expect(container.querySelector('svg.ib-svg-house')?.getAttribute('data-variant')).toBe('ink');
    expect(container.querySelector('.ib-niwa__caption')?.textContent).toMatch(/Your home in London/);
  }, 20_000);
});
