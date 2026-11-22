// Nightjar tuning: every number and colour the game uses, in one place.
// The playfield is a fixed 1280x720 logical area made of 40 px tiles (32 x 18);
// the renderer scales it to the window, so no rule depends on the screen size.

export const FIELD = { width: 1280, height: 720, tile: 40, cols: 32, rows: 18 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 168, // px per second, upright
  sneakSpeed: 92, // px per second, crouched
  runSpeed: 238, // px per second, sprinting (loud and easy to spot)
  catchRadius: 26, // a chasing guard this close catches the player
  pebbleCooldown: 1.2, // seconds between thrown pebbles
  pebbleRange: 320, // how far a pebble can be thrown
};

export const GUARD = {
  radius: 13,
  patrolSpeed: 66,
  chaseSpeed: 196,
  investigateSpeed: 118,
  viewRange: 236, // px, how far the vision cone reaches
  viewAngle: 1.15, // radians, full width of the vision cone
  turnRate: 2.6, // radians per second while turning toward a waypoint
  alertFillNear: 1.5, // detection per second at point-blank range, upright
  alertFillFar: 0.45, // detection per second at the edge of the cone, upright
  alertDecay: 0.35, // detection lost per second while unseen
  chaseMemory: 3.2, // seconds a guard keeps hunting after losing sight
  lookAround: 1.6, // seconds spent scanning at a patrol waypoint
  hearRadius: 150, // a pebble landing this close draws the guard
  noiseRadiusSprint: 120, // sprinting footsteps are heard this far
};

export const CAMERA = {
  viewRange: 210,
  viewAngle: 0.85,
  sweepAngle: 1.5, // radians either side of its rest direction
  sweepPeriod: 7, // seconds for a full sweep there and back
  alertFill: 0.8, // detection per second while the player is in the beam
  alertDecay: 0.3,
};

/** How visible the player is in each stance: multiplies how fast detection fills. */
export const VISIBILITY = {
  standing: 1,
  sneaking: 0.45,
  sprinting: 1.6,
  inBush: 0.12, // crouched inside a plant: nearly invisible unless point-blank
  pointBlank: 64, // closer than this, even a bush does not hide you
};

export const SCORE = {
  gem: 500,
  loot: 150,
  levelClear: 400,
  ghostBonus: 600, // finishing a level without ever being fully spotted
  alarmPenalty: 200, // per full alert raised
  timeBonusPerSecond: 2, // per second under the level's par time
};

export const PALETTE = {
  backdrop: '#0b0e1a',
  floorA: '#232a42',
  floorB: '#20263c',
  floorLine: '#2c3450',
  wallTop: '#4a5578',
  wallFace: '#39426a',
  wallEdge: '#5d6b96',
  crate: '#8a6a44',
  crateDark: '#6e5436',
  plant: '#2e7d5b',
  plantDark: '#256a4c',
  player: '#ffd166',
  playerDark: '#c99a3f',
  guard: '#e5534b',
  guardDark: '#b83a34',
  guardCap: '#7a2a26',
  coneCalm: 'rgba(255, 214, 102, 0.16)',
  coneSuspicious: 'rgba(255, 159, 67, 0.24)',
  coneAlert: 'rgba(229, 83, 75, 0.30)',
  coneEdge: 'rgba(255, 214, 102, 0.35)',
  gem: '#7be0ff',
  loot: '#f2c94c',
  exit: '#57d977',
  exitDark: '#2f8f4e',
  panel: 'rgba(13, 17, 32, 0.88)',
  panelEdge: '#46538a',
  text: '#eef1f5',
  muted: '#9aa5c4',
  danger: '#ff6b5e',
  good: '#7be495',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'nightjar.best';
