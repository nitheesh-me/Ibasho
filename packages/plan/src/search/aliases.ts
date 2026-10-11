/**
 * Curated names for the sample areas (RB 2, 3, 5): what people on campus call buildings, by the
 * normalised OSM name or document name. Extend freely; every entry is a plain alias.
 */
export const CURATED_ALIASES: Readonly<Record<string, readonly string[]>> = {
  vindhya: ['Vindhya Bhavan', 'Vindhya Block', 'VB'],
  'vindhya bhavan': ['Vindhya', 'Vindhya Block', 'VB'],
  'himalaya academic block': ['Himalaya', 'Himalaya Bhavan', 'Himalaya Block'],
  himalaya: ['Himalaya Bhavan', 'Himalaya Building'],
  'd block': ['Himalaya D Block', 'Block D Himalaya', 'Incubator block'],
  nilgiri: ['Nilgiri Bhavan', 'Nilgiri Block'],
  'kohli research block': ['KCIS', 'Kohli Centre on Intelligent Systems', 'KRB', 'Kohli Block'],
  'kadamba nivas new boys hostel': ['Kadamba', 'NBH', 'New Boys Hostel'],
  'palash nivas old boys hostel': ['Palash', 'OBH', 'Old Boys Hostel'],
  'parijaat nivas': ['Parijaat', 'Parijat'],
  'bakul nivas': ['Bakul'],
  'academic office': ['Academic Block office'],
  'c r rao advanced institute of mathematics statistics and computer science aimscs': [
    'AIMSCS',
    'CR Rao Institute',
  ],
  'gmc balayogi sats indoor stadium': ['Gachibowli Indoor Stadium', 'SATS Stadium'],
  'hitec city office': ['HITEC City office tower', 'Grade A office'],
  'iiit hyderabad campus': [
    'IIIT',
    'IIITH',
    'IIIT-H',
    'IIIT Hyderabad',
    'International Institute of Information Technology',
    'Gachibowli campus',
    'campus',
  ],
  'gachibowli apartments': ['Gachibowli', 'Apartment block'],
  'london terrace': ['London', 'GH1'],
  'commerzone raidurg': [
    'Qualcomm',
    'QCOM',
    'Qualcomm Hyderabad',
    'Qualcomm campus',
    'KRC Commerzone',
    'Mindspace Commerzone',
  ],
  'sattva knowledge park tower 1': [
    'Vanguard',
    'Vanguard Hyderabad',
    'Vanguard GCC',
    'Vanguard Global Value Center',
    'Sattva Knowledge Park',
    'SKP Tower 1',
  ],
  'salapuria sattva knowledge park tower 2': ['Sattva Knowledge Park Tower 2', 'SKP Tower 2'],
  'sattva knowledge city octave block': [
    'Lloyds',
    'Lloyds Technology Centre',
    'Lloyds Banking Group',
    'LTC',
    'Octave Block',
    'Sattva Knowledge City',
  ],
  'kings cross london': ["King's Cross", 'Kings Cross', 'St Pancras', 'Granary Square'],
  'raidurg and knowledge city': ['Knowledge City', 'Raidurg', 'Rayadurgam', 'Raidurgam'],
  dlf: ['DLF Cyber City', 'DLF Gachibowli', 'Cyber City'],
  '1905 london terrace': ['GH1', 'London terrace'],
};

/** Words for storey numbers: "first floor", "floor 1", "level 1", "L1", "1st". */
export const ORDINALS = [
  'ground',
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
];
export const ORDINAL_SUFFIX = ['0th', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];
