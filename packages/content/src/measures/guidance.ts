/**
 * Disruption and next step for every T1 measure (SPEC 5.9, AC-P2). Owner: WP-09.
 *
 * Keyed by the measure ids in `packs/home-uk/src/ids.ts` (BUILD_PLAN 2, "one measure, five
 * owners, one id"). `test/measures.test.ts` fails if an id is missing or extra.
 *
 * Days and rooms are typical for a two or three bedroom UK home, from published consumer guidance.
 * They are not quotes and carry grade `estimate`; the Plan screen shows them as typical.
 */
import type { Provenance, SourceRef } from '@ibasho/core';
import type { MeasureGuidance } from '../types.ts';

const CHECKED = '2026-10-11';

const src = (id: string, title: string, url: string): SourceRef => ({ id, title, url, retrieved: CHECKED });

const EST = {
  loft: src(
    'est-loft',
    'Energy Saving Trust, roof and loft insulation',
    'https://energysavingtrust.org.uk/advice/roof-and-loft-insulation/',
  ),
  wall: src(
    'est-solid-wall',
    'Energy Saving Trust, solid wall insulation',
    'https://energysavingtrust.org.uk/advice/solid-wall-insulation/',
  ),
  floor: src(
    'est-floor',
    'Energy Saving Trust, floor insulation',
    'https://energysavingtrust.org.uk/advice/floor-insulation/',
  ),
  draught: src(
    'est-draught',
    'Energy Saving Trust, draught-proofing',
    'https://energysavingtrust.org.uk/advice/draught-proofing/',
  ),
  windows: src(
    'est-windows',
    'Energy Saving Trust, energy efficient windows',
    'https://energysavingtrust.org.uk/advice/windows-and-doors/',
  ),
  controls: src(
    'est-controls',
    'Energy Saving Trust, thermostats and controls',
    'https://energysavingtrust.org.uk/advice/thermostats-and-controls/',
  ),
  ashp: src(
    'est-ashp',
    'Energy Saving Trust, air source heat pumps',
    'https://energysavingtrust.org.uk/advice/air-source-heat-pumps/',
  ),
  pv: src(
    'est-pv',
    'Energy Saving Trust, solar panels',
    'https://energysavingtrust.org.uk/advice/solar-panels/',
  ),
  solarThermal: src(
    'est-solar-thermal',
    'Energy Saving Trust, solar water heating',
    'https://energysavingtrust.org.uk/advice/solar-water-heating/',
  ),
  hotWater: src(
    'est-hot-water',
    'Energy Saving Trust, hot water cylinders and jackets',
    'https://energysavingtrust.org.uk/advice/hot-water/',
  ),
} as const;

const HISTORIC_ENGLAND = src(
  'he-retrofit',
  'Historic England, retrofit and energy efficiency in historic buildings',
  'https://historicengland.org.uk/advice/technical-advice/retrofit-and-energy-efficiency-in-historic-buildings/',
);
const MCS_020A = src(
  'mcs-020a',
  'MCS 020 a) Issue 1.1, heat pump sound assessment for permitted development',
  'https://mcscertified.com/wp-content/uploads/2025/04/MCS-020-a-Issue-1.1-Final.pdf',
);
const OFGEM_BUS = src(
  'ofgem-bus',
  'Ofgem, Boiler Upgrade Scheme',
  'https://www.ofgem.gov.uk/environmental-and-social-schemes/boiler-upgrade-scheme-bus',
);

const GAS_SAFE = src(
  'gas-safe',
  'Gas Safe Register, safety advice for gas work at home',
  'https://www.gassaferegister.co.uk/',
);

const typical = (...sources: SourceRef[]): Provenance => ({
  sources,
  lastChecked: CHECKED,
  grade: 'estimate',
});

const LIST = [
  {
    measureId: 'loft',
    name: 'Loft insulation top-up',
    what: 'Thick rolls of insulation laid between and over the joists of the loft floor, to 270 or 300 mm.',
    disruption: {
      days: { min: 1, max: 1 },
      rooms: ['The loft, cleared of stored things'],
      stayIn: 'yes',
      mess: 'low',
      note: 'Usually done in a morning. Expect a few footsteps overhead and some dust on the landing under the hatch.',
    },
    next: {
      installer: 'A loft insulation installer or a general builder.',
      accreditation: ['trustmark', 'nia'],
      why: 'TrustMark work qualifies for most grants. It is a simple job, so the main risk is poor detail at the edges.',
      questions: [
        'Will you keep the eaves clear, so the roof space still gets air and stays dry?',
        'Will you raise a boarded path, so I can still store things up there without squashing the insulation?',
        'Will you insulate and draught-strip the hatch, and keep cables on top of the insulation?',
      ],
    },
    provenance: typical(EST.loft),
  },
  {
    measureId: 'wall-ewi',
    name: 'External wall insulation',
    what: 'Insulation boards fixed to the outside of the walls, then finished with render or brick slips.',
    disruption: {
      days: { min: 10, max: 20 },
      rooms: ['The garden and paths near the walls, under scaffolding'],
      stayIn: 'yes',
      mess: 'medium',
      note: 'Nothing changes inside. The scaffold stays up for several weeks, and gutters, pipes and window sills are moved out.',
    },
    next: {
      installer: 'A specialist wall insulation installer, with a retrofit coordinator overseeing the job.',
      accreditation: ['trustmark', 'pas-2035'],
      why: 'Wall insulation is where most retrofit damp problems start. A coordinator checks the [[g:moisture-risk]] before anyone starts.',
      questions: [
        'How will you finish around the windows, the eaves and the base of the wall, so heat and rain cannot get round?',
        'Is the system [[g:vapour-open]] and suitable for my [[g:solid-wall|solid walls]]?',
        'Who applies for planning permission and building control, and is there an insurance-backed warranty?',
      ],
    },
    provenance: typical(EST.wall, HISTORIC_ENGLAND),
  },
  {
    measureId: 'wall-iwi',
    name: 'Internal wall insulation',
    what: 'Wood fibre boards fixed to the inside of the outer walls, then plastered. It keeps the outside of the house as it is.',
    disruption: {
      days: { min: 10, max: 20 },
      rooms: [
        'Each room with an outside wall, emptied in turn',
        'Skirtings, sockets and radiators come off those walls',
      ],
      stayIn: 'mostly',
      mess: 'high',
      note: 'Work goes room by room, two to four days each. Each room loses a few centimetres along its outside walls. Cornicing and other plasterwork need care.',
    },
    next: {
      installer:
        'A specialist internal insulation installer who knows older homes, with a retrofit coordinator.',
      accreditation: ['pas-2035', 'trustmark'],
      why: 'Inside insulation makes the old wall colder, which can trap water in it. It needs a moisture check first, and careful detail where floors meet the wall.',
      questions: [
        'Will you do a [[g:moisture-risk|moisture risk]] assessment for these walls, and show me the result?',
        'How will you treat the floor joist ends that sit in the outside wall?',
        'What happens to my skirtings, sockets, radiators and any cornicing, and who puts them back?',
      ],
    },
    provenance: typical(EST.wall, HISTORIC_ENGLAND),
  },
  {
    measureId: 'floor',
    name: 'Floor insulation',
    what: 'Insulation fitted between the joists of a [[g:suspended-floor]], from above or from the space underneath.',
    disruption: {
      days: { min: 2, max: 4 },
      rooms: ['Ground floor rooms, one or two at a time', 'Carpets and floorboards come up'],
      stayIn: 'mostly',
      mess: 'medium',
      note: 'Furniture moves out of each room while its boards are lifted. If there is a cellar or a deep void, it can be done from below with far less upheaval.',
    },
    next: {
      installer: 'A floor insulation installer, or a builder with experience of timber floors.',
      accreditation: ['trustmark'],
      why: 'TrustMark work qualifies for grants. The care is in keeping the space under the floor ventilated.',
      questions: [
        'Will you keep every air brick clear, so the space under the floor stays dry?',
        'How will you seal the gap where the floor meets the walls?',
        'Will you lift the boards or work from below, and who puts my carpets back?',
      ],
    },
    provenance: typical(EST.floor, HISTORIC_ENGLAND),
  },
  {
    measureId: 'draught',
    name: 'Draught-proofing',
    what: 'Seals for doors, sash windows and floorboard gaps, and a removable balloon for an unused chimney.',
    disruption: {
      days: { min: 1, max: 2 },
      rooms: [],
      stayIn: 'yes',
      mess: 'low',
      note: 'Quiet work, a room at a time. Sash windows come out of their frames for an hour or so each.',
    },
    next: {
      installer: 'A draught-proofing specialist, or a sash window specialist for old windows.',
      accreditation: ['trustmark'],
      why: 'The skill is in sealing the right gaps and leaving the [[g:ventilation]] your home needs.',
      questions: [
        'Which gaps will you seal, and which vents will you leave open on purpose?',
        'Do any of my gas appliances or flues need their air supply kept?',
        'Can the chimney balloon come out easily, and will you label the fireplace so nobody lights it?',
      ],
    },
    provenance: typical(EST.draught),
  },
  {
    measureId: 'glazing-secondary',
    name: 'Secondary glazing',
    what: 'A slim second window fitted just inside the existing one, with [[g:low-e]]. The original window stays.',
    disruption: {
      days: { min: 1, max: 2 },
      rooms: ['A few hours in each room with a window done'],
      stayIn: 'yes',
      mess: 'low',
      note: 'Little dust and no change outside, which suits a [[g:conservation-area]]. It also cuts street noise.',
    },
    next: {
      installer: 'A secondary glazing specialist.',
      accreditation: ['trustmark'],
      why: 'There is no building control step for secondary glazing, so a quality scheme is your main protection.',
      questions: [
        'Can the inner panes open or lift out, for cleaning and as a way out in a fire?',
        'Is the glass [[g:low-e]], and how will the frame sit so the original window still opens?',
        'How will you stop condensation forming between the two windows?',
      ],
    },
    provenance: typical(EST.windows, HISTORIC_ENGLAND),
  },
  {
    measureId: 'glazing-double',
    name: 'Double glazing',
    what: 'New double glazed windows in place of the old ones.',
    disruption: {
      days: { min: 1, max: 3 },
      rooms: ['Each room with a window replaced, for part of a day'],
      stayIn: 'yes',
      mess: 'medium',
      note: 'Each window is open to the air for an hour or two while it is swapped. Some plaster around the frames may need making good.',
    },
    next: {
      installer: 'A window installer registered with a competent person scheme.',
      accreditation: ['fensa', 'trustmark'],
      why: 'Replacement windows must meet building regulations. A FENSA or CERTASS certificate proves it when you sell.',
      questions: [
        'Is my home listed or in a [[g:conservation-area]], and do I need permission for new windows?',
        'Will the new windows have trickle vents, so the rooms still get fresh air?',
        'Will you register the work and send me the certificate?',
      ],
    },
    provenance: typical(EST.windows, HISTORIC_ENGLAND),
  },
  {
    measureId: 'controls',
    name: 'Smarter heating controls',
    what: '[[g:trv|TRVs]] on each radiator and [[g:weather-compensation]], so the heating runs gentler for longer.',
    disruption: {
      days: { min: 1, max: 1 },
      rooms: [],
      stayIn: 'yes',
      mess: 'low',
      note: 'The heating is off for a few hours while valves are swapped. Nothing else changes.',
    },
    next: {
      installer: 'A heating engineer.',
      accreditation: ['gas-safe', 'trustmark'],
      why: 'Work on a gas boiler is legal only for a Gas Safe engineer. The value is in the settings, not just the parts.',
      questions: [
        'Will you lower the [[g:flow-temperature]] and set the weather compensation curve, then show me how?',
        'Will you balance the radiators, so every room warms up at the same pace?',
        'Can my boiler take an outdoor sensor, or does it need a new controller?',
      ],
    },
    provenance: typical(EST.controls),
  },
  {
    measureId: 'mvhr',
    name: 'Ventilation with heat recovery',
    what: '[[g:mvhr]]: a quiet fan unit and ducts that swap stale air for fresh and keep most of the warmth.',
    disruption: {
      days: { min: 3, max: 7 },
      rooms: ['Ceilings and cupboards where ducts run', 'A loft or cupboard for the unit'],
      stayIn: 'mostly',
      mess: 'high',
      note: 'Ducts need routes through ceilings and walls, so expect some plastering afterwards. It works best once the house is fairly airtight.',
    },
    next: {
      installer: 'A ventilation specialist who designs and commissions the system.',
      accreditation: ['competent-person', 'trustmark'],
      why: 'A badly balanced system is noisy or does nothing. The installer must measure the airflow in every room.',
      questions: [
        'Will you measure and record the airflow in every room when you commission it?',
        'How loud will it be in the bedrooms at night?',
        'How often do the filters need changing, and what do they cost?',
      ],
    },
    provenance: typical(HISTORIC_ENGLAND),
  },
  {
    measureId: 'ashp',
    name: 'Air source heat pump',
    what: 'A [[g:heat-pump]] outside your home in place of the boiler, with bigger radiators where rooms need them.',
    disruption: {
      days: { min: 3, max: 5 },
      rooms: [
        'A spot outside for the unit',
        'A cupboard for the hot water cylinder',
        'Rooms where radiators are swapped',
      ],
      stayIn: 'mostly',
      mess: 'medium',
      note: 'Heating and hot water are off for one or two days in the middle. Larger radiators go in where a room needs more warmth.',
    },
    next: {
      installer: 'An MCS certified heat pump installer.',
      accreditation: ['mcs', 'recc', 'gas-safe'],
      why: 'Only MCS installs get the Boiler Upgrade Scheme [[g:grant]]. If the old boiler or the gas supply is taken out, a Gas Safe engineer must do it.',
      questions: [
        'Have you done a room by room heat loss calculation, and what [[g:flow-temperature]] will my radiators need?',
        'Where will the outdoor unit go, and does it pass the noise test for [[g:permitted-development]]?',
        'Will you apply for the Boiler Upgrade Scheme grant and tell the [[g:dno]] for me?',
      ],
    },
    provenance: typical(EST.ashp, MCS_020A, OFGEM_BUS),
  },
  {
    measureId: 'pv',
    name: 'Solar panels',
    what: 'Solar panels on the roof that make electricity, with an inverter indoors.',
    disruption: {
      days: { min: 1, max: 2 },
      rooms: ['A loft or cupboard for the inverter'],
      stayIn: 'yes',
      mess: 'low',
      note: 'Scaffold is up for about a week. The electricity is off for an hour or two while the inverter is connected.',
    },
    next: {
      installer: 'An MCS certified solar installer.',
      accreditation: ['mcs', 'recc', 'competent-person'],
      why: 'You need MCS certification to be paid for the electricity you [[g:export]].',
      questions: [
        'How much will it make in a year, after shading from chimneys and trees?',
        'Will you register it with the [[g:dno]] and help me sign up for an export payment?',
        'In a [[g:conservation-area]], can the panels go on a slope you cannot see from the street?',
      ],
    },
    provenance: typical(EST.pv),
  },
  {
    measureId: 'battery',
    name: 'Home battery',
    what: 'A wall mounted battery that stores cheap or solar electricity for the evening.',
    disruption: {
      days: { min: 1, max: 1 },
      rooms: ['A wall in a garage, utility room or cupboard'],
      stayIn: 'yes',
      mess: 'low',
      note: 'Half a day. The electricity is off for an hour or two while it is wired in.',
    },
    next: {
      installer: 'An MCS certified installer or a qualified electrician.',
      accreditation: ['mcs', 'competent-person'],
      why: 'Batteries connect to the grid and store a lot of energy, so they need certified electrical work.',
      questions: [
        'Where is the safest place for it, away from the way out of the house?',
        'Which tariff will it charge on, and how will it decide when to charge?',
        'How many years and charge cycles does the warranty cover?',
      ],
    },
    provenance: typical(EST.pv),
  },
  {
    measureId: 'cylinder-jacket',
    name: 'Hot water cylinder jacket',
    what: 'A thick insulating jacket for an existing [[g:cylinder]], and lagging for the pipes near it.',
    disruption: {
      days: { min: 0, max: 0 },
      rooms: [],
      stayIn: 'yes',
      mess: 'low',
      note: 'Under an hour, and many people do it themselves.',
    },
    next: {
      installer: 'You, or any plumber.',
      accreditation: [],
      why: 'There is nothing to certify. Buy a jacket at least 80 mm thick that fits your cylinder.',
      questions: [
        'Is my cylinder already factory insulated, with hard foam rather than a loose jacket?',
        'Does the jacket cover the top and sides without hiding the thermostat?',
        'Can the pipes near the cylinder be lagged at the same time?',
      ],
    },
    provenance: typical(EST.hotWater),
  },
  {
    measureId: 'solar-thermal',
    name: 'Solar water heating',
    what: '[[g:solar-thermal]] panels on the roof that warm your hot water.',
    disruption: {
      days: { min: 2, max: 3 },
      rooms: ['The airing cupboard, where the cylinder may be replaced'],
      stayIn: 'yes',
      mess: 'medium',
      note: 'Scaffold is up for about a week. Hot water is off for a day if the cylinder needs changing.',
    },
    next: {
      installer: 'An MCS certified solar thermal installer.',
      accreditation: ['mcs', 'recc'],
      why: 'MCS covers solar thermal design and products, and a consumer code protects your deposit.',
      questions: [
        'Does my cylinder need a second coil, or a new cylinder?',
        'How much of my hot water will it provide in winter, not just in summer?',
        'Will it share the roof with solar panels, and which gives me more?',
      ],
    },
    provenance: typical(EST.solarThermal),
  },
  {
    measureId: 'cylinder',
    name: 'New hot water cylinder',
    what: 'A well insulated [[g:cylinder]] for a heat pump, in place of a [[g:combi-boiler]]’s instant hot water.',
    disruption: {
      days: { min: 1, max: 2 },
      rooms: ['A cupboard about the size of a small wardrobe'],
      stayIn: 'yes',
      mess: 'medium',
      note: 'Fitted with the heat pump. Finding the cupboard space is the hard part, not the work.',
    },
    next: {
      installer: 'Your heat pump installer.',
      accreditation: ['mcs', 'competent-person'],
      why: 'A mains pressure cylinder needs a fitter with the G3 unvented qualification, and a building regulations notice.',
      questions: [
        'Where will it fit, and what will I lose from that cupboard?',
        'Are you G3 qualified to fit an unvented cylinder?',
        'How big should it be for the people in my home?',
      ],
    },
    provenance: typical(EST.ashp, EST.hotWater),
  },
  {
    measureId: 'hob-induction',
    name: 'Induction hob and gas disconnection',
    what: 'An induction hob in place of the gas hob, then the gas supply capped, so the gas [[g:standing-charge]] stops.',
    disruption: {
      days: { min: 1, max: 1 },
      rooms: ['The kitchen, for half a day'],
      stayIn: 'yes',
      mess: 'low',
      note: 'An electrician may need to run a new cable to the hob. The gas meter comes out on a separate visit.',
    },
    next: {
      installer: 'A kitchen fitter or electrician, and a Gas Safe engineer to cap the gas.',
      accreditation: ['gas-safe', 'competent-person'],
      why: 'Capping gas is legal only for a Gas Safe engineer. A hob circuit needs certified electrical work.',
      questions: [
        'Is my fuse board and supply big enough for an induction hob?',
        'Will you cap the gas safely and ask my supplier to remove the meter?',
        'Will my pans work on induction, or do I need some new ones?',
      ],
    },
    provenance: typical(GAS_SAFE),
  },
] as const satisfies readonly MeasureGuidance[];

/** Measure ids that have guidance, in display order. */
export type GuidedMeasureId = (typeof LIST)[number]['measureId'];

export const MEASURE_GUIDANCE: Readonly<Record<GuidedMeasureId, MeasureGuidance>> = Object.freeze(
  Object.fromEntries(LIST.map((g): [string, MeasureGuidance] => [g.measureId, g])) as Record<
    GuidedMeasureId,
    MeasureGuidance
  >,
);

export const GUIDED_MEASURE_IDS: readonly GuidedMeasureId[] = LIST.map((g) => g.measureId);

/** Guidance for a measure id, or undefined when we have none. */
export function guidanceFor(measureId: string): MeasureGuidance | undefined {
  return (MEASURE_GUIDANCE as Record<string, MeasureGuidance | undefined>)[measureId];
}
