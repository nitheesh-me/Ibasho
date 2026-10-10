import type { Decorator, Preview } from '@storybook/react-vite';
import '../src/styles/andon.css';
import './preview.css';

type Theme = 'hiru' | 'yoru' | 'both';

/** Every story renders in Hiru and Yoru side by side by default (DESIGN_SYSTEM 8). */
const withAndon: Decorator = (Story, ctx) => {
  const theme = (ctx.globals.theme ?? 'both') as Theme;
  const motion = ctx.globals.motion === 'reduced' ? 'reduced' : 'full';
  document.documentElement.dataset.motion = motion;
  const themes: Exclude<Theme, 'both'>[] = theme === 'both' ? ['hiru', 'yoru'] : [theme];
  return (
    <div className="sb-andon" data-count={themes.length}>
      {themes.map((t) => (
        <section
          key={t}
          className="sb-andon__pane ib-washi"
          data-theme={t}
          aria-label={t === 'hiru' ? 'Day' : 'Night'}
        >
          <Story />
        </section>
      ))}
    </div>
  );
};

const preview: Preview = {
  decorators: [withAndon],
  parameters: { layout: 'fullscreen', controls: { expanded: true } },
  globalTypes: {
    theme: {
      description: 'Andon theme',
      toolbar: {
        title: 'Theme',
        items: [
          { value: 'both', title: 'Day and night' },
          { value: 'hiru', title: 'Day (Hiru)' },
          { value: 'yoru', title: 'Night (Yoru)' },
        ],
      },
    },
    motion: {
      description: 'Motion',
      toolbar: {
        title: 'Motion',
        items: [
          { value: 'full', title: 'Full motion' },
          { value: 'reduced', title: 'Reduced motion' },
        ],
      },
    },
  },
  initialGlobals: { theme: 'both', motion: 'full' },
};

export default preview;
