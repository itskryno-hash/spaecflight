// parts.js - all part definitions and stats

const PARTS = {
  nose_cone: {
    id: 'nose_cone',
    name: 'Nose Cone',
    type: 'nose',
    symbol: '▲',
    ascii: [
      '  /\\  ',
      ' /  \\ ',
      '/____\\',
    ],
    mass: 0.5,        // tonnes
    fuelCapacity: 0,
    thrust: 0,
    dragCoeff: 0.1,   // reduces overall drag when present
    description: 'Aerodynamic nose. Reduces drag significantly.',
    color: '#aaaaaa',
    position: 'top',  // must go on top
    provides: ['aerodynamics'],
  },

  command_pod: {
    id: 'command_pod',
    name: 'Command Pod',
    type: 'command',
    symbol: '⬡',
    ascii: [
      ' ____ ',
      '|    |',
      '| CM |',
      '|____|',
    ],
    mass: 1.2,
    fuelCapacity: 0,
    thrust: 0,
    dragCoeff: 0.5,
    description: 'Crew module. Required for mission control link.',
    color: '#cccccc',
    position: 'upper',
    provides: ['control'],
  },

  fuel_tank_small: {
    id: 'fuel_tank_small',
    name: 'Fuel Tank (S)',
    type: 'tank',
    symbol: '▭',
    ascii: [
      ' ____ ',
      '|    |',
      '| S  |',
      '|____|',
    ],
    mass: 0.5,
    fuelCapacity: 800,   // kg of fuel
    thrust: 0,
    dragCoeff: 0.3,
    description: 'Small fuel tank. 800kg capacity.',
    color: '#88aaff',
    position: 'any',
    provides: ['fuel'],
  },

  fuel_tank_large: {
    id: 'fuel_tank_large',
    name: 'Fuel Tank (L)',
    type: 'tank',
    symbol: '▬',
    ascii: [
      ' ____ ',
      '|    |',
      '|    |',
      '| L  |',
      '|    |',
      '|____|',
    ],
    mass: 1.0,
    fuelCapacity: 2400,  // kg of fuel
    thrust: 0,
    dragCoeff: 0.3,
    description: 'Large fuel tank. 2400kg capacity.',
    color: '#5599ff',
    position: 'any',
    provides: ['fuel'],
  },

  engine_weak: {
    id: 'engine_weak',
    name: 'LV-1 Engine',
    type: 'engine',
    symbol: '↓',
    ascii: [
      ' /||\\',
      '/|  |\\',
      ' \\__/ ',
    ],
    mass: 0.8,
    fuelCapacity: 0,
    thrust: 180000,     // Newtons
    fuelBurnRate: 60,   // kg/s
    isp: 300,           // specific impulse
    dragCoeff: 0.4,
    description: 'Weak but efficient. 180kN thrust.',
    color: '#ff8844',
    position: 'bottom',
    provides: ['propulsion'],
  },

  engine_strong: {
    id: 'engine_strong',
    name: 'LV-9 Engine',
    type: 'engine',
    symbol: '⬇',
    ascii: [
      '/||||\\',
      '||  ||',
      ' \\__/ ',
    ],
    mass: 2.0,
    fuelCapacity: 0,
    thrust: 650000,     // Newtons
    fuelBurnRate: 220,  // kg/s
    isp: 295,
    dragCoeff: 0.5,
    description: 'High thrust beast. 650kN thrust.',
    color: '#ff5500',
    position: 'bottom',
    provides: ['propulsion'],
  },

  fins: {
    id: 'fins',
    name: 'Aerodynamic Fins',
    type: 'fins',
    symbol: '⊣⊢',
    ascii: [
      '>|  |<',
      ' |  | ',
      '>|__|<',
    ],
    mass: 0.3,
    fuelCapacity: 0,
    thrust: 0,
    dragCoeff: 0.2,
    description: 'Stabilizes flight path. Prevents drift.',
    color: '#44ff88',
    position: 'bottom',
    provides: ['stability'],
  },
};

// fuel density kg/L (we'll just treat fuelCapacity as kg)
const FUEL_DENSITY = 1.0;

// gravitational constant
const G = 9.81; // m/s^2

// atmosphere model - density at altitude (kg/m^3)
function getAtmosphericDensity(altitudeM) {
  if (altitudeM > 100000) return 0;          // above karman line, vacuum
  if (altitudeM > 50000) return 0.001;       // upper atmosphere
  if (altitudeM > 20000) return 0.09;        // stratosphere
  if (altitudeM > 12000) return 0.31;        // upper troposphere
  if (altitudeM > 8000)  return 0.53;        // mid troposphere
  if (altitudeM > 4000)  return 0.82;        // lower troposphere
  return 1.225;                               // sea level
}

// altitude zones
const ALTITUDE_ZONES = [
  { name: 'GROUND',         min: 0,       max: 100,    label: 'GROUND LEVEL' },
  { name: 'LOW_ATMO',       min: 100,     max: 12000,  label: 'LOWER ATMOSPHERE' },
  { name: 'HIGH_ATMO',      min: 12000,   max: 50000,  label: 'UPPER ATMOSPHERE' },
  { name: 'MESOSPHERE',     min: 50000,   max: 100000, label: 'MESOSPHERE' },
  { name: 'KARMAN',         min: 100000,  max: 100500, label: '>>> KARMAN LINE <<<' },
  { name: 'LOW_ORBIT',      min: 100000,  max: 400000, label: 'LOW EARTH ORBIT' },
  { name: 'DEEP_SPACE',     min: 400000,  max: Infinity,label: 'DEEP SPACE' },
];

function getZone(altitudeM) {
  for (const zone of ALTITUDE_ZONES) {
    if (altitudeM >= zone.min && altitudeM < zone.max) return zone;
  }
  return ALTITUDE_ZONES[ALTITUDE_ZONES.length - 1];
}

// export for other modules
if (typeof module !== 'undefined') {
  module.exports = { PARTS, G, getAtmosphericDensity, ALTITUDE_ZONES, getZone };
}
