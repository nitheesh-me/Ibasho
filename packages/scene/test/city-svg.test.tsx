/** The flat city drawing follows the night theme (studio round 6, agent B). */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CitySvg } from '../src/city/CitySvg.tsx';
import { cityModel } from '../src/city/model.ts';
import { sunOf } from '../src/city/sun.ts';
import { levelView } from '../src/city/view.ts';

describe('CitySvg themes', () => {
  const model = cityModel({});
  const view = levelView({ level: 'city', hero: model.hero, cityBox: model.cityBox, azimuthDeg: 135, aspect: 1.6 });
  const draw = (theme: 'hiru' | 'yoru', minutes: number): string =>
    renderToStaticMarkup(
      createElement(CitySvg, {
        model,
        theme,
        lens: 'none',
        level: 'city',
        view,
        sun: sunOf({ date: '2026-03-21', minutes }, model.place.lat, model.place.lon),
        site: null,
        daylight: null,
        penumbra: true,
        width: 1280,
        height: 800,
      }),
    );
  it('draws dark card and a lamplit hero at night, paper by day', () => {
    const night = draw('yoru', 1230);
    expect(night).toContain('#1d1915');
    expect(night).toContain('#f2c27a');
    const day = draw('hiru', 630);
    expect(day).not.toContain('#1d1915');
    expect(day).not.toContain('#f2c27a');
  });
});
