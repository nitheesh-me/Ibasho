/**
 * Accreditations and schemes named in next steps (SPEC 5.9). Owner: WP-09.
 * England and Wales first (T1). Each says what it means for the owner, not what it is for the trade.
 */
import type { SourceRef } from '@ibasho/core';
import type { Accreditation, AccreditationId } from '../types.ts';

export const ACCREDITATIONS: Readonly<Record<AccreditationId, Accreditation>> = {
  trustmark: {
    id: 'trustmark',
    name: 'TrustMark',
    plain:
      'The government-endorsed quality scheme for work in and around your home. Most grants pay only for TrustMark work, and it gives you a route to complain.',
    checkUrl: 'https://www.trustmark.org.uk/find-a-tradesperson',
  },
  'pas-2035': {
    id: 'pas-2035',
    name: 'PAS 2035 retrofit coordinator',
    plain:
      'The standard for planning insulation and heating as one job. A [[g:retrofit-coordinator]] checks the risks first, and funded schemes require it.',
    checkUrl: 'https://www.trustmark.org.uk/ourservices/pas-2035',
  },
  mcs: {
    id: 'mcs',
    name: 'MCS',
    plain:
      'The certification for heat pumps, solar panels and batteries. You need an MCS installer for the Boiler Upgrade Scheme grant and to be paid for solar [[g:export]].',
    checkUrl: 'https://mcscertified.com/find-an-installer/',
  },
  recc: {
    id: 'recc',
    name: 'RECC or HIES consumer code',
    plain:
      'A consumer code that protects your deposit and sets fair contract terms. MCS installers must belong to one.',
    checkUrl: 'https://www.recc.org.uk/',
  },
  'gas-safe': {
    id: 'gas-safe',
    name: 'Gas Safe Register',
    plain:
      'The law says only a Gas Safe engineer may work on gas pipes or appliances. Ask to see their card.',
    checkUrl: 'https://www.gassaferegister.co.uk/',
  },
  'competent-person': {
    id: 'competent-person',
    name: 'Competent person scheme',
    plain:
      'Lets an electrician or installer sign off their own work under building regulations, so you do not need a separate inspection. NICEIC and NAPIT are the best known.',
    checkUrl: 'https://www.competentperson.co.uk/',
  },
  fensa: {
    id: 'fensa',
    name: 'FENSA or CERTASS',
    plain:
      'Competent person schemes for replacement windows and doors. You get a certificate that the work meets building regulations, which you will need when you sell.',
    checkUrl: 'https://www.fensa.org.uk/',
  },
  nia: {
    id: 'nia',
    name: 'National Insulation Association',
    plain: 'The trade body for insulation installers. Members follow a code of practice.',
    checkUrl: 'https://www.nationalinsulationassociation.org.uk/',
  },
};

export const ACCREDITATION_SOURCES: readonly SourceRef[] = [
  {
    id: 'trustmark',
    title: 'TrustMark, find a tradesperson',
    url: 'https://www.trustmark.org.uk/',
    retrieved: '2026-10-11',
  },
  {
    id: 'trustmark-pas-2035',
    title: 'TrustMark, PAS 2035 and the retrofit coordinator role',
    url: 'https://www.trustmark.org.uk/ourservices/pas-2035',
    retrieved: '2026-10-11',
  },
  { id: 'mcs', title: 'MCS, find an installer', url: 'https://mcscertified.com/', retrieved: '2026-10-11' },
  {
    id: 'gas-safe',
    title: 'Gas Safe Register',
    url: 'https://www.gassaferegister.co.uk/',
    retrieved: '2026-10-11',
  },
  {
    id: 'competent-person',
    title: 'Competent Person Register',
    url: 'https://www.competentperson.co.uk/',
    retrieved: '2026-10-11',
  },
];
