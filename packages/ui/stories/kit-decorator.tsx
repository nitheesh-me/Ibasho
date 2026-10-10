/** Story decorator: the kit evidence source around every kit story. */
import type { Decorator } from '@storybook/react-vite';
import { EvidenceProvider } from '../src/evidence/context.tsx';
import { kitSource } from './kit-evidence.ts';

export const withKitEvidence: Decorator = (Story) => (
  <EvidenceProvider source={kitSource}>{Story()}</EvidenceProvider>
);
