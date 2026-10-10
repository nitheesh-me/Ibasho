// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ClaimSeal } from '../src/seal/ClaimSeal.tsx';
import { NOT_PROVED } from '../src/seal/copy.ts';
import { Seal, sealTilt } from '../src/seal/Seal.tsx';

afterEach(cleanup);

const claim = {
  id: 'rejected-never-returned',
  sentence: 'What you ruled out never came back',
  theorems: ['rejected_never_offered', 'rejection_antitone', 'restore_monotone'],
  notProved: 'Whether a ruled out measure would have suited you.',
};

describe('Seal', () => {
  it('names a Checked seal with its rung and coverage and describes what is not proved', () => {
    render(<Seal level="checked" check={{ rung: 'lean-native', coverage: 'all' }} />);
    const seal = screen.getByRole('img', { name: 'Checked by Lean, every row' });
    const note = document.getElementById(seal.getAttribute('aria-describedby')!)!;
    expect(note.textContent).toBe(`Not proved: ${NOT_PROVED.checked}`);
    expect(seal.tabIndex).toBe(0);
  });

  it('draws each level with its own shape', () => {
    const { container } = render(
      <>
        <Seal level="checked" size="md" />
        <Seal level="modelled" size="md" />
        <Seal level="cracked" size="md" />
        <Seal level="unverified" size="md" />
      </>,
    );
    const [checked, modelled, cracked, unverified] = [...container.querySelectorAll('.ib-seal')];
    expect(checked!.querySelector('rect[stroke="var(--seal)"]')).not.toBeNull();
    expect(checked!.querySelector('[data-glyph="検"]')).not.toBeNull();
    expect(modelled!.querySelectorAll('circle').length).toBeGreaterThanOrEqual(2);
    expect(modelled!.querySelector('[data-glyph="模"]')).not.toBeNull();
    expect(modelled!.innerHTML).not.toContain('var(--seal)');
    expect(cracked!.querySelectorAll('clipPath')).toHaveLength(2);
    expect(unverified!.querySelector('rect[stroke-dasharray]')).not.toBeNull();
  });

  it('uses a geometric mark below md so the kanji never blurs into a blot', () => {
    const { container } = render(<Seal level="checked" size="sm" />);
    expect(container.querySelector('[data-glyph]')).toBeNull();
    expect(container.querySelector('filter')).toBeNull();
  });

  it('prints with a seeded tilt; ink outlines stay square', () => {
    expect(sealTilt('proved', 'a')).toBe(sealTilt('proved', 'a'));
    expect(Math.abs(sealTilt('checked', 'x'))).toBeLessThanOrEqual(4.4);
    expect(sealTilt('modelled', 'x')).toBe(0);
  });
});

describe('ClaimSeal', () => {
  it('shows the claim, a Proved seal, the not-proved line, theorems and links', () => {
    render(
      <ClaimSeal claim={claim} proofHref="/app/proofs#rejected-never-returned" certificateHref="/app/cert" />,
    );
    const region = screen.getByRole('region', { name: claim.sentence });
    expect(region.dataset.claim).toBe(claim.id);
    const seal = screen.getByRole('img', { name: `Proved: ${claim.sentence}` });
    expect(seal.dataset.seal).toBe('proved');
    expect(seal.querySelector('[data-glyph="証"]')).not.toBeNull();
    expect(document.getElementById(region.getAttribute('aria-describedby')!)!.textContent).toBe(
      `Not proved: ${claim.notProved}`,
    );
    for (const t of claim.theorems) expect(screen.getByText(t).tagName).toBe('CODE');
    expect(screen.getByRole('link', { name: 'See the proof' }).getAttribute('href')).toBe(
      '/app/proofs#rejected-never-returned',
    );
    expect(screen.getByRole('link', { name: 'See the certificate' })).toBeTruthy();
  });

  it('presses the seal on mount when asked', () => {
    render(<ClaimSeal claim={claim} press />);
    expect(screen.getByRole('img', { name: /^Proved/ }).hasAttribute('data-press')).toBe(true);
  });

  it('never uses forbidden seal words', () => {
    const { container } = render(<ClaimSeal claim={claim} />);
    expect(container.textContent).not.toMatch(/guarantee|verified savings|AI-verified|save up to/i);
  });
});
