export const braceletChainTypes = {
  'Forsat S': 0,
  'Forsat M': 150,
  'Forsat L': 290,
  'Gourmette S': 290,
  'Chopard S': 390,
  'Gourmette M': 550,
  'Chopard M': 750,
} as const;

export type BraceletChainType = keyof typeof braceletChainTypes;

export const necklaceChainTypes = {
  'Forsat S': { supplement: 0, perCm: 20 },
  'Forsat M': { supplement: 350, perCm: 25 },
  'Forsat L': { supplement: 790, perCm: 35 },
  'Gourmette S': { supplement: 790, perCm: 35 },
  'Chopard S': { supplement: 990, perCm: 45 },
  'Gourmette M': { supplement: 1290, perCm: 55 },
  'Chopard M': { supplement: 1890, perCm: 70 },
} as const;

export type NecklaceChainType = keyof typeof necklaceChainTypes;

export const necklaceSizes = [41, 45, 50, 55, 60, 70, 80] as const;

export const ringBandSupplements = {
  Small: {
    XS: 0,
    S: 300,
    L: 500,
    XL: 700,
  },
  Light: {
    XS: 0,
    S: 600,
    L: 900,
    XL: 1400,
  },
  Big: {
    XS: 0,
    S: 1000,
    L: 1500,
    XL: 2000,
  },
} as const;

export type RingBandType = keyof typeof ringBandSupplements;
export type RingSize = keyof (typeof ringBandSupplements)['Small'];

export const ringSizes: RingSize[] = ['XS', 'S', 'L', 'XL'];

export const HAND_CHAIN_MULTIPLIER = 1.5;
