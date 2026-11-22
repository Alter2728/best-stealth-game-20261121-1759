// The Nightjar simulation: the burglar, the guards and their vision cones, the cameras,
// thrown pebbles, and the detection system. Pure rules, no drawing: the renderer paints
// what is here, and the screenshot autopilot plays it with the same step() a player gets.

import { CAMERA, FIELD, GUARD, PLAYER, SCORE, VISIBILITY } from './config.js';
import { LEVELS, SOLID, parseLevel } from './levels.js';

export const EVENT_NONE = 0;
export const EVENT_PICKUP = 1; // loot or the gem was taken
export const EVENT_SPOTTED = 2; // a detection meter started filling this step
export const EVENT_ALARM = 4; // a guard or camera reached full alert
export const EVENT_CAUGHT = 8; // a chasing guard reached the player
export const EVENT_CLEAR = 16; // the player reached the exit with the gem
export const EVENT_PEBBLE = 32; // a pebble landed and made its noise
export const EVENT_THROW = 64; // a pebble was thrown

const TILE = FIELD.tile;

function tileCenter(col, row) {
  return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
}

function angleDifference(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function turnToward(current, target, maxStep) {
  const d = angleDifference(target, current);
  if (Math.abs(d) <= maxStep) return target;
  return current + Math.sign(d) * maxStep;
}

export function createWorld(random) {
  const state = {
    levelIndex: 0,
    level: null,
    grid: [],
    time: 0,
    player: { x: 0, y: 0, facing: 0, stance: 'standing', moving: false, pebbleCooldown: 0 },
    guards: [],
    cameras: [],
    pebbles: [],
    gem: { x: 0, y: 0, taken: false },
    exit: { x: 0, y: 0 },
    loot: [],
    score: 0,
    levelScore: 0,
    alarms: 0,
    everSpotted: false,
    caught: false,
    cleared: false,
    maxAlert: 0, // the highest detection meter right now, for the HUD eye
  };

  function solidAt(x, y) {
    const col = Math.floor(x / TILE);
    const row = Math.floor(y / TILE);
    if (row < 0 || row >= FIELD.rows || col < 0 || col >= FIELD.cols) return true;
    return SOLID.has(state.grid[row][col]);
  }

  function tileAt(x, y) {
    const col = Math.floor(x / TILE);
    const row = Math.floor(y / TILE);
    if (row < 0 || row >= FIELD.rows || col < 0 || col >= FIELD.cols) return '#';
    return state.grid[row][col];
  }

  /** Distance from (x, y) along `angle` to the first wall or crate, capped at maxDist. */
  function raycast(x, y, angle, maxDist) {
    const step = 6;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    for (let d = step; d <= maxDist; d += step) {
      if (solidAt(x + dx * d, y + dy * d)) return d - step / 2;
    }
    return maxDist;
  }

  /** True when (x, y) can be seen from (ox, oy) looking along `facing` inside a cone. */
  function inCone(ox, oy, facing, range, halfAngle, x, y) {
    const dx = x - ox;
    const dy = y - oy;
    const dist = Math.hypot(dx, dy);
    if (dist > range) return false;
    if (dist > 1 && Math.abs(angleDifference(Math.atan2(dy, dx), facing)) > halfAngle) return false;
    return raycast(ox, oy, Math.atan2(dy, dx), dist) >= dist - 2;
  }

  /** Move a circle by (dx, dy), sliding along walls: axis by axis, never into a solid tile. */
  function moveCircle(body, dx, dy, radius) {
    let nx = body.x + dx;
    if (!circleHits(nx, body.y, radius)) body.x = nx;
    let ny = body.y + dy;
    if (!circleHits(body.x, ny, radius)) body.y = ny;
  }

  function circleHits(x, y, radius) {
    const minCol = Math.floor((x - radius) / TILE);
    const maxCol = Math.floor((x + radius) / TILE);
    const minRow = Math.floor((y - radius) / TILE);
    const maxRow = Math.floor((y + radius) / TILE);
    for (let row = minRow; row <= maxRow; row += 1) {
      for (let col = minCol; col <= maxCol; col += 1) {
        if (row < 0 || row >= FIELD.rows || col < 0 || col >= FIELD.cols || SOLID.has(state.grid[row][col])) {
          const cx = Math.max(col * TILE, Math.min(x, col * TILE + TILE));
          const cy = Math.max(row * TILE, Math.min(y, row * TILE + TILE));
          if (Math.hypot(x - cx, y - cy) < radius) return true;
        }
      }
    }
    return false;
  }

  function playerVisibility(guard) {
    const p = state.player;
    if (tileAt(p.x, p.y) === 'P' && p.stance === 'sneaking') {
      const dist = Math.hypot(p.x - guard.x, p.y - guard.y);
      return dist < VISIBILITY.pointBlank ? VISIBILITY.sneaking : VISIBILITY.inBush;
    }
    return VISIBILITY[p.stance];
  }

  function loadLevel(index) {
    const level = LEVELS[index];
    const parsed = parseLevel(level);
    state.levelIndex = index;
    state.level = level;
    state.grid = parsed.grid;
    state.time = 0;
    state.levelScore = 0;
    state.alarms = 0;
    state.everSpotted = false;
    state.caught = false;
    state.cleared = false;
    state.maxAlert = 0;
    state.pebbles = [];
    const start = tileCenter(parsed.start.col, parsed.start.row);
    state.player = { x: start.x, y: start.y, facing: 0, stance: 'standing', moving: false, pebbleCooldown: 0 };
    const gem = tileCenter(parsed.gem.col, parsed.gem.row);
    state.gem = { x: gem.x, y: gem.y, taken: false };
    state.exit = tileCenter(parsed.exit.col, parsed.exit.row);
    state.loot = parsed.loot.map((spot) => {
      const c = tileCenter(spot.col, spot.row);
      return { x: c.x, y: c.y, taken: false };
    });
    state.guards = level.guards.map((def) => {
      const first = tileCenter(def.patrol[0][0], def.patrol[0][1]);
      return {
        x: first.x,
        y: first.y,
        facing: 0,
        patrol: def.patrol.map(([c, r]) => tileCenter(c, r)),
        waypoint: 1 % def.patrol.length,
        mode: 'patrol', // patrol | investigate | chase | return
        alert: 0,
        pause: 0,
        scanPhase: random() * Math.PI * 2,
        lastSeen: null,
        memory: 0,
        target: null,
      };
    });
    state.cameras = level.cameras.map((def) => {
      const c = tileCenter(def.at[0], def.at[1]);
      return { x: c.x, y: c.y, rest: def.dir, facing: def.dir, alert: 0, phase: random() * Math.PI * 2 };
    });
  }

  function guardSeesPlayer(guard) {
    const p = state.player;
    return inCone(guard.x, guard.y, guard.facing, GUARD.viewRange, GUARD.viewAngle / 2, p.x, p.y);
  }

  function cameraSeesPlayer(camera) {
    const p = state.player;
    if (tileAt(p.x, p.y) === 'P' && p.stance === 'sneaking') return false;
    return inCone(camera.x, camera.y, camera.facing, CAMERA.viewRange, CAMERA.viewAngle / 2, p.x, p.y);
  }

  function walkToward(guard, target, speed, dt) {
    const dx = target.x - guard.x;
    const dy = target.y - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) return true;
    const heading = Math.atan2(dy, dx);
    guard.facing = turnToward(guard.facing, heading, GUARD.turnRate * dt);
    const stepLen = Math.min(dist, speed * dt);
    moveCircle(guard, Math.cos(heading) * stepLen, Math.sin(heading) * stepLen, GUARD.radius);
    return dist - stepLen < 4;
  }

  function stepGuard(guard, dt, events) {
    const p = state.player;
    const sees = guardSeesPlayer(guard);
    if (sees) {
      const dist = Math.hypot(p.x - guard.x, p.y - guard.y);
      const closeness = 1 - Math.min(1, dist / GUARD.viewRange);
      const fill = (GUARD.alertFillFar + (GUARD.alertFillNear - GUARD.alertFillFar) * closeness) * playerVisibility(guard);
      if (guard.alert === 0 && fill > 0) events.value |= EVENT_SPOTTED;
      guard.alert = Math.min(1, guard.alert + fill * dt);
      guard.lastSeen = { x: p.x, y: p.y };
      guard.memory = GUARD.chaseMemory;
      if (guard.alert >= 1 && guard.mode !== 'chase') {
        guard.mode = 'chase';
        state.alarms += 1;
        state.everSpotted = true;
        events.value |= EVENT_ALARM;
      }
    } else {
      guard.alert = Math.max(0, guard.alert - GUARD.alertDecay * dt);
      if (guard.memory > 0) guard.memory -= dt;
    }

    if (guard.mode === 'chase') {
      const target = sees ? p : guard.lastSeen;
      if (target) walkToward(guard, target, GUARD.chaseSpeed, dt);
      if (!sees && guard.memory <= 0) {
        guard.mode = 'investigate';
        guard.target = guard.lastSeen;
        guard.pause = GUARD.lookAround;
      }
      if (Math.hypot(p.x - guard.x, p.y - guard.y) < PLAYER.catchRadius && sees) {
        state.caught = true;
        events.value |= EVENT_CAUGHT;
      }
      return;
    }

    if (guard.mode === 'investigate') {
      if (guard.target && walkToward(guard, guard.target, GUARD.investigateSpeed, dt)) {
        guard.pause -= dt;
        guard.facing += Math.sin(state.time * 1.7 + guard.scanPhase) * 1.4 * dt;
        if (guard.pause <= 0) {
          guard.mode = 'return';
          guard.target = null;
        }
      }
      return;
    }

    if (guard.mode === 'return') {
      // Head back to the nearest patrol waypoint, then resume the loop.
      let nearest = 0;
      let best = Infinity;
      guard.patrol.forEach((wp, i) => {
        const d = Math.hypot(wp.x - guard.x, wp.y - guard.y);
        if (d < best) { best = d; nearest = i; }
      });
      if (walkToward(guard, guard.patrol[nearest], GUARD.investigateSpeed, dt)) {
        guard.waypoint = (nearest + 1) % guard.patrol.length;
        guard.mode = 'patrol';
      }
      return;
    }

    // Patrol: walk the loop, pausing at each waypoint to scan the room.
    if (guard.pause > 0) {
      guard.pause -= dt;
      guard.facing += Math.sin(state.time * 1.3 + guard.scanPhase) * 1.1 * dt;
      return;
    }
    const wp = guard.patrol[guard.waypoint];
    if (walkToward(guard, wp, GUARD.patrolSpeed, dt)) {
      guard.waypoint = (guard.waypoint + 1) % guard.patrol.length;
      guard.pause = GUARD.lookAround;
    }
  }

  function stepCamera(camera, dt, events) {
    camera.facing = camera.rest + Math.sin((state.time / CAMERA.sweepPeriod) * Math.PI * 2 + camera.phase) * CAMERA.sweepAngle;
    if (cameraSeesPlayer(camera)) {
      if (camera.alert === 0) events.value |= EVENT_SPOTTED;
      camera.alert = Math.min(1, camera.alert + CAMERA.alertFill * VISIBILITY[state.player.stance] * dt);
      if (camera.alert >= 1) {
        camera.alert = 0;
        state.alarms += 1;
        state.everSpotted = true;
        events.value |= EVENT_ALARM;
        for (const guard of state.guards) {
          if (guard.mode === 'patrol' || guard.mode === 'return') {
            guard.mode = 'investigate';
            guard.target = { x: state.player.x, y: state.player.y };
            guard.pause = GUARD.lookAround;
          }
        }
      }
    } else {
      camera.alert = Math.max(0, camera.alert - CAMERA.alertDecay * dt);
    }
  }

  function stepPebbles(dt, events) {
    for (const pebble of state.pebbles) {
      if (pebble.landed) continue;
      pebble.t += dt / pebble.flight;
      if (pebble.t >= 1) {
        pebble.t = 1;
        pebble.landed = true;
        pebble.age = 0;
        events.value |= EVENT_PEBBLE;
        for (const guard of state.guards) {
          if (guard.mode === 'chase') continue;
          if (Math.hypot(pebble.x - guard.x, pebble.y - guard.y) < GUARD.hearRadius) {
            guard.mode = 'investigate';
            guard.target = { x: pebble.x, y: pebble.y };
            guard.pause = GUARD.lookAround;
          }
        }
      } else {
        pebble.x = pebble.fromX + (pebble.toX - pebble.fromX) * pebble.t;
        pebble.y = pebble.fromY + (pebble.toY - pebble.fromY) * pebble.t;
      }
    }
    for (const pebble of state.pebbles) if (pebble.landed) pebble.age += dt;
    state.pebbles = state.pebbles.filter((pebble) => !pebble.landed || pebble.age < 4);
  }

  /**
   * Advance the world one fixed step. `input` is { moveX, moveY, sneak, sprint, throwAt }
   * with move components in -1..1 and throwAt a field point or null. Returns event flags.
   */
  function step(dt, input) {
    const events = { value: EVENT_NONE };
    if (state.caught || state.cleared) return events.value;
    state.time += dt;
    const p = state.player;

    // The burglar.
    p.stance = input.sneak ? 'sneaking' : input.sprint ? 'sprinting' : 'standing';
    const speed = input.sneak ? PLAYER.sneakSpeed : input.sprint ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const len = Math.hypot(input.moveX, input.moveY);
    p.moving = len > 0.01;
    if (p.moving) {
      const nx = input.moveX / Math.max(1, len);
      const ny = input.moveY / Math.max(1, len);
      p.facing = Math.atan2(ny, nx);
      moveCircle(p, nx * speed * dt, ny * speed * dt, PLAYER.radius);
      if (p.stance === 'sprinting') {
        for (const guard of state.guards) {
          if (guard.mode === 'patrol' && Math.hypot(p.x - guard.x, p.y - guard.y) < GUARD.noiseRadiusSprint) {
            guard.mode = 'investigate';
            guard.target = { x: p.x, y: p.y };
            guard.pause = GUARD.lookAround;
          }
        }
      }
    }
    if (p.pebbleCooldown > 0) p.pebbleCooldown -= dt;
    if (input.throwAt && p.pebbleCooldown <= 0) {
      const dx = input.throwAt.x - p.x;
      const dy = input.throwAt.y - p.y;
      const dist = Math.hypot(dx, dy);
      const reach = Math.min(dist, PLAYER.pebbleRange);
      const tx = dist > 0 ? p.x + (dx / dist) * reach : p.x;
      const ty = dist > 0 ? p.y + (dy / dist) * reach : p.y;
      state.pebbles.push({ fromX: p.x, fromY: p.y, toX: tx, toY: ty, x: p.x, y: p.y, t: 0, flight: 0.35 + reach / 900, landed: false, age: 0 });
      p.pebbleCooldown = PLAYER.pebbleCooldown;
      events.value |= EVENT_THROW;
    }

    // Pickups and the exit.
    if (!state.gem.taken && Math.hypot(p.x - state.gem.x, p.y - state.gem.y) < 24) {
      state.gem.taken = true;
      state.levelScore += SCORE.gem;
      events.value |= EVENT_PICKUP;
    }
    for (const item of state.loot) {
      if (!item.taken && Math.hypot(p.x - item.x, p.y - item.y) < 22) {
        item.taken = true;
        state.levelScore += SCORE.loot;
        events.value |= EVENT_PICKUP;
      }
    }
    if (state.gem.taken && Math.hypot(p.x - state.exit.x, p.y - state.exit.y) < 26) {
      state.cleared = true;
      state.levelScore += SCORE.levelClear;
      if (!state.everSpotted) state.levelScore += SCORE.ghostBonus;
      state.levelScore -= state.alarms * SCORE.alarmPenalty;
      const underPar = Math.max(0, state.level.par - Math.floor(state.time));
      state.levelScore += underPar * SCORE.timeBonusPerSecond;
      state.levelScore = Math.max(0, state.levelScore);
      state.score += state.levelScore;
      events.value |= EVENT_CLEAR;
    }

    stepPebbles(dt, events);
    for (const guard of state.guards) stepGuard(guard, dt, events);
    for (const camera of state.cameras) stepCamera(camera, dt, events);

    state.maxAlert = 0;
    for (const guard of state.guards) state.maxAlert = Math.max(state.maxAlert, guard.alert);
    for (const camera of state.cameras) state.maxAlert = Math.max(state.maxAlert, camera.alert);
    return events.value;
  }

  loadLevel(0);

  return {
    state,
    loadLevel,
    step,
    raycast,
    solidAt,
    tileAt,
    guardSeesPlayer,
    cameraSeesPlayer,
    levelCount: LEVELS.length,
  };
}
