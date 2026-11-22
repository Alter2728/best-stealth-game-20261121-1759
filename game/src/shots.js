// The screenshot scenes behind ?shot=title|cover|play|win. Each one plays the real rules
// forward from a fresh world: the title scene idles under its panel, the cover scene stages
// the burglar crouched behind crates while patrols and cameras sweep past, and the play and
// win scenes steer the burglar along a route with a cautious autopilot (walk toward the
// next waypoint, sneak near guards, freeze rather than step into a lit cone), so every
// frame is what a real game looks like and the same seed always gives the same frame.

import { FIELD, STEP } from './config.js';
import { EVENT_CLEAR } from './world.js';
import { SCREEN_CLEAR, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const TILE = FIELD.tile;

/** A route through The Gallery: down the west room, across the south hall, up into the
 *  gem room from above, then east and down to the exit. Tile coordinates. */
const GALLERY_ROUTE = [
  [3, 2], [3, 7], [3, 9], [5, 9], [5, 13], [9, 13], [9, 9], [9, 7],
  [19, 7], [19, 9], [20, 10], // the gem
  [19, 7], [27, 7], [27, 13], [27, 14], // the exit
];

function tileCenter(col, row) {
  return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
}

/** Would any guard or camera see the player standing at (x, y)? Tests by standing there. */
function seenAt(world, x, y) {
  const p = world.state.player;
  const ox = p.x;
  const oy = p.y;
  p.x = x;
  p.y = y;
  let seen = false;
  for (const guard of world.state.guards) {
    if (world.guardSeesPlayer(guard)) { seen = true; break; }
  }
  if (!seen) {
    for (const camera of world.state.cameras) {
      if (world.cameraSeesPlayer(camera)) { seen = true; break; }
    }
  }
  p.x = ox;
  p.y = oy;
  return seen;
}

function nearestGuardDistance(world) {
  const p = world.state.player;
  let best = Infinity;
  for (const guard of world.state.guards) {
    best = Math.min(best, Math.hypot(p.x - guard.x, p.y - guard.y));
  }
  return best;
}

/** One autopilot decision: head for the waypoint, but never step into a lit cone. */
function autopilot(world, route, cursor) {
  const p = world.state.player;
  // Stuck against furniture? Sidestep for a moment, then carry on.
  if (cursor.sidestep > 0) {
    cursor.sidestep -= 1;
    return { moveX: cursor.sideX, moveY: cursor.sideY, sneak: true, sprint: false, throwAt: null };
  }
  if (Math.hypot(p.x - cursor.lastX, p.y - cursor.lastY) < 1.5) cursor.still += 1;
  else cursor.still = 0;
  cursor.lastX = p.x;
  cursor.lastY = p.y;
  const target = route[cursor.index];
  if (!target) return { moveX: 0, moveY: 0, sneak: true, sprint: false, throwAt: null };
  const dx = target.x - p.x;
  const dy = target.y - p.y;
  const dist = Math.hypot(dx, dy);
  if (cursor.still > 90) {
    cursor.still = 0;
    cursor.sidestep = 30;
    cursor.sideX = dist > 0 ? -dy / dist : 1;
    cursor.sideY = dist > 0 ? dx / dist : 0;
    return { moveX: cursor.sideX, moveY: cursor.sideY, sneak: true, sprint: false, throwAt: null };
  }
  if (dist < 12) {
    cursor.index += 1;
    return { moveX: 0, moveY: 0, sneak: true, sprint: false, throwAt: null };
  }
  const sneak = nearestGuardDistance(world) < 300;
  const speed = sneak ? 92 : 168;
  const stepX = (dx / dist) * speed * STEP * 6; // look a few steps ahead
  const stepY = (dy / dist) * speed * STEP * 6;
  const inBush = world.tileAt(p.x, p.y) === 'P';
  const chasing = world.state.guards.some((g) => g.mode === 'chase');
  if (!chasing && !(inBush && sneak) && seenAt(world, p.x + stepX, p.y + stepY) && !seenAt(world, p.x, p.y)) {
    // The way ahead is lit and we are not: wait for the cone to pass.
    return { moveX: 0, moveY: 0, sneak: true, sprint: false, throwAt: null };
  }
  return {
    moveX: dx / dist,
    moveY: dy / dist,
    sneak,
    sprint: chasing,
    throwAt: null,
  };
}

function runAutopilot(world, route, seconds) {
  const cursor = { index: 0, still: 0, sidestep: 0, sideX: 0, sideY: 0, lastX: world.state.player.x, lastY: world.state.player.y };
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const events = world.step(STEP, autopilot(world, route, cursor));
    if (events & EVENT_CLEAR) return true;
    if (world.state.caught) return false;
  }
  return world.state.cleared;
}

/**
 * Set `world` to the named scene (title, cover, play or win; any other name is title) and
 * return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  if (name === 'cover') {
    // The Vault Wing, mid-heist: the burglar crouches behind the crates of the middle
    // hall while two patrols and a sweeping camera cross the room, then edges out from
    // cover until a guard's eye starts to fill — the frame catches the cone turning
    // suspicious, the "?" over the guard, and the detection eye part-full.
    world.loadLevel(1);
    const spot = tileCenter(14, 6);
    world.state.player.x = spot.x;
    world.state.player.y = spot.y;
    world.state.player.facing = Math.PI; // watching the west patrol
    for (let i = 0; i < 3 / STEP; i += 1) {
      world.step(STEP, { moveX: 0, moveY: 0, sneak: true, sprint: false, throwAt: null });
    }
    const peek = tileCenter(11, 5);
    for (let i = 0; i < 1.8 / STEP; i += 1) {
      const p = world.state.player;
      const dx = peek.x - p.x;
      const dy = peek.y - p.y;
      const dist = Math.hypot(dx, dy);
      world.step(STEP, {
        moveX: dist > 4 ? dx / dist : 0,
        moveY: dist > 4 ? dy / dist : 0,
        sneak: false,
        sprint: false,
        throwAt: null,
      });
      if (world.state.maxAlert >= 0.4) break;
    }
    world.step(STEP, { moveX: 0, moveY: 0, sneak: true, sprint: false, throwAt: null });
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'play') {
    world.loadLevel(0);
    const route = GALLERY_ROUTE.map(([c, r]) => tileCenter(c, r));
    runAutopilot(world, route, 12);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'win') {
    world.loadLevel(0);
    const route = GALLERY_ROUTE.map(([c, r]) => tileCenter(c, r));
    const cleared = runAutopilot(world, route, 240);
    return { screen: cleared ? SCREEN_CLEAR : SCREEN_PLAY, best: world.state.score };
  }
  world.loadLevel(0);
  for (let i = 0; i < 3 / STEP; i += 1) {
    world.step(STEP, { moveX: 0, moveY: 0, sneak: false, sprint: false, throwAt: null });
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
