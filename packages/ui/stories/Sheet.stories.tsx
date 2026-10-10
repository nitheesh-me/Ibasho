import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Num } from '../src/num/Num.tsx';
import { Sheet, type SheetSnap } from '../src/sheet/Sheet.tsx';
import { withKitEvidence } from './kit-decorator.tsx';

const meta: Meta<typeof Sheet> = { title: 'Kit/Sheet', component: Sheet, decorators: [withKitEvidence] };
export default meta;
type S = StoryObj<typeof Sheet>;

/** A stage that contains the fixed sheet (a transform makes it the containing block). */
const stage = {
  position: 'relative',
  transform: 'translateZ(0)',
  height: 520,
  overflow: 'hidden',
  border: '1px solid var(--line)',
  background: 'var(--surface-sunk)',
} as const;

function Demo({ placement }: { placement: 'side' | 'bottom' }) {
  const [open, setOpen] = useState(true);
  const [snap, setSnap] = useState<SheetSnap>('half');
  return (
    <div style={stage}>
      <button type="button" className="ib-button" style={{ margin: 16 }} onClick={() => setOpen(true)}>
        Open the loft
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        kicker="Roof"
        title="Loft"
        placement={placement}
        snap={snap}
        onSnapChange={setSnap}
        actions={
          <button type="button" className="ib-button">
            What if I insulate this?
          </button>
        }
      >
        <p style={{ marginTop: 0 }}>
          The loft has thin insulation. On a typical January night (<Num ev="ev_climate.jan_night" /> outside)
          the home loses about <Num ev="ev_fabric.loss_now" /> through its walls, roof and gaps.
        </p>
        <p>The house beside the sheet stays usable: the sheet is not modal.</p>
      </Sheet>
    </div>
  );
}

/** Wide screens: a side sheet on its rail. */
export const Side: S = { render: () => <Demo placement="side" /> };
/** Narrow screens: a bottom sheet with peek, half and full, each with a button. */
export const Bottom: S = { render: () => <Demo placement="bottom" /> };
