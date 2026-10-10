// @vitest-environment happy-dom
/**
 * The `/app/home/gh1` page rendered with the real engine worker body on a MessageChannel
 * (M0-5 in a DOM; WP-10 runs the same assertions in Chromium).
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type * as Comlink from 'comlink';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterAll, describe, expect, it } from 'vitest';
import { connectEngine } from '../src/engine/client.ts';
import { manifest } from '../src/manifest.ts';
import { routes } from '../src/routes.tsx';
import { type Services, ServicesContext } from '../src/shell/services.ts';
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

describe('/app/home/gh1', () => {
  it('shows the house, at least three Num chips, one Checked seal and the claim', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/'] });
    const { container } = render(
      <ServicesContext.Provider value={services}>
        <RouterProvider router={router} />
      </ServicesContext.Provider>,
    );
    expect(router.state.location.pathname).toBe('/home/gh1');
    // The pencil underdrawing shows while the worker computes.
    expect(container.querySelector('svg.ib-svg-house')).not.toBeNull();

    await waitFor(() => expect(container.querySelector('.ib-seal[data-seal="checked"]')).not.toBeNull(), {
      timeout: 15_000,
    });
    expect(container.querySelector('svg.ib-svg-house')?.getAttribute('data-variant')).toBe('ink');
    expect(container.querySelectorAll('.ib-seal[data-seal="checked"]').length).toBeGreaterThanOrEqual(1);
    const label = container.querySelector('.ib-checked .ib-seal')?.getAttribute('aria-label') ?? '';
    expect(label).toMatch(/Checked/);

    const chips = container.querySelectorAll('button.ib-num[data-num][data-ev]');
    expect(chips.length).toBeGreaterThanOrEqual(3);
    expect(container.querySelectorAll('[data-num][data-missing]')).toHaveLength(0);

    const claim = container.querySelector('section.ib-claim[data-claim] h3');
    expect(claim?.textContent).toBe('What you ruled out never came back');
    expect(screen.getByRole('heading', { name: 'Three futures' })).toBeTruthy();

    // Digits live only inside Num chips (and the theorem and formula code names).
    const text = [...container.querySelectorAll('.ib-zashiki, .ib-engawa, .ib-niwa__caption')]
      .map((el) => {
        const copy = el.cloneNode(true) as HTMLElement;
        for (const n of copy.querySelectorAll('[data-num], code')) n.remove();
        return copy.textContent ?? '';
      })
      .join(' ');
    expect(text).not.toMatch(/\d/);
  }, 20_000);
});
