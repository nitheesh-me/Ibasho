/**
 * Glossary: every technical word a person may meet, with a plain definition (UX 15, WP-09 I5).
 * Owner: WP-09. Definitions are one sentence, second person where it helps, and use no other
 * glossary term unmarked. Copy marks a term with `[[g:<id>]]` (see `marks.ts`).
 */
import type { GlossaryEntry } from './types.ts';

const ENTRIES: readonly GlossaryEntry[] = [
  // The house and its heat
  {
    id: 'u-value',
    term: 'U-value',
    plain: 'How fast heat leaks through a wall, roof, floor or window. Lower is better.',
    more: 'Measured in watts for every square metre and every degree of difference between inside and out.',
  },
  {
    id: 'heat-loss',
    term: 'heat loss',
    plain: 'The heat your home lets out to the cold, through its fabric and through moving air.',
  },
  {
    id: 'junction',
    term: 'junction',
    plain:
      'A place where two parts of the house meet, like a wall and a floor, where heat often slips through.',
    more: 'Builders call the leak at a junction a thermal bridge.',
  },
  {
    id: 'thermal-bridge',
    term: 'thermal bridge',
    plain: 'A weak spot where heat takes a short cut out, often at a junction, a lintel or a window edge.',
  },
  {
    id: 'fabric',
    term: 'fabric',
    plain: 'The shell of the house: walls, roof, floor, windows and doors.',
  },
  {
    id: 'air-leakage',
    term: 'air leakage',
    plain:
      'Warm air escaping through gaps you did not choose, like old sash edges, floorboards and chimneys.',
  },
  {
    id: 'ventilation',
    term: 'ventilation',
    plain:
      'Fresh air you do choose: vents, extractor fans and opening windows. A home needs it to stay healthy.',
  },
  {
    id: 'solid-wall',
    term: 'solid wall',
    plain:
      'A wall built as one thick layer of brick or stone, with no gap inside to fill. Common before about 1930.',
  },
  {
    id: 'suspended-floor',
    term: 'suspended timber floor',
    plain: 'A ground floor of boards on joists, with an airy gap underneath rather than concrete.',
  },
  {
    id: 'moisture-risk',
    term: 'moisture risk',
    plain:
      'The chance that water gets trapped inside a wall or floor after a change, where it can cause damp or rot.',
  },
  {
    id: 'condensation',
    term: 'condensation',
    plain: 'Water that forms when warm, damp air meets a cold surface, like mist on a bathroom mirror.',
  },
  {
    id: 'vapour-open',
    term: 'vapour open',
    plain: 'A material that lets water vapour pass through and dry out, as old brick and lime plaster do.',
  },
  {
    id: 'low-e',
    term: 'low-E glass',
    plain: 'Glass with an invisible coating that bounces heat back into the room.',
  },
  // Heating and hot water
  {
    id: 'heat-pump',
    term: 'heat pump',
    plain:
      'A machine that moves heat from the outside air into your home, like a fridge working in reverse. It runs on electricity.',
  },
  {
    id: 'flow-temperature',
    term: 'flow temperature',
    plain:
      'How hot the water is as it leaves the boiler or heat pump for the radiators. Lower is gentler and cheaper.',
  },
  {
    id: 'seasonal-efficiency',
    term: 'seasonal efficiency',
    plain:
      'How much heat you get for each unit of energy you pay for, averaged over a whole year. Higher is better.',
    more: 'For a heat pump it is often above 3, meaning three units of heat for one of electricity.',
  },
  {
    id: 'scop',
    term: 'SCOP',
    plain:
      'A heat pump’s seasonal efficiency: heat delivered over a year divided by electricity used. Higher is better.',
  },
  {
    id: 'emitter',
    term: 'emitter',
    plain: 'Whatever gives heat to the room: a radiator, a fan coil or underfloor pipes.',
  },
  {
    id: 'combi-boiler',
    term: 'combi boiler',
    plain: 'A boiler that heats water the moment you turn on a tap, so there is no hot water tank.',
  },
  {
    id: 'cylinder',
    term: 'hot water cylinder',
    plain: 'An insulated tank that stores hot water. Most heat pumps need one.',
  },
  {
    id: 'trv',
    term: 'TRV',
    plain:
      'A thermostatic radiator valve: the numbered knob that lets each radiator keep its own room warm enough.',
  },
  {
    id: 'weather-compensation',
    term: 'weather compensation',
    plain:
      'A control that runs the heating gentler on mild days and harder on cold ones, using an outdoor sensor.',
  },
  {
    id: 'mvhr',
    term: 'MVHR',
    plain:
      'Mechanical ventilation with heat recovery: a quiet fan system that swaps stale air for fresh and keeps most of the warmth.',
  },
  {
    id: 'solar-thermal',
    term: 'solar thermal',
    plain: 'Panels that use sunshine to heat water directly, rather than to make electricity.',
  },
  // Electricity and money
  {
    id: 'kwh',
    term: 'kWh',
    plain: 'A kilowatt hour: the unit on your energy bill. A one-bar electric fire uses about one an hour.',
  },
  {
    id: 'kwp',
    term: 'kWp',
    plain: 'Kilowatt peak: the size of a solar panel system, as the most it can make in bright sun.',
  },
  {
    id: 'self-use',
    term: 'self-use',
    plain: 'The share of your solar electricity you use at home, rather than send to the grid.',
  },
  {
    id: 'export',
    term: 'export',
    plain: 'Solar electricity you send to the grid. Your supplier pays you a little for it.',
  },
  {
    id: 'standing-charge',
    term: 'standing charge',
    plain: 'The fixed daily amount on a bill that you pay however little energy you use.',
  },
  {
    id: 'payback',
    term: 'payback',
    plain: 'How many years of lower bills it takes to repay what a change costs.',
  },
  {
    id: 'npv',
    term: 'value in today’s money',
    plain:
      'Every future saving minus the cost, with later pounds counted for a little less than pounds today. Above zero means it pays.',
    more: 'Economists call this net present value, or NPV.',
  },
  {
    id: 'running-carbon',
    term: 'running carbon',
    plain: 'The greenhouse gas from the energy your home uses each year, not from making or fitting things.',
  },
  {
    id: 'grant',
    term: 'grant',
    plain:
      'Money towards a change that you do not pay back, such as the Boiler Upgrade Scheme for heat pumps.',
  },
  // Rules and permissions
  {
    id: 'epc',
    term: 'EPC',
    plain:
      'Energy Performance Certificate: the A to G rating a home needs to be sold or let. Ours is an estimate, not a certificate.',
  },
  {
    id: 'permitted-development',
    term: 'permitted development',
    plain:
      'Changes you may make without asking the council for planning permission, if you meet set conditions.',
  },
  {
    id: 'conservation-area',
    term: 'conservation area',
    plain:
      'A neighbourhood protected for its character, where changes you can see from the street need more care.',
  },
  {
    id: 'listed-building',
    term: 'listed building',
    plain: 'A building protected for its history. Most changes, inside or out, need listed building consent.',
  },
  {
    id: 'dno',
    term: 'network operator',
    plain:
      'The company that owns the cables to your street. A heat pump or battery may need its approval first.',
  },
  {
    id: 'looped-supply',
    term: 'looped supply',
    plain: 'One electricity cable shared by two homes. It may need splitting before a heat pump goes in.',
  },
  {
    id: 'retrofit-coordinator',
    term: 'retrofit coordinator',
    plain:
      'A qualified person who plans and checks a home’s whole set of changes, so they work together safely.',
  },
  // Buildings in their city (v3)
  {
    id: 'eui',
    term: 'EUI',
    plain:
      'Energy use intensity: the energy a building uses in a year for each square metre of floor. Lower is better.',
    more: 'Written in kWh per square metre a year, so a school and a hotel can be compared fairly.',
  },
  {
    id: 'end-uses',
    term: 'end uses',
    plain:
      'What the energy is for: cooling, heating, lighting, equipment, fans, pumps and hot water, each counted on its own.',
  },
  {
    id: 'site-source',
    term: 'site and source energy',
    plain:
      'Site energy is what the meters read. Source energy adds what was lost making and delivering it, such as at the power station.',
  },
  {
    id: 'sun-hours',
    term: 'sun hours',
    plain: 'How many hours of direct sun a roof, wall or window gets, after the neighbours’ shadows.',
  },
  {
    id: 'radiation',
    term: 'solar radiation',
    plain:
      'The sun’s energy landing on a surface over a year. High on a roof means good for solar panels, and on glass it means heat.',
  },
  {
    id: 'height-range',
    term: 'height range',
    plain:
      'When we do not know how tall a neighbour is, we use a likely height and a highest plausible one. Its shadow shows both.',
  },
  {
    id: 'sda',
    term: 'sDA',
    plain:
      'Spatial daylight autonomy: the share of a floor bright enough to work by daylight alone for at least half the working year. Higher is better.',
  },
  {
    id: 'ase',
    term: 'ASE',
    plain:
      'Annual sunlight exposure: the share of a floor that gets harsh direct sun for too many hours a year, a sign of glare and heat. Lower is better.',
  },
  {
    id: 'window-share',
    term: 'window share',
    plain:
      'How much of a wall is glass, as a percentage. More lets in light and views, and in a hot climate also heat.',
    more: 'Professionals call it the window to wall ratio, or WWR.',
  },
  {
    id: 'shading-depth',
    term: 'shading depth',
    plain:
      'How far an overhang, fin or chajja reaches out compared with the window it shades. Deeper blocks more high sun.',
    more: 'Codes call this the projection factor.',
  },
  {
    id: 'chajja',
    term: 'chajja',
    plain: 'A thin concrete or stone ledge above a window that keeps off sun and rain. Common across India.',
  },
  {
    id: 'fan-first',
    term: 'fan-first comfort',
    plain:
      'Counting the hours a room feels comfortable with ceiling fans alone, before any air conditioning is switched on.',
  },
  {
    id: 'set-point',
    term: 'set point',
    plain:
      'The temperature the air conditioning or heating aims for. Each degree warmer in summer cuts cooling noticeably.',
  },
  {
    id: 'slab-tariff',
    term: 'slab tariff',
    plain:
      'A tariff where the price per unit rises in steps as monthly use grows. Crossing a step can raise the whole bill.',
  },
  {
    id: 'ecbc',
    term: 'ECBC',
    plain:
      'The Energy Conservation Building Code: India’s energy rules for larger commercial buildings. Telangana checks it when plans are approved.',
  },
  {
    id: 'ecsbc',
    term: 'ECSBC',
    plain:
      'The Energy Conservation and Sustainable Building Code of 2024, the newer Indian code. It has three levels, from meeting the code to Super.',
  },
  {
    id: 'ens',
    term: 'ENS',
    plain:
      'Eco Niwas Samhita: India’s energy code for homes and apartments, which mainly limits how much heat the walls and windows let in.',
  },
  {
    id: 'part-l',
    term: 'Part L',
    plain:
      'The part of the Building Regulations for England that sets how much energy a new or altered building may use.',
  },
  {
    id: 'future-homes',
    term: 'Future Homes Standard',
    plain:
      'England’s coming standard for new homes: low carbon heating and much lower energy use than homes built today.',
  },
  {
    id: 'leed-points',
    term: 'LEED points',
    plain:
      'Credits in LEED, a green building rating used worldwide. Enough points earn a level such as Silver or Gold, once an assessor agrees.',
  },
  {
    id: 'green-rating',
    term: 'green rating',
    plain:
      'A voluntary scheme, such as LEED, IGBC, GRIHA or EDGE, that awards a level for energy, water and materials.',
  },
  {
    id: 'pre-check',
    term: 'pre-check',
    plain:
      'Our early reading of where a design stands against a code or rating. It is not a certificate; only an assessor can give one.',
  },
  {
    id: 'baseline',
    term: 'baseline',
    plain:
      'The reference building a code compares yours with: the same shape, built to the code’s minimum.',
  },
  {
    id: 'variant',
    term: 'variant',
    plain:
      'A named version of your building, such as “as built” or “with fins”, kept as a list of changes from the original.',
  },
  {
    id: 'preview',
    term: 'Preview',
    plain:
      'An example result in the real shape, shown until the full calculation for that step is ready. It is not yet your building’s number.',
  },
  {
    id: 'rough-result',
    term: 'rough result',
    plain: 'A fast first answer that sharpens in place as the detailed calculation finishes.',
  },
  // How Ibasho talks about itself
  {
    id: 'twin',
    term: 'twin',
    plain: 'Our working copy of your building: its rooms, walls, windows, systems and the people who use it.',
  },
  {
    id: 'estimated',
    term: 'estimated',
    plain: 'A value we filled in from buildings like yours. It looks pencilled until you tell us more.',
  },
  {
    id: 'likely-range',
    term: 'likely range',
    plain: 'Where the true value probably sits. We show a range, not one number, when we are not sure.',
  },
  {
    id: 'modelled',
    term: 'modelled',
    plain: 'Worked out by our physics model of your building. Tested against published data, not proved.',
  },
  {
    id: 'checked',
    term: 'checked',
    plain: 'The arithmetic behind this number was worked again, independently, from the certificate.',
  },
  {
    id: 'proved',
    term: 'proved',
    plain: 'A machine-checked proof shows this claim holds for every building, not just this one.',
    more: 'We prove the bookkeeping and the search, never the physics.',
  },
  {
    id: 'certificate',
    term: 'certificate',
    plain: 'A record of every option we considered and why, which a separate checker can work through again.',
  },
  {
    id: 'lean',
    term: 'Lean',
    plain: 'A proof assistant: software that checks a mathematical proof step by step and accepts no gaps.',
  },
  {
    id: 'evidence',
    term: 'evidence',
    plain: 'Where a number came from: its inputs, its formula, its sources and how it was checked.',
  },
  {
    id: 'front',
    term: 'the front',
    plain:
      'The options where you cannot do better on one thing without giving up another, like cost against carbon.',
  },
  {
    id: 'calibration',
    term: 'calibration',
    plain: 'Adjusting our estimate of how the building is used so the model matches its real bills.',
  },
  {
    id: 'standard-conditions',
    term: 'standard conditions',
    plain: 'Typical use and weather, so buildings can be compared fairly. Your own bills may differ.',
  },
];

/** Glossary entries keyed by id. */
export const GLOSSARY: Readonly<Record<string, GlossaryEntry>> = Object.freeze(
  Object.fromEntries(ENTRIES.map((e) => [e.id, e])),
);

/** Ids in display order. */
export const GLOSSARY_IDS: readonly string[] = ENTRIES.map((e) => e.id);

/** The term as written in copy, or undefined for an unknown id. */
export function termOf(id: string): string | undefined {
  return GLOSSARY[id]?.term;
}

/** The plain definition, or undefined for an unknown id. */
export function definitionOf(id: string): string | undefined {
  return GLOSSARY[id]?.plain;
}
