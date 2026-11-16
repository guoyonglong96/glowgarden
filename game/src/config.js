// Glowgarden tuning: canvas, path, plots, towers, enemies, waves.
// One job: every number the game balances on lives here.
export const VIEW = { width: 1280, height: 720 };
export const HUD_H = 64;              // top bar height
export const SHOP_Y = 600;            // shop bar starts here
export const FIELD = { x: 0, y: HUD_H, width: 1280, height: SHOP_Y - HUD_H };

// The winding garden path the shadow moths follow, from the west gate
// to the Heart Lantern at the east end.
export const PATH = [
  { x: -20, y: 150 }, { x: 330, y: 150 }, { x: 330, y: 470 },
  { x: 700, y: 470 }, { x: 700, y: 210 }, { x: 1060, y: 210 },
  { x: 1060, y: 380 }, { x: 1300, y: 380 },
];
export const HEART = { x: 1215, y: 380 };

// Buildable lantern plots (circles the player can build on). Every plot
// covers a real stretch of the path for every lantern kind: a plot a
// lantern cannot shoot from is a trap, so each one was measured.
export const PLOTS = [
  { x: 150, y: 240 }, { x: 240, y: 60 + 64 }, { x: 430, y: 150 },
  { x: 430, y: 350 }, { x: 240, y: 470 }, { x: 560, y: 560 },
  { x: 560, y: 390 }, { x: 900, y: 300 }, { x: 800, y: 300 },
  { x: 940, y: 120 }, { x: 1150, y: 470 }, { x: 1150, y: 250 },
];

// Tower kinds: name, cost, range, damage, fire interval (s), projectile
// speed, colour, and the special effect each one brings.
// Balance: no one tower wins alone. Ember is the cheap workhorse, Frost
// trades raw damage for its slow, Bloom pays for splash against packs.
// DPS per gold: ember 0.23, frost 0.15 (+slow), bloom 0.12 (+splash).
export const TOWERS = {
  ember: {
    key: '1', name: 'Ember Lantern', cost: 60, range: 120, damage: 7,
    interval: 0.5, projSpeed: 520, color: '#ffb347', glow: '#ff8c1a',
    blurb: 'Fast sparks', desc: 'Quick shots, steady damage.',
  },
  frost: {
    key: '2', name: 'Frost Lantern', cost: 90, range: 110, damage: 9,
    interval: 0.65, projSpeed: 460, color: '#7dd7ff', glow: '#2fa8ff',
    blurb: 'Chills & slows', desc: 'Slows moths by 62% for 1.8s.',
    slow: 0.62, slowTime: 1.8,
  },
  bloom: {
    key: '3', name: 'Bloom Lantern', cost: 140, range: 105, damage: 18,
    interval: 1.05, projSpeed: 380, color: '#ff7ad9', glow: '#e14bb8',
    blurb: 'Petal splash', desc: 'Splash petals hit a crowd.',
    splash: 55,
  },
};
export const TOWER_ORDER = ['ember', 'frost', 'bloom'];
// Harmony: lanterns of different kinds standing close together burn
// brighter. A tower with a different-kind neighbour in range deals
// +15% damage. Same-kind neighbours do not count, so a field of one
// kind never earns the bonus. At these plot positions the radius
// joins four natural neighbour pairs: 0-1, 3-6, 5-6 and 7-8, so
// where each kind is planted is part of the puzzle.
export const HARMONY_RADIUS = 175;
export const HARMONY_BONUS = 0.15;
export const MAX_LEVEL = 3;
export function upgradeCost(kind, level) {
  return Math.round(TOWERS[kind].cost * 0.6 * level);
}
export function sellValue(kind, level) {
  let spent = TOWERS[kind].cost;
  for (let l = 1; l < level; l += 1) spent += upgradeCost(kind, l);
  return Math.floor(spent * 0.7);
}

// Enemy kinds: hit points, speed (px/s), gold bounty, lives lost on leak.
export const ENEMIES = {
  moth:   { hp: 30,  speed: 70, gold: 5,  lives: 1, radius: 15, color: '#b9a7ff', name: 'Dusk Moth' },
  wisp:   { hp: 18,  speed: 120, gold: 7, lives: 1, radius: 12, color: '#8ef7c1', name: 'Quick Wisp' },
  beetle: { hp: 115, speed: 50, gold: 13, lives: 2, radius: 19, color: '#ff9d6b', name: 'Horn Beetle' },
  brute:  { hp: 285, speed: 46, gold: 45, lives: 5, radius: 26, color: '#ff5d73', name: 'Night Brute' },
  boss:   { hp: 380, speed: 38, gold: 120, lives: 8, radius: 30, color: '#c44dff', name: 'Moth Queen' },
};
export const ENEMY_ORDER = ['moth', 'wisp', 'beetle', 'brute', 'boss'];

// Waves 1..10: each entry spawns that many of a kind, spaced by a fixed gap.
// HP grows 26% a wave. The first six waves are the old curve — the
// mid-game was already tight, so the ramp lives in the late game: more
// beetles and brutes from wave 7 on, and the last wave brings the Moth
// Queen herself (8 lives if she leaks, so a field that cannot focus
// her down loses on the spot). Splash alone cannot carry the late
// game — fast wisps slip past slow petals, and brutes soak them.
export const WAVES = [
  { moth: 6 },
  { moth: 9, wisp: 4 },
  { moth: 12, wisp: 8 },
  { moth: 12, wisp: 8, beetle: 3 },
  { moth: 14, wisp: 10, beetle: 5 },
  { wisp: 16, beetle: 8 },
  { moth: 16, wisp: 12, beetle: 11 },
  { beetle: 14, wisp: 16, moth: 10, brute: 1 },
  { beetle: 16, wisp: 22, moth: 12, brute: 1 },
  { beetle: 13, wisp: 14, brute: 2, boss: 1, moth: 10 },
];
export const WAVE_GAP = 0.75;          // seconds between spawns in a wave
export const HP_GROWTH = 0.26;        // +26% HP per wave after the first
export const WAVE_BONUS = (wave) => 30 + wave * 8;

export const START_GOLD = 170;
export const START_LIVES = 22;
export const TOTAL_WAVES = WAVES.length;
