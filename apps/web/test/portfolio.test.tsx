// @vitest-environment happy-dom
/**
 * Homes (Lloyds brief): the score is a weighted sum with the brief's weights, P10001 reads about
 * 38 and Poor, sub-scores are monotone, improvement potential is unavailable without readings,
 * package savings equal the listed savings (interactions), a heat pump shows electricity as a
 * negative saving, carbon follows the per-fuel factors, and the what-if reruns the numbers.
 */
import { describe, expect, it } from 'vitest';
import { analyseHome, FACTORS, portfolio, scoreHome, WEIGHTS } from '../src/portfolio/model.ts';

const p1 = () => portfolio().find((h) => h.id === 'P10001')!;

describe('Green Home Score', () => {
  it('uses the seven brief weights and classifies P10001 as Poor', () => {
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    const s = scoreHome(p1());
    expect(s.components.map((c) => c.weight)).toEqual([0.25, 0.2, 0.15, 0.15, 0.1, 0.1, 0.05]);
    expect(s.score).toBe(Math.round(s.components.reduce((a, c) => a + c.contribution, 0)));
    expect(s.score).toBeGreaterThanOrEqual(35);
    expect(s.score).toBeLessThanOrEqual(41);
    expect(s.band).toBe('Poor');
  });
  it('never scores a better state lower', () => {
    const h = p1();
    const a = scoreHome(h).score;
    expect(scoreHome({ ...h, glazing: 'double' }).score).toBeGreaterThanOrEqual(a);
    expect(scoreHome({ ...h, loftMm: 270 }).score).toBeGreaterThanOrEqual(a);
    expect(scoreHome({ ...h, rating: 'C' }).score).toBeGreaterThanOrEqual(a);
    expect(scoreHome({ ...h, gasKwh: 8_000 }).score).toBeGreaterThanOrEqual(a);
  });
});

describe('retrofits, savings, carbon, value', () => {
  it('package equals the listed savings and the heat pump raises electricity', () => {
    const a = analyseHome(p1());
    const ids = a.chosen.map((r) => r.id);
    expect(ids.indexOf('loft')).toBeLessThan(ids.indexOf('heat-pump'));
    expect(a.package?.elecSaving).toBe(a.chosen.reduce((s, r) => s + r.elecSaving, 0));
    expect(a.package?.gasSaving).toBe(a.chosen.reduce((s, r) => s + r.gasSaving, 0));
    expect(a.chosen.find((r) => r.id === 'heat-pump')?.elecSaving).toBeLessThan(0);
    const pk = a.package!;
    expect(a.carbonKg).toBeCloseTo(pk.elecSaving * FACTORS.elec + pk.gasSaving * FACTORS.gas, 6);
    expect(a.value!.lo).toBeLessThanOrEqual(a.value!.hi);
    expect(a.value!.lo).toBeGreaterThanOrEqual(p1().valueGbp);
  });
  it('the what-if reruns with only the chosen retrofits', () => {
    const all = analyseHome(p1());
    const two = analyseHome(p1(), ['loft', 'smart']);
    expect(two.chosen.map((r) => r.id)).toEqual(['loft', 'smart']);
    expect(two.package!.total).toBeLessThan(all.package!.total);
    expect(analyseHome(p1(), []).package!.total).toBe(0);
  });
  it('improvement potential is unavailable without readings', () => {
    const h = portfolio().find((x) => x.elecKwh === null)!;
    expect(analyseHome(h).package).toBeNull();
  });
});

describe('Homes screens', () => {
  it('ranks by potential, flags poor homes and reruns the what-if on the home page', async () => {
    const { render, screen, fireEvent, cleanup } = await import('@testing-library/react');
    const { createMemoryRouter, RouterProvider } = await import('react-router');
    const { HomeScorePage, PortfolioPage } = await import('../src/portfolio/PortfolioPages.tsx');
    const router = createMemoryRouter(
      [
        { path: '/portfolio', element: <PortfolioPage /> },
        { path: '/portfolio/:id', element: <HomeScorePage /> },
      ],
      { initialEntries: ['/portfolio'] },
    );
    const { container, unmount } = render(<RouterProvider router={router} />);
    const ids = [...container.querySelectorAll('.pf-row__id')].map((a) => a.textContent);
    expect(ids.length).toBe(40);
    expect(container.querySelectorAll('.pf-row[data-poor] .pf-issues').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Unavailable: no meter readings/).length).toBeGreaterThan(0);
    unmount();
    const r2 = createMemoryRouter([{ path: '/portfolio/:id', element: <HomeScorePage /> }], {
      initialEntries: ['/portfolio/P10001'],
    });
    const page = render(<RouterProvider router={r2} />);
    expect(screen.getByText('Why this score')).toBeTruthy();
    expect(page.container.querySelectorAll('.pf-why__table tbody tr').length).toBe(7);
    const total = () =>
      page.container.querySelector('[data-ev="ev_home.P10001.saving.total.package"]')?.textContent;
    const before = total();
    fireEvent.click(screen.getByRole('button', { name: /Air source heat pump/ }));
    expect(total()).not.toBe(before);
    expect(page.container.textContent).not.toMatch(/certified|compliant/i);
    cleanup();
  });
});
