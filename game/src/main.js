// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between title, room intro, play, pause, caught and room-clear
// screens, three rooms in all, then the Nightjar vanishes with the night's score.
//
// ?seed=N fixes the guards' scan phases. ?shot=title|cover|play|win (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld,
  EVENT_ALARM,
  EVENT_CAUGHT,
  EVENT_CLEAR,
  EVENT_PEBBLE,
  EVENT_PICKUP,
  EVENT_SPOTTED,
  EVENT_THROW,
} from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import {
  createRenderer,
  SCREEN_CAUGHT,
  SCREEN_CLEAR,
  SCREEN_DONE,
  SCREEN_INTRO,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
} from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas, world.raycast);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function announce(text) {
  if (status) status.textContent = text;
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, renderer.toField);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let spottedCooldown = 0;

  function startRun() {
    world.state.score = 0;
    world.loadLevel(0);
    screen = SCREEN_INTRO;
    announce(`Room 1: ${world.state.level.name}. ${world.state.level.brief}`);
  }

  function playEvents(events, wasGemTaken) {
    if (events & EVENT_PICKUP) {
      if (!wasGemTaken && world.state.gem.taken) audio.gem();
      else audio.pickup();
    }
    if (events & EVENT_THROW) audio.throwPebble();
    if (events & EVENT_PEBBLE) audio.pebble();
    if ((events & EVENT_SPOTTED) && spottedCooldown <= 0) {
      audio.spotted();
      spottedCooldown = 0.8;
    }
    if (events & EVENT_ALARM) audio.alarm();
    if (events & EVENT_CAUGHT) audio.caught();
    if (events & EVENT_CLEAR) audio.clear();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    if (spottedCooldown > 0) spottedCooldown -= elapsed;

    const actions = input.takeActions();
    if (actions & (ACTION_CONFIRM | ACTION_PAUSE)) audio.unlock();

    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startRun();
    } else if (screen === SCREEN_INTRO) {
      if (actions & ACTION_CONFIRM) {
        screen = SCREEN_PLAY;
        announce('Sneak: steal the gem and reach the exit unseen.');
      }
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
      } else {
        accumulator += elapsed;
        while (accumulator >= STEP) {
          const wasGemTaken = world.state.gem.taken;
          const events = world.step(STEP, input.read());
          playEvents(events, wasGemTaken);
          accumulator -= STEP;
          if (events & EVENT_CAUGHT) {
            screen = SCREEN_CAUGHT;
            announce('Caught! Press Enter to try the room again.');
            break;
          }
          if (events & EVENT_CLEAR) {
            const lastRoom = world.state.levelIndex >= world.levelCount - 1;
            screen = lastRoom ? SCREEN_DONE : SCREEN_CLEAR;
            if (world.state.score > best) {
              best = world.state.score;
              saveBest(best);
            }
            announce(lastRoom ? 'You vanished with the night\u2019s haul.' : 'Room cleared. Press Enter for the next room.');
            break;
          }
        }
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) screen = SCREEN_PLAY;
    } else if (screen === SCREEN_CAUGHT) {
      if (actions & ACTION_CONFIRM) {
        world.loadLevel(world.state.levelIndex);
        screen = SCREEN_INTRO;
      }
    } else if (screen === SCREEN_CLEAR) {
      if (actions & ACTION_CONFIRM) {
        world.loadLevel(world.state.levelIndex + 1);
        screen = SCREEN_INTRO;
        announce(`Room ${world.state.levelIndex + 1}: ${world.state.level.name}. ${world.state.level.brief}`);
      }
    } else if (screen === SCREEN_DONE) {
      if (actions & ACTION_CONFIRM) startRun();
    }

    renderer.draw(world.state, screen, best);
  }

  announce('Nightjar: a moonlit heist. Click or press Enter to slip inside.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
