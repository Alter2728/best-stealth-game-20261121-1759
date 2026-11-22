// The Nightjar renderer: paints the museum from above on a 2D canvas. Vision cones are
// true visibility polygons (rays clipped by walls and crates), so what is lit is what a
// guard can see and the dark behind cover reads as safe at a glance. The fixed 1280x720
// field is letterboxed into the window; toField() maps pointer positions back into it.

import { CAMERA, FIELD, FONT, GUARD, PALETTE, SCORE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_INTRO = 'intro';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_DONE = 'done';

const TILE = FIELD.tile;
const CONE_RAYS = 40;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function createRenderer(canvas, raycast) {
  const ctx = canvas.getContext('2d');
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    offsetX = (canvas.width - FIELD.width * scale) / 2;
    offsetY = (canvas.height - FIELD.height * scale) / 2;
  }
  window.addEventListener('resize', resize);
  resize();

  function toField(clientX, clientY) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    return {
      x: (clientX * dpr - offsetX) / scale,
      y: (clientY * dpr - offsetY) / scale,
    };
  }

  function drawFloor(state) {
    for (let row = 0; row < FIELD.rows; row += 1) {
      for (let col = 0; col < FIELD.cols; col += 1) {
        ctx.fillStyle = (col + row) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
        ctx.fillRect(col * TILE, row * TILE, TILE, TILE);
      }
    }
    ctx.strokeStyle = PALETTE.floorLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let col = 0; col <= FIELD.cols; col += 1) {
      ctx.moveTo(col * TILE + 0.5, 0);
      ctx.lineTo(col * TILE + 0.5, FIELD.height);
    }
    for (let row = 0; row <= FIELD.rows; row += 1) {
      ctx.moveTo(0, row * TILE + 0.5);
      ctx.lineTo(FIELD.width, row * TILE + 0.5);
    }
    ctx.stroke();
  }

  function drawCone(x, y, facing, range, halfAngle, fill, edge) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let i = 0; i <= CONE_RAYS; i += 1) {
      const angle = facing - halfAngle + (2 * halfAngle * i) / CONE_RAYS;
      const d = raycast(x, y, angle, range);
      ctx.lineTo(x + Math.cos(angle) * d, y + Math.sin(angle) * d);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function coneColors(alert, chasing) {
    if (chasing || alert >= 1) return [PALETTE.coneAlert, 'rgba(229, 83, 75, 0.55)'];
    if (alert > 0.25) return [PALETTE.coneSuspicious, 'rgba(255, 159, 67, 0.5)'];
    return [PALETTE.coneCalm, PALETTE.coneEdge];
  }

  function drawTiles(state) {
    for (let row = 0; row < FIELD.rows; row += 1) {
      for (let col = 0; col < FIELD.cols; col += 1) {
        const ch = state.grid[row][col];
        const x = col * TILE;
        const y = row * TILE;
        if (ch === '#') {
          ctx.fillStyle = PALETTE.wallFace;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = PALETTE.wallTop;
          ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 10);
          ctx.fillStyle = PALETTE.wallEdge;
          ctx.fillRect(x + 3, y + 3, TILE - 6, 3);
        } else if (ch === 'C') {
          ctx.fillStyle = PALETTE.crateDark;
          ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
          ctx.fillStyle = PALETTE.crate;
          ctx.fillRect(x + 5, y + 5, TILE - 10, TILE - 10);
          ctx.strokeStyle = PALETTE.crateDark;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(x + 5, y + 5);
          ctx.lineTo(x + TILE - 5, y + TILE - 5);
          ctx.moveTo(x + TILE - 5, y + 5);
          ctx.lineTo(x + 5, y + TILE - 5);
          ctx.stroke();
        } else if (ch === 'P') {
          ctx.fillStyle = PALETTE.plantDark;
          ctx.beginPath();
          ctx.arc(x + TILE / 2, y + TILE / 2, TILE / 2 - 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = PALETTE.plant;
          for (const [ox, oy, r] of [[-8, -6, 9], [7, -8, 8], [0, 2, 10], [-6, 8, 7], [9, 7, 7]]) {
            ctx.beginPath();
            ctx.arc(x + TILE / 2 + ox, y + TILE / 2 + oy, r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
  }

  function drawExit(state) {
    const { x, y } = state.exit;
    const open = state.gem.taken;
    ctx.fillStyle = open ? PALETTE.exit : '#3a4358';
    roundRect(ctx, x - 17, y - 17, 34, 34, 5);
    ctx.fill();
    ctx.fillStyle = open ? PALETTE.exitDark : '#2a3040';
    roundRect(ctx, x - 12, y - 12, 24, 24, 4);
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EXIT', x, y + 1);
    if (open) {
      const pulse = 0.5 + 0.5 * Math.sin(state.time * 4);
      ctx.strokeStyle = `rgba(87, 217, 119, ${0.35 + 0.4 * pulse})`;
      ctx.lineWidth = 3;
      roundRect(ctx, x - 21, y - 21, 42, 42, 7);
      ctx.stroke();
    }
  }

  function drawPickups(state) {
    for (const item of state.loot) {
      if (item.taken) continue;
      ctx.fillStyle = PALETTE.loot;
      ctx.beginPath();
      ctx.arc(item.x, item.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#a87f1f';
      ctx.font = `bold 10px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', item.x, item.y + 1);
    }
    if (!state.gem.taken) {
      const { x, y } = state.gem;
      ctx.fillStyle = '#5a4a7a';
      roundRect(ctx, x - 14, y - 6, 28, 18, 3);
      ctx.fill();
      const bob = Math.sin(state.time * 2.4) * 2;
      ctx.fillStyle = PALETTE.gem;
      ctx.beginPath();
      ctx.moveTo(x, y - 16 + bob);
      ctx.lineTo(x + 10, y - 4 + bob);
      ctx.lineTo(x, y + 6 + bob);
      ctx.lineTo(x - 10, y - 4 + bob);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.moveTo(x, y - 16 + bob);
      ctx.lineTo(x + 5, y - 9 + bob);
      ctx.lineTo(x - 5, y - 9 + bob);
      ctx.closePath();
      ctx.fill();
      const sparkle = (state.time * 1.5) % 1;
      ctx.strokeStyle = `rgba(123, 224, 255, ${0.7 * (1 - sparkle)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y - 5 + bob, 12 + sparkle * 16, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawPebbles(state) {
    for (const pebble of state.pebbles) {
      if (pebble.landed) {
        const fade = Math.max(0, 1 - pebble.age / 1.2);
        ctx.strokeStyle = `rgba(238, 241, 245, ${0.55 * fade})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pebble.x, pebble.y, 6 + pebble.age * 26, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#c8cede';
        ctx.beginPath();
        ctx.arc(pebble.x, pebble.y, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const lift = Math.sin(pebble.t * Math.PI) * 16;
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.arc(pebble.x, pebble.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e8ecf5';
        ctx.beginPath();
        ctx.arc(pebble.x, pebble.y - lift, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawGuard(guard) {
    const [fill, edge] = coneColors(guard.alert, guard.mode === 'chase');
    drawCone(guard.x, guard.y, guard.facing, GUARD.viewRange, GUARD.viewAngle / 2, fill, edge);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.arc(guard.x, guard.y + 4, GUARD.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.guard;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.guardDark;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, GUARD.radius - 5, 0, Math.PI * 2);
    ctx.fill();
    // Cap peak showing facing.
    const fx = guard.x + Math.cos(guard.facing) * (GUARD.radius - 2);
    const fy = guard.y + Math.sin(guard.facing) * (GUARD.radius - 2);
    ctx.fillStyle = PALETTE.guardCap;
    ctx.beginPath();
    ctx.arc(fx, fy, 5, 0, Math.PI * 2);
    ctx.fill();
    if (guard.alert > 0.04) {
      ctx.strokeStyle = guard.mode === 'chase' ? PALETTE.danger : '#ffb04a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, GUARD.radius + 5, -Math.PI / 2, -Math.PI / 2 + guard.alert * Math.PI * 2);
      ctx.stroke();
    }
    if (guard.mode === 'chase' || guard.alert > 0.55) {
      ctx.fillStyle = PALETTE.danger;
      ctx.font = `bold 18px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('!', guard.x, guard.y - GUARD.radius - 8);
    } else if (guard.mode === 'investigate' || guard.alert > 0.15) {
      ctx.fillStyle = '#ffb04a';
      ctx.font = `bold 16px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('?', guard.x, guard.y - GUARD.radius - 8);
    }
  }

  function drawCamera(camera) {
    const [fill, edge] = coneColors(camera.alert, false);
    drawCone(camera.x, camera.y, camera.facing, CAMERA.viewRange, CAMERA.viewAngle / 2, fill, edge);
    ctx.fillStyle = '#d7dce8';
    roundRect(ctx, camera.x - 8, camera.y - 8, 16, 16, 3);
    ctx.fill();
    ctx.fillStyle = '#39415a';
    ctx.beginPath();
    ctx.arc(camera.x + Math.cos(camera.facing) * 5, camera.y + Math.sin(camera.facing) * 5, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = camera.alert > 0.1 ? PALETTE.danger : '#57d977';
    ctx.beginPath();
    ctx.arc(camera.x, camera.y - 11, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlayer(state) {
    const p = state.player;
    const sneaking = p.stance === 'sneaking';
    const r = sneaking ? 11 : 13;
    // A soft gold glow so the burglar reads at a glance, even shrunk in a contact sheet.
    const glow = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 30);
    glow.addColorStop(0, 'rgba(255, 209, 102, 0.35)');
    glow.addColorStop(1, 'rgba(255, 209, 102, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 30, 0, Math.PI * 2);
    ctx.fill();
    if (sneaking) {
      ctx.strokeStyle = 'rgba(255, 209, 102, 0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.arc(p.x, p.y + 4, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b3350';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.player;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // Hood and gold scarf, pointing the way the burglar faces.
    const fx = p.x + Math.cos(p.facing) * (r - 4);
    const fy = p.y + Math.sin(p.facing) * (r - 4);
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(fx, fy, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.playerDark;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();
    if (state.gem.taken) {
      ctx.fillStyle = PALETTE.gem;
      ctx.beginPath();
      ctx.arc(p.x - Math.cos(p.facing) * 8, p.y - Math.sin(p.facing) * 8, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawHud(state, best) {
    ctx.fillStyle = 'rgba(8, 11, 22, 0.82)';
    ctx.fillRect(0, 0, FIELD.width, 46);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 19px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`NIGHTJAR — ${state.level.name}`, 16, 24);
    ctx.font = `15px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    const objective = state.gem.taken ? 'Reach the EXIT unseen' : 'Steal the gem, then reach the EXIT';
    ctx.fillText(objective, 16, 66);
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 17px ${FONT}`;
    ctx.fillText(`Score ${state.score + (state.cleared ? 0 : state.levelScore)}`, FIELD.width - 16, 18);
    ctx.font = `14px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`Time ${formatTime(state.time)}  ·  Best ${best}`, FIELD.width - 16, 38);

    // The detection eye: fills and reddens as the worst meter climbs.
    const alert = state.maxAlert;
    const eyeX = FIELD.width / 2;
    ctx.strokeStyle = alert > 0.6 ? PALETTE.danger : alert > 0.2 ? '#ffb04a' : PALETTE.muted;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(eyeX, 23, 26, 13, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (alert > 0.02) {
      ctx.fillStyle = alert > 0.6 ? PALETTE.danger : '#ffb04a';
      ctx.beginPath();
      ctx.arc(eyeX, 23, 3 + alert * 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(alert >= 1 ? 'SPOTTED' : alert > 0.2 ? 'seen…' : 'unseen', eyeX, 60);

    // Loot pips and stance.
    ctx.textAlign = 'left';
    ctx.font = `14px ${FONT}`;
    ctx.fillStyle = PALETTE.loot;
    const got = state.loot.filter((i) => i.taken).length;
    ctx.fillText(`Loot ${got}/${state.loot.length}${state.gem.taken ? '  ·  GEM ✓' : ''}`, 16, 88);
    ctx.fillStyle = PALETTE.muted;
    const stance = state.player.stance === 'sneaking' ? 'Sneaking' : state.player.stance === 'sprinting' ? 'Sprinting!' : 'Walking';
    ctx.fillText(`${stance}  ·  Pebble ${state.player.pebbleCooldown > 0 ? '…' : 'ready (click)'}`, 16, 108);
  }

  function panel(width, height) {
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, x, y, width, height, 14);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
    return { x, y };
  }

  function drawTitle(state, best) {
    ctx.fillStyle = 'rgba(5, 7, 16, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.player;
    ctx.font = `bold 84px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.fillText('NIGHTJAR', FIELD.width / 2, 128);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `italic 24px ${FONT}`;
    ctx.fillText('a moonlit heist in three rooms', FIELD.width / 2, 182);
    const panelW = 620;
    const panelH = 252;
    const panelX = (FIELD.width - panelW) / 2;
    const panelY = 222;
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, panelX, panelY, panelW, panelH, 14);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
    const y = panelY;
    ctx.fillStyle = PALETTE.text;
    ctx.font = `17px ${FONT}`;
    const lines = [
      'You are the Nightjar, a burglar with soft shoes and a pocket of pebbles.',
      'Steal each room\u2019s gem and reach the exit without being caught.',
      '',
      'Move — WASD or arrow keys        Sneak — hold Shift or tap C',
      'Sprint — hold Space (loud!)      Pebble — click to throw a distraction',
      'Pause — P or Esc',
      '',
      'Guards see inside their lit cones. Walls and crates block their view;',
      'crouch in the plants to vanish. A full eye means run — or hide and wait.',
    ];
    lines.forEach((line, i) => ctx.fillText(line, FIELD.width / 2, y + 36 + i * 23));
    ctx.fillStyle = PALETTE.good;
    ctx.font = `bold 21px ${FONT}`;
    ctx.fillText('Click or press Enter to slip inside', FIELD.width / 2, y + panelH + 34);
    if (best > 0) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `16px ${FONT}`;
      ctx.fillText(`Best score: ${best}`, FIELD.width / 2, y + panelH + 66);
    }
  }

  function drawIntro(state) {
    ctx.fillStyle = 'rgba(5, 7, 16, 0.45)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const { y } = panel(640, 190);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.player;
    ctx.font = `bold 34px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(`Room ${state.levelIndex + 1}: ${state.level.name}`, FIELD.width / 2, y + 48);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `17px ${FONT}`;
    ctx.fillText(state.level.brief, FIELD.width / 2, y + 92);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `15px ${FONT}`;
    ctx.fillText(`Par time ${formatTime(state.level.par)} — faster is worth more. Ghost bonus ${SCORE.ghostBonus} if never spotted.`, FIELD.width / 2, y + 122);
    ctx.fillStyle = PALETTE.good;
    ctx.font = `bold 18px ${FONT}`;
    ctx.fillText('Click or press Enter', FIELD.width / 2, y + 158);
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(5, 7, 16, 0.5)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 44px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.fillText('Paused', FIELD.width / 2, FIELD.height / 2 - 20);
    ctx.font = `17px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('P or Esc to keep sneaking', FIELD.width / 2, FIELD.height / 2 + 24);
  }

  function drawCaught(state) {
    ctx.fillStyle = 'rgba(30, 5, 8, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const { y } = panel(560, 200);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.danger;
    ctx.font = `bold 40px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.fillText('Caught!', FIELD.width / 2, y + 52);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `17px ${FONT}`;
    ctx.fillText(`A guard grabbed you in ${state.level.name}.`, FIELD.width / 2, y + 98);
    ctx.fillText('The museum keeps its gem — this time.', FIELD.width / 2, y + 124);
    ctx.fillStyle = PALETTE.good;
    ctx.font = `bold 18px ${FONT}`;
    ctx.fillText('Click or press Enter to try the room again', FIELD.width / 2, y + 162);
  }

  function drawClear(state, done) {
    ctx.fillStyle = 'rgba(5, 16, 10, 0.5)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const { y } = panel(600, 300);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.good;
    ctx.font = `bold 38px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(done ? 'The Nightjar vanishes!' : `${state.level.name} cleaned out`, FIELD.width / 2, y + 46);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `18px ${FONT}`;
    const lootGot = state.loot.filter((i) => i.taken).length;
    const rows = [
      `Gem stolen            ${SCORE.gem}`,
      `Loot ${lootGot}/${state.loot.length}              ${lootGot * SCORE.loot}`,
      `Room cleared          ${SCORE.levelClear}`,
      state.everSpotted ? `Alarms raised ×${state.alarms}       −${state.alarms * SCORE.alarmPenalty}` : `Ghost bonus (unseen)  ${SCORE.ghostBonus}`,
      `Time ${formatTime(state.time)} (par ${formatTime(state.level.par)})`,
      `Room score            ${state.levelScore}`,
      `Total score           ${state.score}`,
    ];
    rows.forEach((row, i) => ctx.fillText(row, FIELD.width / 2, y + 92 + i * 26));
    ctx.fillStyle = PALETTE.good;
    ctx.font = `bold 18px ${FONT}`;
    ctx.fillText(done ? 'Click or press Enter to play again' : 'Click or press Enter for the next room', FIELD.width / 2, y + 92 + rows.length * 26 + 10);
  }

  function draw(state, screen, best) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);

    drawFloor(state);
    // Cones first, under the furniture, so cover reads as cover.
    for (const camera of state.cameras) drawCamera(camera);
    for (const guard of state.guards) drawGuard(guard);
    drawTiles(state);
    drawExit(state);
    drawPickups(state);
    drawPebbles(state);
    drawPlayer(state);

    // A soft vignette: the edges of the museum fall into dark.
    const vignette = ctx.createRadialGradient(FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.45, FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.95);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);

    drawHud(state, best);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_INTRO) drawIntro(state);
    else if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_CAUGHT) drawCaught(state);
    else if (screen === SCREEN_CLEAR) drawClear(state, false);
    else if (screen === SCREEN_DONE) drawClear(state, true);
  }

  return { draw, toField };
}
