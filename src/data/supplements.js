export const braceletChainTypes = {
  'Forsat S': 0,
  'Forsat M': 250,
  'Forsat L': 490,
  'Gourmette S': 490,
  'Chopard S': 650,
  'Gourmette M': 890,
  'Chopard M': 1190,
};

export const necklaceSizes = [
  41,
  45,
  50,
  55,
  60,
  70,
  80,
];

const DEFAULT_NECKLACE_BASE_SIZE = necklaceSizes[0] ?? 41;

const createNecklaceSizeMap = (supplement, perCm) =>
  Object.fromEntries(
    necklaceSizes.map((size) => [
      String(size),
      supplement + (size - DEFAULT_NECKLACE_BASE_SIZE) * perCm,
    ]),
  );

const createNecklaceConfig = (supplement, perCm) => ({
  supplement,
  perCm,
  sizes: createNecklaceSizeMap(supplement, perCm),
});

export const necklaceChainTypes = {
  'Forsat S': createNecklaceConfig(0, 20),
  'Forsat M': createNecklaceConfig(390, 25),
  'Forsat L': createNecklaceConfig(790, 35),
  'Gourmette S': createNecklaceConfig(790, 35),
  'Chopard S': createNecklaceConfig(990, 45),
  'Gourmette M': createNecklaceConfig(1290, 55),
  'Chopard M': createNecklaceConfig(1890, 70),
};

export const ringBandSupplements = {
  'Small': {
    'XS': 0,
    'S': 300,
    'L': 500,
    'XL': 700,
  },
  'Light': {
    'XS': 0,
    'S': 600,
    'L': 900,
    'XL': 1400,
  },
  'Big': {
    'XS': 0,
    'S': 1000,
    'L': 1500,
    'XL': 2000,
  },
};

export const ringSizes = [
  'XS',
  'S',
  'L',
  'XL',
];

export const HAND_CHAIN_MULTIPLIER = 1.5;
