// Rendering: everything the player sees, drawn on one canvas.
// Layout helpers (uiLayout) are shared with input.js so clicks land
// exactly on the buttons drawn here.
import { VIEW, HUD_H, SHOP_Y, PATH, HEART, PLOTS, TOWERS, TOWER_ORDER, ENEMIES, TOTAL_WAVES, MAX_LEVEL, WAVES, HARMONY_RADIUS, HARMONY_BONUS } from './config.js';
import { SCREEN, towerAt } from './state.js';
import { towerStats, hasHarmony, harmonyDamage } from './towers.js';
import { upgradeCost, sellValue } from './config.js';
import { isMuted } from './audio.js';
import { mulberry32 } from './rng.js';

const stars = [];
{
  const rnd = mulberry32(20261116);
  for (let i = 0; i < 90; i += 1) {
    stars.push({ x: rnd() * VIEW.width, y: rnd() * (SHOP_Y - 40), r: 0.6 + rnd() * 1.6, tw: rnd() * Math.PI * 2 });
  }
}
const tufts = [];
{
  const rnd = mulberry32(77);
  for (let i = 0; i < 46; i += 1) {
    tufts.push({ x: rnd() * VIEW.width, y: HUD_H + 20 + rnd() * (SHOP_Y - HUD_H - 40), s: 0.7 + rnd() * 0.9, hue: rnd() });
  }
}
// Glowing mushrooms and night flowers, seeded off the path so they
// never cover the road. They fill the empty garden with living light.
const shrooms = [];
{
  const rnd = mulberry32(5150);
  const caps = ['#7dd7ff', '#ff9ecf', '#b9a7ff', '#8ef7c1'];
  for (let i = 0; i < 12; i += 1) {
    const x = 40 + rnd() * (VIEW.width - 80);
    const y = HUD_H + 40 + rnd() * (SHOP_Y - HUD_H - 80);
    if (nearPath(x, y, 52)) continue;
    shrooms.push({ x: x, y: y, r: 5 + rnd() * 5, cap: caps[Math.floor(rnd() * caps.length)], ph: rnd() * Math.PI * 2 });
  }
}
const blooms = [];
{
  const rnd = mulberry32(90210);
  const petals = ['#ff9ecf', '#c9a7ff', '#ffd76b', '#ff8fb0'];
  for (let i = 0; i < 10; i += 1) {
    const x = 40 + rnd() * (VIEW.width - 80);
    const y = HUD_H + 40 + rnd() * (SHOP_Y - HUD_H - 80);
    if (nearPath(x, y, 58)) continue;
    blooms.push({ x: x, y: y, r: 5 + rnd() * 4, col: petals[Math.floor(rnd() * petals.length)], ph: rnd() * Math.PI * 2 });
  }
}
function nearPath(x, y, pad) {
  for (let i = 0; i < PATH.length - 1; i += 1) {
    const a = PATH[i], b = PATH[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : ((x - a.x) * dx + (y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + dx * t, py = a.y + dy * t;
    if (Math.hypot(x - px, y - py) < pad) return true;
  }
  return false;
}

export function uiLayout(game) {
  const cards = TOWER_ORDER.map(function (kind, i) {
    return { kind: kind, x: 24 + i * 250, y: SHOP_Y + 12, w: 238, h: 96 };
  });
  const panel = { x: 800, y: SHOP_Y + 12, w: 456, h: 96 };
  return {
    startBtn: { x: 1010, y: 12, w: 150, h: 40 },
    speedBtn: { x: 900, y: 12, w: 100, h: 40 },
    pauseBtn: { x: 830, y: 12, w: 60, h: 40 },
    soundBtn: { x: 1170, y: 12, w: 86, h: 40 },
    cards: cards,
    panel: panel,
    upgradeBtn: { x: 1064, y: SHOP_Y + 22, w: 96, h: 34 },
    sellBtn: { x: 1064, y: SHOP_Y + 64, w: 96, h: 34 },
    closeBtn: { x: 1220, y: SHOP_Y + 18, w: 28, h: 28 },
    titleBtn: { x: 490, y: 520, w: 300, h: 64 },
    againBtn: { x: 490, y: 520, w: 300, h: 64 },
    resumeBtn: { x: 490, y: 430, w: 300, h: 64 },
  };
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBackground(ctx, game) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  g.addColorStop(0, '#102a3d');
  g.addColorStop(0.55, '#153b2f');
  g.addColorStop(1, '#0e2f26');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  // A soft warm heart in the middle of the garden so the field never
  // reads as a black hole, even on the darkest wave.
  const heart = ctx.createRadialGradient(640, 330, 40, 640, 330, 520);
  heart.addColorStop(0, 'rgba(255, 190, 90, 0.07)');
  heart.addColorStop(1, 'rgba(255, 190, 90, 0)');
  ctx.fillStyle = heart;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  // Moonlight from the top-left, a cool counterweight to the warm heart.
  const moon = ctx.createRadialGradient(150, 40, 10, 150, 40, 420);
  moon.addColorStop(0, 'rgba(180, 210, 255, 0.10)');
  moon.addColorStop(1, 'rgba(180, 210, 255, 0)');
  ctx.fillStyle = moon;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  // Stars, gently twinkling.
  for (let i = 0; i < stars.length; i += 1) {
    const s = stars[i];
    const a = 0.45 + 0.4 * Math.sin(game.time * 1.5 + s.tw);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#cfe8ff';
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Glowing mushrooms: a soft halo, a pale stem, a coloured cap.
  for (let i = 0; i < shrooms.length; i += 1) {
    const m = shrooms[i];
    const pulse = 0.55 + 0.25 * Math.sin(game.time * 1.8 + m.ph);
    ctx.globalAlpha = pulse * 0.35;
    ctx.fillStyle = m.cap;
    ctx.beginPath(); ctx.arc(m.x, m.y - 4, m.r * 2.1, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#e8f5ee';
    ctx.fillRect(m.x - 1.5, m.y - 4, 3, 7);
    ctx.fillStyle = m.cap;
    ctx.beginPath(); ctx.arc(m.x, m.y - 5, m.r, Math.PI, 0); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.arc(m.x - m.r * 0.35, m.y - 5 - m.r * 0.4, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(m.x + m.r * 0.3, m.y - 5 - m.r * 0.2, 1, 0, Math.PI * 2); ctx.fill();
  }
  // Night flowers: five glowing petals around a bright heart.
  for (let i = 0; i < blooms.length; i += 1) {
    const b = blooms[i];
    const pulse = 0.6 + 0.3 * Math.sin(game.time * 2.2 + b.ph);
    ctx.globalAlpha = pulse * 0.3;
    ctx.fillStyle = b.col;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = pulse;
    for (let p = 0; p < 5; p += 1) {
      const a = (p / 5) * Math.PI * 2 + b.ph;
      ctx.beginPath(); ctx.arc(b.x + Math.cos(a) * b.r * 0.75, b.y + Math.sin(a) * b.r * 0.75, b.r * 0.55, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#fff8dc';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.35, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Grass tufts and tiny night flowers, kept off the path.
  for (let i = 0; i < tufts.length; i += 1) {
    const t = tufts[i];
    ctx.strokeStyle = t.hue > 0.85 ? '#ff9ecf' : '#3f9c66';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(t.x, t.y);
    ctx.lineTo(t.x - 4 * t.s, t.y - 9 * t.s);
    ctx.moveTo(t.x, t.y);
    ctx.lineTo(t.x + 4 * t.s, t.y - 10 * t.s);
    ctx.moveTo(t.x, t.y);
    ctx.lineTo(t.x, t.y - 11 * t.s);
    ctx.stroke();
  }
  // Drifting fireflies, each with a soft halo and a faint trail so they
  // read as living light, not static dots.
  for (let i = 0; i < 26; i += 1) {
    const fx = (i * 173 + game.time * (12 + i * 2)) % VIEW.width;
    const fy = HUD_H + 30 + ((i * 97) % (SHOP_Y - HUD_H - 60)) + Math.sin(game.time + i) * 8;
    const fa = 0.5 + 0.3 * Math.sin(game.time * 2 + i * 2);
    const tx = (i * 173 + (game.time - 0.35) * (12 + i * 2)) % VIEW.width;
    ctx.globalAlpha = fa * 0.22;
    ctx.strokeStyle = '#ffe9a3';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(tx, fy + Math.sin(game.time - 0.35 + i) * 8); ctx.lineTo(fx, fy); ctx.stroke();
    ctx.globalAlpha = fa * 0.3;
    ctx.fillStyle = '#ffe9a3';
    ctx.beginPath(); ctx.arc(fx, fy, 9, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = fa;
    ctx.beginPath(); ctx.arc(fx, fy, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(fx, fy, 1.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPath(ctx, game) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Dark edge first, so the road has a crisp border against the grass.
  ctx.strokeStyle = '#2e2118';
  ctx.lineWidth = 62;
  ctx.beginPath();
  ctx.moveTo(PATH[0].x, PATH[0].y);
  for (let i = 1; i < PATH.length; i += 1) ctx.lineTo(PATH[i].x, PATH[i].y);
  ctx.stroke();
  // Cobble bed.
  ctx.strokeStyle = '#4a3b2d';
  ctx.lineWidth = 56;
  ctx.beginPath();
  ctx.moveTo(PATH[0].x, PATH[0].y);
  for (let i = 1; i < PATH.length; i += 1) ctx.lineTo(PATH[i].x, PATH[i].y);
  ctx.stroke();
  ctx.strokeStyle = '#7a6547';
  ctx.lineWidth = 46;
  ctx.beginPath();
  ctx.moveTo(PATH[0].x, PATH[0].y);
  for (let i = 1; i < PATH.length; i += 1) ctx.lineTo(PATH[i].x, PATH[i].y);
  ctx.stroke();
  // Worn centre line: a pale dashed thread down the middle of the road.
  ctx.strokeStyle = 'rgba(255, 235, 190, 0.28)';
  ctx.lineWidth = 3;
  ctx.setLineDash([16, 14]);
  ctx.beginPath();
  ctx.moveTo(PATH[0].x, PATH[0].y);
  for (let i = 1; i < PATH.length; i += 1) ctx.lineTo(PATH[i].x, PATH[i].y);
  ctx.stroke();
  ctx.setLineDash([]);
  // Cobble stones: seeded dots along the path so the road is not flat mud.
  const stoneRnd = mulberry32(4242);
  for (let i = 0; i < 72; i += 1) {
    const p = pointOnPath(stoneRnd() * 2050);
    const px = p.x + (stoneRnd() - 0.5) * 34;
    const py = p.y + (stoneRnd() - 0.5) * 20;
    ctx.fillStyle = stoneRnd() > 0.5 ? 'rgba(0,0,0,0.28)' : 'rgba(255, 240, 200, 0.10)';
    ctx.beginPath(); ctx.arc(px, py, 2 + stoneRnd() * 2, 0, Math.PI * 2); ctx.fill();
  }
  // Direction chevrons along the path.
  ctx.fillStyle = 'rgba(255, 215, 107, 0.65)';
  const chevrons = [120, 420, 700, 980, 1250, 1520, 1790, 2050];
  for (let i = 0; i < chevrons.length; i += 1) {
    const d = chevrons[i];
    const p = pointOnPath(d);
    const q = pointOnPath(d + 14);
    const ang = Math.atan2(q.y - p.y, q.x - p.x);
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(8, 0); ctx.lineTo(-6, -8); ctx.lineTo(-6, 8); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // West gate: a pulsing violet glow while a wave is still spawning.
  if (game && game.waveActive && game.spawnQueue.length > 0) {
    const pulse = 0.3 + 0.2 * Math.sin(game.time * 4);
    const gate = ctx.createRadialGradient(8, 150, 2, 8, 150, 46);
    gate.addColorStop(0, 'rgba(185, 167, 255, ' + pulse + ')');
    gate.addColorStop(1, 'rgba(185, 167, 255, 0)');
    ctx.fillStyle = gate;
    ctx.beginPath(); ctx.arc(8, 150, 46, 0, Math.PI * 2); ctx.fill();
  }
}

function pointOnPath(dist) {
  let remaining = dist;
  for (let i = 0; i < PATH.length - 1; i += 1) {
    const a = PATH[i], b = PATH[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= len) {
      const t = remaining / len;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    remaining -= len;
  }
  return { x: PATH[PATH.length - 1].x, y: PATH[PATH.length - 1].y };
}

function drawHeartLantern(ctx, game) {
  const pulse = 1 + 0.06 * Math.sin(game.time * 2.4);
  // Beacon beam: the Heart Lantern is the lighthouse of the garden.
  const beam = ctx.createLinearGradient(0, HUD_H, 0, HEART.y - 10);
  beam.addColorStop(0, 'rgba(255, 200, 100, 0)');
  beam.addColorStop(1, 'rgba(255, 200, 100, 0.28)');
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(HEART.x - 30, HEART.y - 10);
  ctx.lineTo(HEART.x - 10, HUD_H);
  ctx.lineTo(HEART.x + 10, HUD_H);
  ctx.lineTo(HEART.x + 30, HEART.y - 10);
  ctx.closePath(); ctx.fill();
  // Outer halo, then the bright core glow.
  const halo = ctx.createRadialGradient(HEART.x, HEART.y, 20, HEART.x, HEART.y, 190 * pulse);
  halo.addColorStop(0, 'rgba(255, 190, 80, 0.22)');
  halo.addColorStop(1, 'rgba(255, 190, 80, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(HEART.x, HEART.y, 190 * pulse, 0, Math.PI * 2); ctx.fill();
  const glow = ctx.createRadialGradient(HEART.x, HEART.y, 4, HEART.x, HEART.y, 120 * pulse);
  glow.addColorStop(0, 'rgba(255, 190, 80, 0.70)');
  glow.addColorStop(1, 'rgba(255, 190, 80, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(HEART.x, HEART.y, 120 * pulse, 0, Math.PI * 2); ctx.fill();
  // Post and lamp.
  ctx.fillStyle = '#5a4632';
  ctx.fillRect(HEART.x - 6, HEART.y + 6, 12, 34);
  ctx.fillStyle = '#ffd76b';
  ctx.beginPath(); ctx.arc(HEART.x, HEART.y - 6, 24 * pulse, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff9d2e';
  ctx.beginPath(); ctx.arc(HEART.x, HEART.y - 6, 15 * pulse, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath(); ctx.arc(HEART.x, HEART.y - 8, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd76b';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  // Clamp the label so its last letter never runs off the canvas edge.
  ctx.fillText('HEART LANTERN', Math.min(HEART.x, VIEW.width - 70), HEART.y + 58);
}

function drawPlots(ctx, game) {
  for (let i = 0; i < PLOTS.length; i += 1) {
    const p = PLOTS[i];
    const tower = towerAt(game, i);
    const hover = game.hoverPlot === i && !tower;
    // Idle breath: empty plots glow faintly in turn, inviting a build.
    if (!tower && !hover) {
      const breath = 0.10 + 0.08 * Math.sin(game.time * 1.6 + i * 1.1);
      ctx.fillStyle = 'rgba(160, 220, 180, ' + breath + ')';
      ctx.beginPath(); ctx.arc(p.x, p.y, 30, 0, Math.PI * 2); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(p.x, p.y, 24, 0, Math.PI * 2);
    ctx.fillStyle = hover ? 'rgba(255, 215, 107, 0.35)' : 'rgba(20, 50, 38, 0.85)';
    ctx.fill();
    ctx.lineWidth = hover ? 3 : 2;
    ctx.strokeStyle = hover ? '#ffd76b' : 'rgba(160, 220, 180, 0.70)';
    ctx.stroke();
    if (!tower) {
      ctx.strokeStyle = 'rgba(220, 255, 230, 0.7)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(p.x - 7, p.y); ctx.lineTo(p.x + 7, p.y);
      ctx.moveTo(p.x, p.y - 7); ctx.lineTo(p.x, p.y + 7);
      ctx.stroke();
    }
  }
  // Harmony links: a gold thread between different-kind towers
  // standing close enough to harmonize, so the bonus is visible.
  ctx.strokeStyle = 'rgba(255, 215, 107, 0.65)';
  ctx.lineWidth = 3;
  for (let i = 0; i < game.towers.length; i += 1) {
    for (let j = i + 1; j < game.towers.length; j += 1) {
      const a = game.towers[i], b = game.towers[j];
      if (a.kind === b.kind) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) > HARMONY_RADIUS) continue;
      ctx.beginPath(); ctx.moveTo(a.x, a.y - 14); ctx.lineTo(b.x, b.y - 14); ctx.stroke();
    }
  }
  // Range ring of the selected tower.
  if (game.selectedTower) {
    const t = game.selectedTower;
    const stats = towerStats(t.kind, t.level);
    ctx.beginPath(); ctx.arc(t.x, t.y, stats.range, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 215, 107, 0.08)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 215, 107, 0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // Range preview: hovering an empty plot with a lantern picked shows
  // what that lantern would cover before the gold is spent.
  if (game.hoverPlot >= 0 && !towerAt(game, game.hoverPlot) && !game.selectedTower) {
    const p = PLOTS[game.hoverPlot];
    const range = TOWERS[game.selectedKind].range;
    ctx.beginPath(); ctx.arc(p.x, p.y, range, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 215, 107, 0.06)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 215, 107, 0.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawTowers(ctx, game) {
  for (let i = 0; i < game.towers.length; i += 1) {
    const t = game.towers[i];
    const def = TOWERS[t.kind];
    const selected = game.selectedTower === t;
    // Glow in two layers: a wide soft wash, then a tight bright core,
    // plus a warm pool of light on the ground so each lantern owns its
    // patch of garden. The flame flickers like a real lantern.
    const glow = ctx.createRadialGradient(t.x, t.y - 14, 2, t.x, t.y - 14, 62);
    glow.addColorStop(0, def.glow);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.55 + 0.12 * Math.sin(game.time * 3 + i * 1.7);
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(t.x, t.y - 14, 62, 0, Math.PI * 2); ctx.fill();
    const core = ctx.createRadialGradient(t.x, t.y - 14, 1, t.x, t.y - 14, 26);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.45, def.glow);
    core.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.5 + 0.15 * Math.sin(game.time * 5 + i * 2.3);
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(t.x, t.y - 14, 26, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = def.glow;
    ctx.beginPath(); ctx.ellipse(t.x, t.y + 16, 38, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // Post and base.
    ctx.fillStyle = '#4a3826';
    ctx.fillRect(t.x - 4, t.y - 6, 8, 22);
    ctx.fillRect(t.x - 10, t.y + 14, 20, 5);
    // Lamp body: a real lantern, cap on top and bright glass.
    ctx.fillStyle = '#3a2b1c';
    ctx.beginPath(); ctx.arc(t.x, t.y - 30, 9, Math.PI, 0); ctx.fill();
    ctx.fillRect(t.x - 9, t.y - 31, 18, 4);
    ctx.fillStyle = def.color;
    ctx.beginPath(); ctx.arc(t.x, t.y - 14, 19, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff8dc';
    ctx.beginPath(); ctx.arc(t.x, t.y - 15, 9, 0, Math.PI * 2); ctx.fill();
    // Flame: a bright dot that wobbles inside the glass.
    const fw = Math.sin(game.time * 7 + i * 3.1) * 2.5;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(t.x + fw, t.y - 15 + Math.sin(game.time * 9 + i) * 1.5, 3.2, 0, Math.PI * 2); ctx.fill();
    // Aim tick.
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(t.x, t.y - 14);
    ctx.lineTo(t.x + Math.cos(t.angle) * 24, t.y - 14 + Math.sin(t.angle) * 24);
    ctx.stroke();
    // Level pips.
    for (let l = 0; l < t.level; l += 1) {
      ctx.fillStyle = '#ffd76b';
      ctx.beginPath(); ctx.arc(t.x - 10 + l * 10, t.y + 22, 4, 0, Math.PI * 2); ctx.fill();
    }
    if (selected) {
      ctx.strokeStyle = '#ffd76b';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(t.x, t.y - 4, 34, 0, Math.PI * 2); ctx.stroke();
    }
    if (t.flash > 0) {
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(t.x + Math.cos(t.angle) * 26, t.y - 14 + Math.sin(t.angle) * 26, 6, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

function drawEnemies(ctx, game) {
  for (let i = 0; i < game.enemies.length; i += 1) {
    const e = game.enemies[i];
    const def = ENEMIES[e.kind];
    const slowed = game.time < e.slowUntil;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.ellipse(e.x, e.y + def.radius * 0.8, def.radius, def.radius * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    if (e.kind === "moth") {
      const flap = Math.sin(e.wobble * 2) * 0.5;
      ctx.fillStyle = def.color;
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(flap * 0.4);
      ctx.beginPath(); ctx.ellipse(-11, -5, 13, 7.5, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(11, -5, 13, 7.5, 0.5, 0, Math.PI * 2); ctx.fill();
      // Rim light: a pale edge so the wings read against the dark grass.
      ctx.strokeStyle = 'rgba(230, 220, 255, 0.75)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(-11, -5, 13, 7.5, -0.5, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(11, -5, 13, 7.5, 0.5, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = "#3a2b52";
      ctx.beginPath(); ctx.ellipse(e.x, e.y, 6, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffe9a3";
      ctx.beginPath(); ctx.arc(e.x - 3, e.y - 3, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(e.x + 3, e.y - 3, 1.8, 0, Math.PI * 2); ctx.fill();
    } else if (e.kind === "wisp") {
      const glow = ctx.createRadialGradient(e.x, e.y, 1, e.x, e.y, 28);
      glow.addColorStop(0, def.color); glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(e.x, e.y, 28, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#eafff3";
      ctx.beginPath(); ctx.arc(e.x, e.y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(e.x, e.y, 2.5, 0, Math.PI * 2); ctx.fill();
    } else if (e.kind === "beetle") {
      ctx.fillStyle = def.color;
      ctx.beginPath(); ctx.arc(e.x, e.y, def.radius, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#7a3b12";
      ctx.beginPath(); ctx.arc(e.x, e.y - 4, def.radius * 0.55, 0, Math.PI * 2); ctx.fill();
      // Top highlight: a pale arc so the shell has a round, glossy read.
      ctx.strokeStyle = 'rgba(255, 220, 180, 0.6)';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(e.x, e.y, def.radius - 3, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      ctx.strokeStyle = "#ffd76b"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(e.x - 6, e.y - def.radius); ctx.lineTo(e.x - 12, e.y - def.radius - 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(e.x + 6, e.y - def.radius); ctx.lineTo(e.x + 12, e.y - def.radius - 8); ctx.stroke();
    } else if (e.kind === "boss") {
      // The Moth Queen: wide purple wings, a gold crown, glowing eyes.
      // Two aura layers: a wide soft wash plus a pulsing ring, so she
      // dominates the field the moment she arrives.
      const aura = ctx.createRadialGradient(e.x, e.y, 4, e.x, e.y, 72);
      aura.addColorStop(0, "rgba(196, 77, 255, 0.4)");
      aura.addColorStop(1, "rgba(196, 77, 255, 0)");
      ctx.fillStyle = aura;
      ctx.beginPath(); ctx.arc(e.x, e.y, 72, 0, Math.PI * 2); ctx.fill();
      const ringPulse = 0.35 + 0.25 * Math.sin(game.time * 3);
      ctx.strokeStyle = "rgba(224, 139, 255, " + ringPulse + ")";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(e.x, e.y, 58 + Math.sin(game.time * 3) * 4, 0, Math.PI * 2); ctx.stroke();
      const flap = Math.sin(e.wobble * 2) * 0.5;
      ctx.fillStyle = def.color;
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(flap * 0.25);
      ctx.beginPath(); ctx.ellipse(-20, -6, 22, 12, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(20, -6, 22, 12, 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = "#7a1fa2";
      ctx.beginPath(); ctx.ellipse(-20, -6, 12, 6, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(20, -6, 12, 6, 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#2a0a3a";
      ctx.beginPath(); ctx.ellipse(e.x, e.y, 12, 18, 0, 0, Math.PI * 2); ctx.fill();
      // Crown: taller spikes with a bright core, so the Queen reads as royalty.
      ctx.fillStyle = "#ffe9a3";
      ctx.beginPath(); ctx.arc(e.x, e.y - 20, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffd76b";
      for (let s = -1; s <= 1; s += 1) {
        ctx.beginPath();
        ctx.moveTo(e.x + s * 10 - 6, e.y - 15);
        ctx.lineTo(e.x + s * 10, e.y - 30);
        ctx.lineTo(e.x + s * 10 + 6, e.y - 15);
        ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = "#ffe9ec";
      ctx.beginPath(); ctx.arc(e.x - 5, e.y - 4, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(e.x + 5, e.y - 4, 3, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = def.color;
      ctx.beginPath(); ctx.arc(e.x, e.y, def.radius, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#5c0f1c";
      for (let s = 0; s < 6; s += 1) {
        const a = (s / 6) * Math.PI * 2 + game.time;
        ctx.beginPath();
        ctx.moveTo(e.x + Math.cos(a) * def.radius * 0.7, e.y + Math.sin(a) * def.radius * 0.7);
        ctx.lineTo(e.x + Math.cos(a) * (def.radius + 10), e.y + Math.sin(a) * (def.radius + 10));
        ctx.lineTo(e.x + Math.cos(a + 0.4) * def.radius * 0.7, e.y + Math.sin(a + 0.4) * def.radius * 0.7);
        ctx.fill();
      }
      ctx.fillStyle = "#ffe9ec";
      ctx.beginPath(); ctx.arc(e.x - 8, e.y - 4, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(e.x + 8, e.y - 4, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    if (e.hitFlash > 0) {
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(e.x, e.y, def.radius, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (slowed) {
      ctx.strokeStyle = "#7dd7ff"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, def.radius + 4, 0, Math.PI * 2); ctx.stroke();
    }
    if (e.hp < e.maxHp) {
      const w = e.kind === "boss" ? def.radius * 2.6 : def.radius * 2;
      const barColor = e.kind === "boss" ? "#e08bff" : "#7CFC98";
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(e.x - w / 2, e.y - def.radius - 12, w, 5);
      ctx.fillStyle = barColor;
      ctx.fillRect(e.x - w / 2, e.y - def.radius - 12, w * Math.max(0, e.hp / e.maxHp), 5);
    }
  }
}

function drawProjectiles(ctx, game) {
  for (let i = 0; i < game.projectiles.length; i += 1) {
    const p = game.projectiles[i];
    // Motion trail: a short streak behind the shot.
    if (p.px !== undefined && (p.px !== p.x || p.py !== p.y)) {
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(p.px, p.py); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    const glow = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, 10);
    glow.addColorStop(0, "#ffffff"); glow.addColorStop(0.4, p.color); glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < game.particles.length; i += 1) {
    const pt = game.particles[i];
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    if (pt.ring) {
      ctx.strokeStyle = pt.color;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.stroke();
      continue;
    }
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "center";
  for (let i = 0; i < game.floats.length; i += 1) {
    const f = game.floats[i];
    ctx.globalAlpha = Math.min(1, f.life);
    ctx.fillStyle = f.color;
    // Clamp the text inside the canvas: a leak at the Heart Lantern
    // sits at x~=1300, and its "-N heart" float used to run off the
    // right edge, half-cut.
    const fx = Math.max(56, Math.min(VIEW.width - 56, f.x));
    ctx.fillText(f.text, fx, f.y);
  }
  ctx.globalAlpha = 1;
}

function drawButton(ctx, rect, label, enabled, accent) {
  ctx.beginPath();
  rr(ctx, rect.x, rect.y, rect.w, rect.h, 8);
  if (enabled) {
    const bg = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    bg.addColorStop(0, lighten(accent || "#2b6b4f"));
    bg.addColorStop(1, accent || "#2b6b4f");
    ctx.fillStyle = bg;
  } else {
    ctx.fillStyle = "#333d3a";
  }
  ctx.fill();
  ctx.strokeStyle = enabled ? "#ffd76b" : "#555";
  ctx.lineWidth = 2;
  ctx.stroke();
  if (enabled) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(rect.x + 10, rect.y + 1.5);
    ctx.lineTo(rect.x + rect.w - 10, rect.y + 1.5);
    ctx.stroke();
  }
  ctx.fillStyle = enabled ? "#fff" : "#999";
  ctx.font = "bold 16px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
  ctx.textBaseline = "alphabetic";
}
function lighten(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + 38);
  const g = Math.min(255, ((n >> 8) & 255) + 38);
  const b = Math.min(255, (n & 255) + 38);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

function drawHUD(ctx, game) {
  const ui = uiLayout(game);
  ctx.fillStyle = "#08131c";
  ctx.fillRect(0, 0, VIEW.width, HUD_H);
  // Gold divider: a thin bright line under the HUD so the bar reads as
  // a crafted frame, not a flat slab.
  const div = ctx.createLinearGradient(0, 0, VIEW.width, 0);
  div.addColorStop(0, 'rgba(255, 215, 107, 0)');
  div.addColorStop(0.25, 'rgba(255, 215, 107, 0.85)');
  div.addColorStop(0.75, 'rgba(255, 215, 107, 0.85)');
  div.addColorStop(1, 'rgba(255, 215, 107, 0)');
  ctx.fillStyle = div;
  ctx.fillRect(0, HUD_H - 2, VIEW.width, 2);
  ctx.save();
  ctx.shadowColor = 'rgba(255, 190, 80, 0.8)';
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#ffd76b";
  ctx.font = "bold 26px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("GLOWGARDEN", 20, 40);
  ctx.restore();
  ctx.font = "bold 17px sans-serif";
  ctx.fillStyle = "#e8f5ee";
  const waveLabel = game.wave >= TOTAL_WAVES ? "Waves done" : "Wave " + Math.min(game.wave + 1, TOTAL_WAVES) + " / " + TOTAL_WAVES;
  ctx.fillText(waveLabel, 250, 40);
  ctx.fillStyle = "#ffd76b";
  ctx.fillText("Gold " + game.gold, 400, 40);
  ctx.fillStyle = "#ff8fa0";
  ctx.fillText("Lives " + game.lives, 520, 40);
  ctx.fillStyle = "#e8f5ee";
  ctx.fillText("Score " + game.score, 640, 40);
  if (game.screen === SCREEN.WAVE) {
    const left = game.spawnQueue.length + game.enemies.length;
    ctx.fillStyle = "#9fd8b4";
    ctx.fillText("Moths left " + left, 250, 58);
    // Wave progress: thin bar just below the HUD, clear of the text.
    if (game.waveTotal > 0) {
      const cleared = 1 - left / game.waveTotal;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(250, HUD_H + 4, 220, 5);
      ctx.fillStyle = "#7CFC98";
      ctx.fillRect(250, HUD_H + 4, 220 * Math.max(0, Math.min(1, cleared)), 5);
    }
    // Boss health bar, centred under the HUD and below the message
    // pill (which sits at HUD_H+8), so the two never overlap.
    const boss = game.enemies.find((e) => e.kind === "boss" && !e.dead);
    if (boss) {
      const bw = 420, bx = (VIEW.width - bw) / 2, by = HUD_H + 48;
      ctx.fillStyle = "rgba(8, 19, 28, 0.85)";
      rr(ctx, bx - 10, by - 4, bw + 20, 30, 8);
      ctx.fill();
      ctx.fillStyle = "#e08bff";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("MOTH QUEEN", VIEW.width / 2, by + 10);
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(bx, by + 14, bw, 7);
      ctx.fillStyle = "#c44dff";
      ctx.fillRect(bx, by + 14, bw * Math.max(0, boss.hp / boss.maxHp), 7);
      ctx.textAlign = "left";
    }
  }
  if (game.screen === SCREEN.BUILD && game.wave < TOTAL_WAVES) {
    // Next-wave preview, so the build choice is an informed one.
    const def = WAVES[game.wave];
    const parts = [];
    if (def.moth) parts.push(def.moth + " moths");
    if (def.wisp) parts.push(def.wisp + " wisps");
    if (def.beetle) parts.push(def.beetle + " beetles");
    if (def.brute) parts.push(def.brute + " brutes");
    if (def.boss) parts.push(def.boss + " Moth Queen");
    ctx.fillStyle = "#9fd8b4";
    ctx.fillText("Next: " + parts.join(", "), 250, 58);
  }
  const canStart = game.screen === SCREEN.BUILD && game.wave < TOTAL_WAVES;
  const startLabel = game.screen === SCREEN.BUILD ? "START WAVE" : (game.wave >= TOTAL_WAVES ? "DONE" : "WAVE " + (game.wave + 1));
  drawButton(ctx, ui.startBtn, startLabel, canStart, "#c77f1a");
  drawButton(ctx, ui.speedBtn, game.speed === 1 ? "Speed 1x" : "Speed 2x", true, "#2b6b4f");
  drawButton(ctx, ui.pauseBtn, "II", game.screen === SCREEN.WAVE || game.screen === SCREEN.BUILD, "#2b6b4f");
  drawButton(ctx, ui.soundBtn, isMuted() ? "Muted" : "Sound", true, "#2b6b4f");
  if (game.messageTimer > 0 && game.message) {
    ctx.font = "bold 16px sans-serif";
    const w = ctx.measureText(game.message).width + 28;
    ctx.fillStyle = "rgba(8, 19, 28, 0.85)";
    rr(ctx, (VIEW.width - w) / 2, HUD_H + 8, w, 32, 8);
    ctx.fill();
    ctx.fillStyle = "#ffe9a3";
    ctx.textAlign = "center";
    ctx.fillText(game.message, VIEW.width / 2, HUD_H + 30);
    ctx.textAlign = "left";
  }
  // Wave banner: big centre text for the first two seconds of a wave.
  if (game.banner && game.time < game.bannerUntil) {
    ctx.globalAlpha = Math.min(1, (game.bannerUntil - game.time) / 0.6);
    ctx.fillStyle = "#ffd76b";
    ctx.font = "bold 44px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(game.banner, VIEW.width / 2, 300);
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  }
}

function drawShop(ctx, game) {
  const ui = uiLayout(game);
  // Shorten a line with an ellipsis so it can never spill past its card.
  function fit(text, maxW) {
    let t = text;
    while (t.length > 1 && ctx.measureText(t).width > maxW) t = t.slice(0, -1);
    return t.length < text.length && t.length > 1 ? t.slice(0, -1) + '…' : t;
  }
  ctx.fillStyle = "#08131c";
  ctx.fillRect(0, SHOP_Y, VIEW.width, VIEW.height - SHOP_Y);
  if (!game.selectedTower) {
    ctx.fillStyle = "#ffd76b";
    ctx.font = "bold 15px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("How to play: click a card, then a glowing plot.", 800, SHOP_Y + 38);
    ctx.fillStyle = "#cfe8d8";
    ctx.font = "15px sans-serif";
    ctx.fillText("SPACE starts a wave. 1-3 pick lanterns. P pauses.", 800, SHOP_Y + 64);
    ctx.fillText("Click a built lantern to upgrade or sell it.", 800, SHOP_Y + 88);
  }
  if (game.selectedTower) {
    const t = game.selectedTower;
    const def = TOWERS[t.kind];
    const stats = towerStats(t.kind, t.level);
    const p = ui.panel;
    ctx.beginPath(); rr(ctx, p.x, p.y, p.w, p.h, 10);
    ctx.fillStyle = "#123326"; ctx.fill();
    ctx.strokeStyle = "#ffd76b"; ctx.lineWidth = 2; ctx.stroke();
    // Panel text stops before the Up/Sell buttons on the right: the
    // third line used to run underneath the Sell button, half-hidden.
    const textW = ui.upgradeBtn.x - p.x - 20;
    ctx.fillStyle = "#fff";
    ctx.font = "bold 17px sans-serif";
    ctx.fillText(fit(def.name + " - Lv " + t.level + " / " + MAX_LEVEL, textW), p.x + 16, p.y + 26);
    ctx.font = "15px sans-serif";
    ctx.fillStyle = "#cfe8d8";
    const shownDamage = harmonyDamage(game, t, stats.damage);
    ctx.fillText(fit("Damage " + shownDamage + "   Range " + stats.range, textW), p.x + 16, p.y + 52);
    const harmony = hasHarmony(game, t);
    ctx.fillText(fit(harmony
      ? "Harmony: +" + Math.round(HARMONY_BONUS * 100) + "% damage."
      : "No Harmony yet \u2014 mix kinds.", textW), p.x + 16, p.y + 78);
    const canUp = t.level < MAX_LEVEL;
    drawButton(ctx, ui.upgradeBtn, canUp ? "Up " + upgradeCost(t.kind, t.level) + "g" : "MAX", canUp, "#c77f1a");
    drawButton(ctx, ui.sellBtn, "Sell " + sellValue(t.kind, t.level) + "g", true, "#7a3b12");
    ctx.fillStyle = "#ff8fa0";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText("X", ui.closeBtn.x + 9, ui.closeBtn.y + 20);
  }
  for (let i = 0; i < ui.cards.length; i += 1) {
    const card = ui.cards[i];
    const def = TOWERS[card.kind];
    const afford = game.gold >= def.cost;
    const selected = game.selectedKind === card.kind && !game.selectedTower;
    ctx.beginPath(); rr(ctx, card.x, card.y, card.w, card.h, 10);
    ctx.fillStyle = selected ? "#1d4a35" : "#122b21";
    ctx.fill();
    ctx.strokeStyle = selected ? "#ffd76b" : (afford ? "#3f7a5c" : "#444");
    ctx.lineWidth = selected ? 3 : 2;
    ctx.stroke();
    // Top highlight: a thin bright edge so the card reads as beveled.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(card.x + 12, card.y + 1.5);
    ctx.lineTo(card.x + card.w - 12, card.y + 1.5);
    ctx.stroke();
    // Mini lantern icon: a glowing glass with a cap, not a plain dot.
    const ix = card.x + 28, iy = card.y + 30;
    const icGlow = ctx.createRadialGradient(ix, iy, 1, ix, iy, 20);
    icGlow.addColorStop(0, def.glow);
    icGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = icGlow;
    ctx.beginPath(); ctx.arc(ix, iy, 20, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#3a2b1c';
    ctx.beginPath(); ctx.arc(ix, iy - 11, 4, Math.PI, 0); ctx.fill();
    ctx.fillStyle = def.color;
    ctx.beginPath(); ctx.arc(ix, iy, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff8dc';
    ctx.beginPath(); ctx.arc(ix, iy - 1, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(ix, iy - 1, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = afford ? "#fff" : "#888";
    ctx.font = "bold 17px sans-serif";
    ctx.fillText(def.name, card.x + 52, card.y + 28);
    ctx.font = "14px sans-serif";
    ctx.fillStyle = afford ? "#cfe8d8" : "#777";
    ctx.fillText(fit(def.blurb + " - " + def.cost + " gold", card.w - 60), card.x + 52, card.y + 52);
    ctx.fillText(fit(def.desc, card.w - 24), card.x + 16, card.y + 78);
    ctx.fillStyle = "#ffd76b";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText("[" + def.key + "]", card.x + card.w - 44, card.y + 28);
  }
}

function overlay(ctx, title, lines, buttonLabel, buttonRect, accent, sparkle, time) {
  ctx.fillStyle = "rgba(4, 12, 18, 0.62)";
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  // Warm halo behind the title so the headline glows, not just sits.
  const halo = ctx.createRadialGradient(VIEW.width / 2, 190, 10, VIEW.width / 2, 190, 320);
  halo.addColorStop(0, 'rgba(255, 190, 90, 0.16)');
  halo.addColorStop(1, 'rgba(255, 190, 90, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  // Victory sparkles: twinkling gold stars around the headline.
  // Seeded positions, time-driven alpha, so seeded shots still replay.
  if (sparkle) {
    const spRnd = mulberry32(777);
    for (let i = 0; i < 26; i += 1) {
      const sx = 200 + spRnd() * (VIEW.width - 400);
      const sy = 90 + spRnd() * 220;
      const sa = 0.35 + 0.45 * Math.abs(Math.sin((time || 0) / 0.7 + i * 1.3));
      ctx.globalAlpha = sa;
      ctx.fillStyle = '#ffe9a3';
      const sr = 1.5 + spRnd() * 2.5;
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = "center";
  ctx.save();
  ctx.shadowColor = 'rgba(255, 190, 80, 0.9)';
  ctx.shadowBlur = 22;
  ctx.fillStyle = "#ffd76b";
  ctx.font = "bold 54px sans-serif";
  ctx.fillText(title, VIEW.width / 2, 190);
  ctx.restore();
  ctx.fillStyle = "#eaf6ee";
  ctx.font = "20px sans-serif";
  for (let i = 0; i < lines.length; i += 1) {
    ctx.fillText(lines[i], VIEW.width / 2, 250 + i * 34);
  }
  if (buttonLabel) drawButton(ctx, buttonRect, buttonLabel, true, accent || "#c77f1a");
  ctx.textAlign = "left";
}

export function draw(ctx, game) {
  // Screen shake on a leak: deterministic (driven by game.time, so
  // seeded screenshots still replay the same frame).
  ctx.save();
  if (game.shake > 0) {
    const m = game.shake * 18;
    ctx.translate(Math.sin(game.time * 61) * m * 0.5, Math.cos(game.time * 53) * m * 0.5);
  }
  drawBackground(ctx, game);
  drawPath(ctx, game);
  drawHeartLantern(ctx, game);
  drawPlots(ctx, game);
  drawTowers(ctx, game);
  drawEnemies(ctx, game);
  drawProjectiles(ctx, game);
  ctx.restore();
  drawHUD(ctx, game);
  drawShop(ctx, game);
  const ui = uiLayout(game);
  if (game.screen === SCREEN.TITLE) {
    overlay(ctx, "GLOWGARDEN", [
      "A lantern-defense game: shadow moths march on the Heart Lantern.",
      "Build Ember, Frost and Bloom lanterns on the glowing plots.",
      "Stop all 10 waves to win. If 22 hearts leak away, the light goes out.",
      "Different lanterns standing close harmonize for +15% damage.",
      "Click a card, then a plot. SPACE starts a wave. 1-3 pick lanterns.",
    ], "START THE GARDEN", ui.titleBtn);
  } else if (game.screen === SCREEN.WIN) {
    const grade = game.lives >= 18 ? "S" : game.lives >= 13 ? "A" : game.lives >= 7 ? "B" : "C";
    const clock = Math.floor(game.time / 60) + ":" + String(Math.floor(game.time % 60)).padStart(2, "0");
    overlay(ctx, "THE GARDEN GLOWS!", [
      "All 10 waves beaten. The Heart Lantern burns bright again.",
      "Rank " + grade + "   -   Time " + clock + "   -   Moths stopped " + game.kills,
      "Score " + game.score + "   -   Gold earned " + game.stats.earned,
      "Lives left " + game.lives + "   -   Lanterns built " + game.stats.placed,
    ], "PLAY AGAIN", ui.againBtn, "#c77f1a", true, game.time);
  } else if (game.screen === SCREEN.LOSE) {
    overlay(ctx, "THE LIGHT WENT OUT", [
      "The moths reached the Heart Lantern on wave " + Math.min(game.wave + 1, TOTAL_WAVES) + ".",
      "Score " + game.score + "   -   Moths stopped " + game.kills + "   -   Gold earned " + game.stats.earned,
      game.wave >= 9
        ? "Tip: the Moth Queen soaks splash — slow her with Frost and focus her down."
        : "Tip: Frost lanterns slow the swarm so Ember lanterns can finish it.",
    ], "TRY AGAIN", ui.againBtn);
  } else if (game.screen === SCREEN.PAUSED) {
    overlay(ctx, "PAUSED", [
      "Take a breath. The moths wait for no one, but they wait for you.",
    ], "RESUME", ui.resumeBtn);
  }
}
