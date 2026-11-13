// ===== GAME LOGIC (pure, no Phaser) =====
// 3 stages: 3 chest picks each, then ONE strike with ALL gear collected so far (gear accumulates).
const RULES = {
  picksPerStage: 3,
  stages: [
    { hp: 60, name: 'HELL HOUND', short: 'Hound' },
    { hp: 650, name: 'HELL BEAST', short: 'Beast' },
    { hp: 2400, name: 'ANCIENT DRAGON', short: 'Dragon' },
  ],
  wood:  { min: 15, max: 30, spread: 0.35 },
  gold:  { accChance: 0.8, multMin: 0.3, multMax: 0.8, wMin: 20, wMax: 50, spread: 0.3 },
  black: { goodByStage: [0.75, 0.52, 0.48], wMin: 190, wMax: 290, cMin: 70, cMax: 140, wSpread: 0.2, cSpread: 0.3 },
  baseAtk: 25,          // the hero's own swing, before any gear
  setCount: 5, setMult: 2,
  offerWeights: { wood: 0.5, gold: 0.22, black: 0.28 },
  // overkill bonus after bosses 1 and 2 (q = damage / boss HP): q<3 trophy (wooden roll), 3<=q<8 bonus chest (no curse), q>=8 jackpot
  bonus: { chestAt: 3, jackpotAt: 8, chestWeights: { wood: 0.3, gold: 0.35, black: 0.35 }, jackpotLeg: 0.5 },
};
RULES.rounds = RULES.picksPerStage * RULES.stages.length;
const TYPES = ['wood', 'gold', 'black'];
const ELEMENTS = ['Fire', 'Ice', 'Thunder'];
const ri = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
function rollOffer(rng) {
  const w = RULES.offerWeights;
  const one = () => { const x = rng(); return x < w.wood ? 'wood' : x < w.wood + w.gold ? 'gold' : 'black'; };
  return [0, 1, 2].map(() => ({ type: one(), element: pick(rng, ELEMENTS) }));
}
// every flat item has an ATK RANGE [lo, hi]; the roll happens at the strike. Multipliers are fixed.
function span(c, sp) { const h = Math.round(c * sp); return [c - h, c + h]; }
function openChest(chest, rng, stage = 0, noCurse = false) {
  const R = RULES, el = chest.element;
  const flatItem = (kind, c, sp) => { const [lo, hi] = span(c, sp); return { kind, element: el, flat: c, lo, hi, mult: 0 }; };
  if (chest.type === 'wood') return flatItem(pick(rng, ['weapon', 'armor']), ri(rng, R.wood.min, R.wood.max), R.wood.spread);
  if (chest.type === 'gold') {
    if (rng() < R.gold.accChance) return { kind: 'accessory', element: el, flat: 0, lo: 0, hi: 0, mult: ri(rng, R.gold.multMin * 10, R.gold.multMax * 10) / 10 };
    return flatItem('weapon', ri(rng, R.gold.wMin, R.gold.wMax), R.gold.spread);
  }
  if (noCurse || rng() < R.black.goodByStage[Math.min(stage, R.black.goodByStage.length - 1)]) return flatItem('weapon', ri(rng, R.black.wMin, R.black.wMax), R.black.wSpread);
  const c = ri(rng, R.black.cMin, R.black.cMax), [a, b] = span(c, R.black.cSpread);
  return { kind: 'cursed', element: el, flat: -c, lo: -b, hi: -a, mult: 0 };
}
// reward for overkilling boss 1 / 2; null if the boss survived
function bonusDrop(dmg, hp, rng) {
  const q = dmg / hp, B = RULES.bonus, el = pick(rng, ELEMENTS); if (q < 1) return null;
  if (q < B.chestAt) return { tier: 'minor', type: 'wood', item: openChest({ type: 'wood', element: el }, rng) };
  if (q < B.jackpotAt) {
    const x = rng(), w = B.chestWeights, type = x < w.wood ? 'wood' : x < w.wood + w.gold ? 'gold' : 'black';
    return { tier: 'chest', type, item: openChest({ type, element: el }, rng, 0, true) };
  }
  if (rng() < B.jackpotLeg) { const c = ri(rng, 240, 290), [lo, hi] = span(c, RULES.black.wSpread); return { tier: 'jackpot', type: 'black', item: { kind: 'weapon', element: el, flat: c, lo, hi, mult: 0 } }; }
  return { tier: 'jackpot', type: 'gold', item: { kind: 'accessory', element: el, flat: 0, lo: 0, hi: 0, mult: ri(rng, 6, 8) / 10 } };
}
// rng given -> roll every item inside its range; no rng -> use the average (for previews)
function rollItem(it, rng) { return it.lo === it.hi ? it.lo : rng ? ri(rng, it.lo, it.hi) : (it.lo + it.hi) / 2; }
function computeDamage(items, rng) {
  let flat = RULES.baseAtk, mult = 0; const cnt = { Fire: 0, Ice: 0, Thunder: 0 };
  const rolls = items.map((it) => rollItem(it, rng));
  items.forEach((it, i) => { flat += rolls[i]; mult += it.mult; if (cnt[it.element] !== undefined) cnt[it.element]++; });
  let setEl = null; for (const e of ELEMENTS) if (cnt[e] >= RULES.setCount && (!setEl || cnt[e] > cnt[setEl])) setEl = e;
  const set = setEl ? RULES.setMult : 1;
  const raw = Math.round(flat);
  flat = Math.max(0, raw);
  return { rolls, raw, flat, mult: Math.round(mult * 10) / 10, set, setEl, total: Math.round(flat * (1 + mult) * set) };
}
// ===== END LOGIC =====

// ===== CONTENT =====
const EL_COLOR = { Fire: 0xff5a2a, Ice: 0x5ad2ff, Thunder: 0xffe04a };
const EL_CSS = { Fire: '#ff8a5a', Ice: '#8ae2ff', Thunder: '#ffe866' };
const CURSE_COL = 0xb070ff;
// icon frames in assets/img/icons.png (34x34 each) -> item noun
const ICONS = {
  weapon: { Fire: [[0, 'Sword'], [1, 'Dagger'], [2, 'Mace'], [3, 'Bow'], [4, 'Axe']],
            Ice: [[5, 'Sword'], [6, 'Blade'], [7, 'Dagger'], [8, 'Bow'], [9, 'Staff']],
            Thunder: [[10, 'Sword'], [11, 'Dagger'], [12, 'Bow'], [13, 'Axe'], [14, 'Spear']] },
  armor: { Fire: [[15, 'Armor'], [16, 'Boots']], Ice: [[17, 'Boots'], [18, 'Helm']], Thunder: [[19, 'Armor'], [20, 'Helm']] },
  accessory: { Fire: [[21, 'Amulet'], [22, 'Ring']], Ice: [[23, 'Amulet'], [24, 'Pendant']], Thunder: [[25, 'Medal'], [26, 'Talisman']] },
  cursed: [[27, 'Relic'], [28, 'Idol'], [29, 'Grimoire'], [30, 'Shard']],
};
function nameItem(it) {
  const p = (a) => a[Math.floor(Math.random() * a.length)], r = (n) => Math.floor(Math.random() * n);
  if (it.kind === 'cursed') { const c = p(ICONS.cursed); it.frame = c[0]; it.np = { cur: r(4), pre: r(5), noun: NOUN_KEYS.indexOf(c[1]) }; }
  else { const c = p(ICONS[it.kind][it.element]); it.frame = c[0]; it.np = { pre: r(5), mid: r(8), noun: NOUN_KEYS.indexOf(c[1]) }; }
  Object.defineProperty(it, 'name', { get() { return itemName(this); }, configurable: true }); // localized on every read
  it.rarity = it.kind === 'cursed' ? 'CURSED' : (it.flat >= 240 || it.mult >= 0.7) ? 'LEGENDARY' : (it.flat >= 150 || it.mult >= 0.5) ? 'EPIC' : it.mult ? 'RARE' : 'COMMON';
  return it;
}
function itemName(it) {
  const N = t('names'), pre = N.pre[it.element][it.np.pre], noun = N.noun[it.np.noun];
  return it.kind === 'cursed' ? N.fmtCur(N.cur[it.np.cur], pre, noun) : N.fmt(pre, N.mid[it.np.mid], noun);
}
const elName = (e) => t('el')[e];
// Every item states its own damage rule.
const ruleText = (it) => it.kind === 'cursed' ? t('ruleCurse', it.hi, it.lo) : it.mult ? t('ruleMult', it.mult.toFixed(1)) : t('ruleFlat', it.lo, it.hi);
const elemCount = (items, el) => items.filter((i) => i.element === el).length;
const setLine = (it, items) => t('setLine', elName(it.element), RULES.setCount, RULES.setMult, Math.min(elemCount(items, it.element), RULES.setCount));
const itemCol = (it) => it.kind === 'cursed' ? CURSE_COL : EL_COLOR[it.element];
const RARITY = {
  COMMON: { css: '#d8d8d8', col: 0xd8d8d8, n: 10, shake: 0 },
  RARE: { css: '#7adcff', col: 0x7adcff, n: 22, shake: 0 },
  EPIC: { css: '#d58cff', col: 0xd58cff, n: 36, shake: 0.006 },
  LEGENDARY: { css: '#ffcf40', col: 0xffcf40, n: 60, shake: 0.012 },
  CURSED: { css: '#ff6a8a', col: 0x9a3aff, n: 44, shake: 0.012 },
};

// Bosses (all CC0 by ansimuz). fw/fh = frame size; head/mouth/body in frame pixels (they all face left).
const BOSSES = [
  { tex: 'hound_idle', anim: 'hound-idle', fw: 64, fh: 32, scale: 4.5, x: 930, head: [15, 16], mouth: [12, 20], body: [30, 40], col: '#ff9a5a' },
  { tex: 'beast_idle', anim: 'beast-idle', fw: 55, fh: 67, scale: 3.4, x: 925, head: [21, 28], mouth: [19, 32], body: [28, 46], col: '#ff6a5a' },
  { tex: 'dragon_idle', anim: 'dragon-idle', fw: 144, fh: 64, scale: 4, x: 900, head: [70, 34], mouth: [66, 28], body: [95, 71], col: '#ff8a6a' },
];
// Strike feedback grows with damage / boss HP. L0 = not enough, L1 = kill, L2 = x2, L3 = x5, L4 = x10
const OK_TIERS = [
  { at: 0, label: 'NOT ENOUGH', font: 72, shake: 0.012, stop: 60, n: 0.6, col: 0xff5a4a, css: '#ff6a5a', snd: null },
  { at: 1, label: 'KILL!', font: 84, shake: 0.025, stop: 90, n: 1, col: 0xffd36a, css: '#ffd36a', snd: 'hit' },
  { at: 2, label: 'OVERKILL', font: 100, shake: 0.035, stop: 160, n: 1.6, col: 0xffa040, css: '#ffb24a', snd: 'smash' },
  { at: 5, label: 'MEGA OVERKILL', font: 118, shake: 0.05, stop: 260, n: 2.4, col: 0xff4a8a, css: '#ff7ab0', snd: 'boom' },
  { at: 10, label: 'GODLIKE', font: 138, shake: 0.07, stop: 380, n: 3.4, col: 0xc080ff, css: '#e0b8ff', snd: 'nuke' },
];
function okLevel(dmg, hp) { let L = 0; OK_TIERS.forEach((t, i) => { if (i && dmg >= t.at * hp) L = i; }); return L; }
const okLabel = (L, ratio) => L >= 2 ? `${t('ok')[L - 2]} x${ratio >= 10 ? Math.floor(ratio) : ratio.toFixed(1)}` : L === 1 ? t('kill') : '';
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// ===== PHASER =====
const W = 1200, H = 628;
let FONT = fontFor(LANG);
const LAVA_GROUND = 512;   // lava floor line of bg_lava drawn at 3x
window.DC = { phase: 'boot', round: 0 };

function txt(scene, x, y, s, size, color = '#ffffff', extra = {}) {
  const { maxW, ...st } = extra;
  const o = scene.add.text(x, y, s, Object.assign({ fontFamily: FONT, fontSize: size + 'px', color, fontStyle: 'bold', stroke: '#140812', strokeThickness: Math.max(4, Math.round(size / 7)), align: 'center' }, st)).setOrigin(0.5);
  if (maxW) fitText(o, maxW, size);
  return o;
}
// shrink a text's font size until it fits maxW (translations differ in length)
function fitText(o, maxW, size) {
  o.__maxW = maxW; o.__size = size;
  let sz = size; while (o.width > maxW && sz > 9) { sz -= 1; o.setFontSize(sz + 'px'); }
  return o;
}
function setFit(o, s) { o.setFontSize(o.__size + 'px'); o.setText(s); if (o.__maxW) fitText(o, o.__maxW, o.__size); return o; }
// cut a single-line text with an ellipsis until it fits
function clipText(o, maxW) { const full = o.text; let n = full.length; while (o.width > maxW && n > 1) { n--; o.setText(full.slice(0, n) + '…'); } return o; }
function sfx(scene, key, vol = 0.8) { try { scene.sound.play(key, { volume: vol }); } catch (e) {} }
function backdrop(scene, key, dim) {
  scene.add.image(W / 2, H / 2, key).setScale(3);
  if (dim) scene.add.rectangle(-200, -200, W + 400, H + 400, 0x0a0612, dim).setOrigin(0);
}
// fantasy frame: dark plate, gold double border, corner studs
function panel(scene, x, y, w, h, opts = {}) {
  const g = scene.add.graphics();
  const border = opts.border ?? 0xd9a441, fill = opts.fill ?? 0x140a18, a = opts.alpha ?? 0.86;
  g.fillStyle(0x000000, 0.35); g.fillRoundedRect(x + 4, y + 6, w, h, 10);
  g.fillStyle(fill, a); g.fillRoundedRect(x, y, w, h, 10);
  g.lineStyle(3, border, 1); g.strokeRoundedRect(x, y, w, h, 10);
  g.lineStyle(1, 0x5a3a1a, 1); g.strokeRoundedRect(x + 6, y + 6, w - 12, h - 12, 7);
  g.fillStyle(border, 1); [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(([cx, cy]) => g.fillRect(cx - 5, cy - 5, 10, 10));
  g.fillStyle(0xfff0b0, 1); [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(([cx, cy]) => g.fillRect(cx - 2, cy - 2, 4, 4));
  return g;
}
function button(scene, x, y, label, cb, w = 260) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.4); g.fillRoundedRect(-w / 2 + 3, -30, w, 64, 12);
  g.fillStyle(0x8a1c10, 1); g.fillRoundedRect(-w / 2, -34, w, 64, 12);
  g.fillStyle(0xc0381c, 1); g.fillRoundedRect(-w / 2 + 4, -30, w - 8, 26, 9);
  g.lineStyle(4, 0xffd36a, 1); g.strokeRoundedRect(-w / 2, -34, w, 64, 12);
  const t = txt(scene, 0, -2, label, 32, '#fff4c8', { maxW: w - 30 });
  const hit = scene.add.rectangle(0, -2, w, 70, 0x000000, 0.001).setInteractive({ useHandCursor: true });
  c.add([g, t, hit]); c.setSize(w, 64);
  hit.on('pointerdown', () => { sfx(scene, 'click'); cb(); });
  scene.tweens.add({ targets: c, scale: 1.06, yoyo: true, repeat: -1, duration: 600, ease: 'Sine.inOut' });
  return c;
}
function shadow(scene, x, y, w) { return scene.add.ellipse(x, y, w, w * 0.22, 0x000000, 0.45); }
function burst(scene, x, y, color, n, speed = 260, tex = 'spark') {
  const e = scene.add.particles(x, y, tex, {
    speed: { min: speed * 0.35, max: speed }, angle: { min: 0, max: 360 }, lifespan: { min: 350, max: 800 },
    scale: { start: 1.1, end: 0 }, alpha: { start: 1, end: 0 }, gravityY: 300, tint: [color, 0xffffff], blendMode: 'ADD', emitting: false,
  });
  e.explode(n);
  scene.time.delayedCall(1000, () => e.destroy());
  return e;
}
function popText(scene, t, scale = 1) {
  t.setScale(0);
  scene.tweens.add({ targets: t, scale: { from: 0, to: scale * 1.35 }, duration: 160, ease: 'Quad.out', onComplete: () => scene.tweens.add({ targets: t, scale, duration: 160, ease: 'Back.out' }) });
}
// Item tooltip: hover (mouse) or tap to toggle (touch). Always clamped inside the 1200x628 canvas.
class Tooltip {
  constructor(scene, getItems) {
    this.scene = scene; this.getItems = getItems; this.pinned = false; this.cur = null;
    this.c = scene.add.container(0, 0).setDepth(1000).setVisible(false);
    scene.input.on('pointerdown', (p, over) => { if (!over.some((o) => o.getData && o.getData('item'))) this.hide(true); });
  }
  get visible() { return this.c.visible; }
  attach(obj, it) {
    obj.setData('item', it).setInteractive({ useHandCursor: true });
    obj.on('pointerover', (p) => { if (!p.wasTouch && !this.pinned) this.show(it, obj); });
    obj.on('pointerout', (p) => { if (!p.wasTouch && !this.pinned) this.hide(); });
    obj.on('pointerdown', () => {
      if (this.pinned && this.cur === it) { this.hide(true); return; }
      this.show(it, obj); this.pinned = true;
    });
    return obj;
  }
  show(it, obj) {
    const sc = this.scene, items = this.getItems(), R = RARITY[it.rarity];
    this.c.removeAll(true); this.cur = it;
    const w = 470, lines = [
      [it.name, 26, it.kind === 'cursed' ? '#d9a6ff' : EL_CSS[it.element]],
      [`${t('rar')[it.rarity]} · ${t('kind')[it.kind]} · ${elName(it.element)}`, 19, R.css],
      [ruleText(it), 28, it.kind === 'cursed' ? '#ff6a7a' : it.mult ? '#ffd84a' : '#b8f0a0'],
      [setLine(it, items), 18, EL_CSS[it.element]],
    ];
    let y = 18; const texts = [];
    lines.forEach(([str, size, col]) => {
      const tx = sc.add.text(w / 2, y, str, { fontFamily: FONT, fontSize: size + 'px', color: col, fontStyle: 'bold', stroke: '#140812', strokeThickness: 4, align: 'center', wordWrap: { width: w - 30, useAdvancedWrap: true } }).setOrigin(0.5, 0);
      texts.push(tx); y += tx.height + 8;
    });
    const h = y + 14; // measured, so wrapped lines (long translations) stay inside the frame
    const g = panel(sc, 0, 0, w, h, { border: R.col, alpha: 0.95 });
    this.c.add(g); this.c.add(texts);
    // place beside the icon, flip to the other side / clamp so it never leaves the canvas
    // bigger on small screens (mobile / tiny iframe) so it stays readable
    const k = sc.scale.displaySize.width < 700 ? 1.55 : 1, sw = w * k, sh = h * k;
    const b = obj.getBounds();
    let x = b.right + 14; if (x + sw > W - 8) x = b.left - 14 - sw;
    x = Phaser.Math.Clamp(x, 8, W - sw - 8);
    const ty = Phaser.Math.Clamp(b.centerY - sh / 2, 8, H - sh - 8);
    this.c.setScale(k).setPosition(x, ty).setScrollFactor(0).setVisible(true);
    window.DC.tooltip = { name: it.name, rule: ruleText(it), x, y: ty, w: sw, h: sh };
  }
  hide(force) { if (force) this.pinned = false; this.c.setVisible(false); this.cur = null; window.DC.tooltip = null; }
}
// canvas-drawn light textures for the reveal FX (no image assets)
function makeFxTextures(scene) {
  const T = scene.textures, mk = (key, w, h, draw) => { if (T.exists(key)) return; const t = T.createCanvas(key, w, h); draw(t.getContext(), w, h); t.refresh(); };
  mk('beam', 64, 512, (c, w, h) => { // soft vertical light shaft, bright at the bottom
    const gx = c.createLinearGradient(0, 0, w, 0); gx.addColorStop(0, 'rgba(255,255,255,0)'); gx.addColorStop(0.5, 'rgba(255,255,255,1)'); gx.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gx; c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'destination-in';
    const gy = c.createLinearGradient(0, 0, 0, h); gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(0.6, 'rgba(0,0,0,0.7)'); gy.addColorStop(1, 'rgba(0,0,0,1)');
    c.fillStyle = gy; c.fillRect(0, 0, w, h);
  });
  mk('rays', 256, 256, (c, w, h) => { // 12 wedge god-rays fading out from the centre
    c.translate(w / 2, h / 2); c.fillStyle = '#fff';
    for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, w / 2, a - 0.11, a + 0.11); c.closePath(); c.fill(); }
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'destination-in';
    const g = c.createRadialGradient(w / 2, h / 2, 6, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  mk('vig', 256, 134, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.62); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.92)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  mk('glowdot', 128, 128, (c, w) => {
    const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, w);
  });
}
// ---- music: main loop, end-screen victory / defeat cue, back to the main loop on Play Again
const MAIN_VOL = 0.35;
function endMusic(scene, win) {
  const snd = scene.sound, m = snd.get('music');
  if (m && m.isPlaying) scene.tweens.add({ targets: m, volume: 0, duration: 900, onComplete: () => { try { m.pause(); } catch (e) {} } });
  snd.stopByKey('victory'); snd.stopByKey('defeat');
  const key = win ? 'victory' : 'defeat';
  scene.time.delayedCall(win ? 500 : 700, () => { try { snd.play(key, { volume: win ? 0.55 : 0.6 }); } catch (e) {} });
  window.DC.music = { end: key };
}
function restoreMusic(scene) {
  const snd = scene.sound; snd.stopByKey('victory'); snd.stopByKey('defeat');
  const m = snd.get('music');
  if (m) { m.setVolume(0); try { if (m.isPaused) m.resume(); else if (!m.isPlaying) m.play(); } catch (e) {} window.__fadeMain = true; }
  window.DC.music = { end: null };
}
function fadeInMain(scene) {
  if (!window.__fadeMain) return; window.__fadeMain = false;
  const m = scene.sound.get('music'); if (m) scene.tweens.add({ targets: m, volume: MAIN_VOL, duration: 1200 });
}
// Soft, tinted, low-alpha flash (max 0.3), never repeated within 1.2s. Used only for a Legendary open and GODLIKE.
function softFlash(scene, col, a = 0.25, dur = 240) {
  const now = Date.now(); if (window.__lastFlash && now - window.__lastFlash < 1200) return; window.__lastFlash = now;
  const r = scene.add.rectangle(-200, -200, W + 400, H + 400, col, 1).setOrigin(0).setScrollFactor(0).setDepth(900).setAlpha(Math.min(0.3, a));
  scene.tweens.add({ targets: r, alpha: 0, duration: dur, ease: 'Quad.out', onComplete: () => r.destroy() });
  window.DC.flashes = (window.DC.flashes || 0) + 1;
}
function heroGlow(spr) { try { if (spr.preFX) spr.preFX.addGlow(0xfff2b0, 3, 0, false, 0.1, 10); } catch (e) {} }

class Boot extends Phaser.Scene {
  constructor() { super('boot'); }
  preload() {
    const bar = this.add.rectangle(W / 2 - 200, H / 2, 4, 20, 0xffd36a).setOrigin(0, 0.5);
    this.load.on('progress', (p) => bar.width = 400 * p);
    const I = 'assets/img/', A = 'assets/audio/';
    ['chest_wood', 'chest_gold', 'chest_black', 'open_wood', 'open_gold', 'open_black', 'bg_hoard', 'bg_lava'].forEach((k) => this.load.image(k, I + k + '.png'));
    this.load.spritesheet('icons', I + 'icons.png', { frameWidth: 34, frameHeight: 34 });
    this.load.spritesheet('dragon_idle', I + 'dragon_idle.png', { frameWidth: 144, frameHeight: 64 });
    this.load.spritesheet('dragon_breath', I + 'dragon_breath.png', { frameWidth: 144, frameHeight: 64 });
    this.load.spritesheet('hound_idle', I + 'hound_idle.png', { frameWidth: 64, frameHeight: 32 });
    this.load.spritesheet('beast_idle', I + 'beast_idle.png', { frameWidth: 55, frameHeight: 67 });
    this.load.spritesheet('hero_idle', I + 'hero_idle.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('hero_run', I + 'hero_run.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('hero_attack', I + 'hero_attack.png', { frameWidth: 64, frameHeight: 64 });
    ['click', 'open', 'rare', 'curse', 'swing', 'hit', 'win', 'lose', 'music', 'epic', 'legendary', 'charge', 'banner', 'tick', 'victory', 'defeat', 'smash', 'boom', 'nuke', 'shatter', 'stage'].forEach((k) => this.load.audio(k, A + k + '.mp3'));
  }
  create() {
    const a = (key, tex, rate, repeat = -1) => this.anims.create({ key, frames: this.anims.generateFrameNumbers(tex), frameRate: rate, repeat });
    a('dragon-idle', 'dragon_idle', 8); a('hound-idle', 'hound_idle', 9); a('beast-idle', 'beast_idle', 8); a('dragon-breath', 'dragon_breath', 12, 0);
    a('hero-idle', 'hero_idle', 3); a('hero-run', 'hero_run', 16); a('hero-attack', 'hero_attack', 14, 0);
    // generated FX textures
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff, 1); g.fillRect(0, 0, 6, 6); g.generateTexture('spark', 6, 6); g.clear();
    g.fillStyle(0xffffff, 1); g.fillRect(0, 0, 3, 3); g.generateTexture('px', 3, 3); g.clear();
    g.fillStyle(0xffffff, 1); g.fillRect(0, 0, 6, 3); g.generateTexture('conf', 6, 3); g.clear();
    g.fillStyle(0x8a5a00, 1); g.fillRect(1, 0, 4, 6); g.fillRect(0, 1, 6, 4); g.fillStyle(0xffcf40, 1); g.fillRect(1, 1, 4, 4); g.fillStyle(0xfff4b0, 1); g.fillRect(2, 1, 1, 2); g.generateTexture('coin', 6, 6); g.destroy();
    makeFxTextures(this);
    this.scene.start('title');
  }
}

class Title extends Phaser.Scene {
  constructor() { super('title'); }
  create() {
    window.DC.phase = 'title'; this.switching = false;
    backdrop(this, 'bg_lava', 0.2);
    shadow(this, W / 2 + 120 + 94, LAVA_GROUND, 290); shadow(this, W / 2 - 300, LAVA_GROUND, 90);
    this.add.sprite(W / 2 + 120, LAVA_GROUND, 'dragon_idle').setScale(4).setOrigin(0.5, 1).play('dragon-idle');
    heroGlow(this.add.sprite(W / 2 - 300, LAVA_GROUND, 'hero_idle').setScale(3).setOrigin(0.5, 1).play('hero-idle'));
    panel(this, W / 2 - 330, 22, 660, 170);
    txt(this, W / 2, 82, t('title'), 80, '#ffd36a', { strokeThickness: 10, maxW: 620 });
    txt(this, W / 2, 142, t('sub1'), 28, '#ffffff', { maxW: 630 });
    txt(this, W / 2, 175, t('sub2'), 22, '#ff9a7a', { maxW: 630 });
    const tap = txt(this, W / 2, 575, t('tapStart'), 40, '#fff2c0', { maxW: 900 });
    this.langButton();
    this.tweens.add({ targets: tap, alpha: 0.35, yoyo: true, repeat: -1, duration: 650 });
    this.started = false;
    this.input.on('pointerup', (p, over) => {
      if (this.started || over.some((o) => o.getData && o.getData('lang'))) return;
      this.started = true;
      const snd = this.sound;
      const startMusic = () => {
        let m = snd.get('music');
        if (!m) { try { m = snd.add('music', { loop: true, volume: 0.35 }); } catch (e) { return; } }
        if (!m.isPlaying) { try { m.play(); } catch (e) {} }
      };
      const ctx = snd.context;
      if (ctx && ctx.state !== 'running') {
        try { const b = ctx.createBuffer(1, 1, 22050), src = ctx.createBufferSource(); src.buffer = b; src.connect(ctx.destination); src.start(0); } catch (e) {}
        const pr = ctx.resume && ctx.resume();
        if (pr && pr.then) pr.then(startMusic, startMusic);
      }
      if (snd.locked) snd.once('unlocked', startMusic);
      startMusic();
      setTimeout(startMusic, 600);
      sfx(this, 'click');
      this.scene.start('intro', { stage: 0, items: [], log: [] });
    });
  }
  // language switcher (top-right): tap to cycle, choice saved in localStorage
  langButton() {
    const c = this.add.container(1110, 34).setDepth(100);
    const g = this.add.graphics();
    g.fillStyle(0x140a18, 0.9); g.fillRoundedRect(-78, -22, 156, 44, 10); g.lineStyle(2, 0xd9a441, 1); g.strokeRoundedRect(-78, -22, 156, 44, 10);
    const label = txt(this, 0, 0, `◀ ${LANG_NAME[LANG]} ▶`, 20, '#fff2c0', { strokeThickness: 4, maxW: 140 });
    const hit = this.add.rectangle(0, 0, 156, 44, 0x000000, 0.001).setInteractive({ useHandCursor: true }).setData('lang', true);
    c.add([g, label, hit]);
    window.DC.lang = LANG;
    hit.on('pointerup', () => {
      if (this.switching) return; this.switching = true;
      const nx = LANGS[(LANGS.indexOf(LANG) + 1) % LANGS.length];
      setLang(nx); FONT = fontFor(nx); sfx(this, 'click');
      loadLangFont(nx).then(() => this.scene.restart(), () => this.scene.restart());
    });
  }
}

class Pick extends Phaser.Scene {
  constructor() { super('pick'); }
  init(data) { this.round = data.round; this.items = data.items; this.log = data.log || []; this.stage = Math.floor(this.round / RULES.picksPerStage); this.locked = true; this.done = false; this.canSkip = false; this.autoNext = null; this.dim = null; }
  create() {
    window.DC.phase = 'pick'; window.DC.round = this.round + 1; window.DC.stage = this.stage + 1; window.DC.reveal = null; window.DC.pickReady = false; window.DC.missed = null;
    this.tweens.timeScale = 1; this.time.timeScale = 1;
    fadeInMain(this);
    backdrop(this, 'bg_hoard', 0.45);
    const st = RULES.stages[this.stage], k = this.round % RULES.picksPerStage;
    panel(this, 170, 12, 520, 98);
    txt(this, 430, 40, t('stageRound', this.stage + 1, RULES.stages.length, k + 1, RULES.picksPerStage), 32, '#ffd36a', { maxW: 490 });
    // round pips: done / current / upcoming pick-1-of-3 rounds in this stage
    for (let r = 0; r < RULES.picksPerStage; r++) {
      const px = 206 + r * 30, done = r < k, cur = r === k;
      const pip = this.add.circle(px, 82, 9, done ? 0x8aff7a : cur ? 0xffd36a : 0x3a2a4a).setStrokeStyle(2, 0x140812);
      if (cur) this.tweens.add({ targets: pip, scale: 1.3, yoyo: true, repeat: -1, duration: 380 });
    }
    txt(this, 490, 82, t('next', t('boss')[this.stage], fmt(st.hp)), 19, '#f0e6ff', { strokeThickness: 4, maxW: 360 });
    this.prompt = txt(this, 430, 142, t('pickOne'), 38, '#ffffff', { strokeThickness: 8, maxW: 600 }).setAlpha(0);
    this.tip = new Tooltip(this, () => this.items);
    this.drawInventory();
    this.offer = rollOffer(Math.random); window.DC.offer = this.offer.map((o) => o.type);
    const xs = [170, 430, 690], base = 390;
    this.chests = this.offer.map((c, i) => {
      const x = xs[i];
      shadow(this, x, base, 160);
      const glow = this.add.circle(x, base - 80, 105, EL_COLOR[c.element], 0.16).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: glow, scale: 1.1, alpha: 0.26, yoyo: true, repeat: -1, duration: 900 + i * 120 });
      const spr = this.add.image(x, base + 12, 'chest_' + c.type).setScale(5).setOrigin(0.5, 1);
      const gem = this.add.star(x, base - 205, 4, 9, 20, EL_COLOR[c.element]).setStrokeStyle(3, 0x000000);
      this.tweens.add({ targets: gem, y: base - 213, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.inOut' });
      const label = txt(this, x, base + 32, t('chest')[c.type], 30, { wood: '#f0c08a', gold: '#ffd84a', black: '#c9a6ff' }[c.type], { maxW: 230 });
      const el = txt(this, x, base + 64, elName(c.element), 24, EL_CSS[c.element], { maxW: 230 });
      const zone = this.add.zone(x, base - 80, 220, 300).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.choose(i));
      zone.on('pointerover', () => { if (this.locked) return; this.tweens.add({ targets: spr, scale: 5.4, duration: 120 }); glow.setAlpha(0.45); });
      zone.on('pointerout', () => { if (this.locked) return; this.tweens.add({ targets: spr, scale: 5, duration: 120 }); glow.setAlpha(0.2); });
      // idle sparkle so chests feel alive without lifting off the ground
      const sp = this.add.particles(x, base - 70, 'px', { x: { min: -60, max: 60 }, y: { min: -50, max: 40 }, lifespan: 900, speedY: { min: -30, max: -10 }, scale: { start: 1.5, end: 0 }, frequency: 260, tint: EL_COLOR[c.element], blendMode: 'ADD' });
      // drop in from above with a bounce; the rest of the chest UI fades in when it lands
      spr.y = -120 - i * 60; [glow, gem, label, el].forEach((o) => o.setAlpha(0)); sp.stop();
      this.tweens.add({ targets: spr, y: base + 12, duration: 520, delay: 120 + i * 90, ease: 'Bounce.out', onComplete: () => {
        sfx(this, 'open', 0.25); burst(this, x, base, 0xffe0a0, 8, 160, 'px'); sp.start();
        this.tweens.add({ targets: [gem, label, el], alpha: 1, duration: 160 }); glow.setAlpha(0.16);
      } });
      return { c, x, y: base - 80, spr, glow, gem, label, el, zone, sp };
    });
    // "ROUND k/3" banner, then the PICK ONE prompt
    const ban = txt(this, 430, 260, t('round', k + 1, RULES.picksPerStage), 64, '#ffd36a', { strokeThickness: 10, stroke: '#4a2400', maxW: 640 }).setDepth(30);
    popText(this, ban, 1); sfx(this, 'banner', 0.4);
    this.tweens.add({ targets: ban, alpha: 0, y: 220, delay: 520, duration: 260, onComplete: () => ban.destroy() });
    this.time.delayedCall(800, () => {
      this.locked = false; window.DC.pickReady = true;
      this.prompt.setAlpha(1); popText(this, this.prompt, 1);
      this.tweens.add({ targets: this.prompt, y: 136, yoyo: true, repeat: -1, duration: 420, ease: 'Sine.inOut' });
    });
    this.input.on('pointerdown', (p, over) => { if (this.canSkip && !over.some((o) => o.getData && o.getData('item'))) this.next(); });
  }
  drawInventory() {
    const x0 = 880, y0 = 150;
    panel(this, x0 - 18, y0 - 30, 334, 488);
    this.bagT = txt(this, x0 + 149, y0 - 2, '', 24, '#ffd36a');
    this.counters = ELEMENTS.map((el, k) => {
      const cx = x0 - 4 + k * 98;
      this.add.star(cx + 6, y0 + 28, 4, 4, 9, EL_COLOR[el]).setStrokeStyle(2, 0x000000);
      return this.add.text(cx + 16, y0 + 28, '', { fontFamily: FONT, fontSize: '16px', color: EL_CSS[el], fontStyle: 'bold', stroke: '#140812', strokeThickness: 3 }).setOrigin(0, 0.5);
    });
    this.updateCounters();
    this.slots = this.items.length + (RULES.rounds - this.round); // picks still to come + gear so far (bonus drops add extra rows)
    this.rowH = this.slots > 9 ? 35 : 42; this.rowY = this.slots > 9 ? 212 : 220;
    for (let i = 0; i < this.slots; i++) this.addInvRow(i, this.items[i]);
  }
  updateCounters() {
    this.bagT.setText(t('bag', this.items.length, this.slots));
    ELEMENTS.forEach((el, k) => {
      const n = elemCount(this.items, el);
      this.counters[k].setText(`${elName(el)} ${Math.min(n, RULES.setCount)}/${RULES.setCount}`).setColor(n >= RULES.setCount ? '#ffffff' : EL_CSS[el]);
    });
  }
  addInvRow(i, it) {
    const x0 = 880, y = this.rowY + i * this.rowH, sm = this.rowH < 40, bx = sm ? 32 : 38;
    if (!it) { this.add.rectangle(x0 + 21, y, bx - 2, bx - 2, 0xffffff, 0.06).setStrokeStyle(1, 0x5a4a3a); return; }
    this.add.rectangle(x0 + 21, y, bx, bx, itemCol(it), 0.3).setStrokeStyle(2, it.bonus ? 0xffd36a : itemCol(it));
    this.tip.attach(this.add.image(x0 + 21, y, 'icons', it.frame).setScale(sm ? 0.88 : 1), it);
    clipText(this.add.text(x0 + 46, y - (sm ? 16 : 18), (it.bonus ? '★ ' : '') + it.name, { fontFamily: FONT, fontSize: (sm ? 15 : 16) + 'px', color: it.bonus ? '#ffe08a' : '#ffffff', fontStyle: 'bold' }), 250);
    const rt = this.add.text(x0 + 46, y + 1, ruleText(it), { fontFamily: FONT, fontSize: (sm ? 14 : 15) + 'px', color: it.kind === 'cursed' ? '#ff7a8a' : it.mult ? '#ffd84a' : '#b8f0a0' });
    fitText(rt, 250, sm ? 14 : 15);
  }
  forcedItem(ch) { // test hook: DC.force = 'EPIC' | 'LEGENDARY'
    const f = window.DC.force; if (!f) return null; window.DC.force = null;
    if (f === 'CURSED') { const [a, b] = span(105, RULES.black.cSpread); return { kind: 'cursed', element: ch.c.element, flat: -105, lo: -b, hi: -a, mult: 0 }; }
    const c = f === 'LEGENDARY' ? 270 : 200, [lo, hi] = span(c, RULES.black.wSpread);
    return { kind: 'weapon', element: ch.c.element, flat: c, lo, hi, mult: 0 };
  }
  choose(i) {
    if (this.locked) return; this.locked = true;
    const ch = this.chests[i];
    this.tweens.killTweensOf(this.prompt); this.tweens.add({ targets: this.prompt, alpha: 0, duration: 150 });
    window.DC.missed = [];
    this.chests.forEach((o, j) => { o.zone.disableInteractive(); o.sp.stop(); if (j !== i) this.reject(o); });
    sfx(this, 'click');
    const it = nameItem(this.forcedItem(ch) || openChest(ch.c, Math.random, this.stage));
    const tier = it.rarity, R = RARITY[tier], big = tier === 'EPIC' || tier === 'LEGENDARY', leg = tier === 'LEGENDARY';
    window.DC.reveal = { rarity: tier, stage: 'anticipation' };
    this.tweens.killTweensOf([ch.spr, ch.glow]); ch.spr.setScale(5).setDepth(11); ch.glow.setDepth(11);
    // colour hint: the chest glow shifts to the rarity colour while it charges
    const hint = tier === 'COMMON' ? EL_COLOR[ch.c.element] : R.col;
    ch.glow.setAlpha(0);
    ch.soft = this.add.image(ch.x, ch.y + 10, 'glowdot').setTint(hint).setBlendMode(Phaser.BlendModes.ADD).setDepth(11).setScale(big ? 2.25 : 1.75).setAlpha(0.5);
    this.tweens.add({ targets: ch.soft, scale: big ? 3 : 2, alpha: big ? 0.95 : 0.7, yoyo: true, repeat: -1, duration: big ? 170 : 260 });
    const dur = { COMMON: 330, RARE: 520, EPIC: 1000, LEGENDARY: 1450, CURSED: 800 }[tier];
    if (big) { this.dimIn(leg ? 0.62 : 0.5); sfx(this, 'charge', leg ? 0.9 : 0.7); }
    // light leaking from the lid seam, growing with the charge
    const leaks = [];
    const nLeak = { COMMON: 0, RARE: 3, EPIC: 5, LEGENDARY: 7, CURSED: 4 }[tier];
    for (let k = 0; k < nLeak; k++) {
      const a = -70 + (140 / Math.max(1, nLeak - 1)) * k + Phaser.Math.Between(-6, 6);
      const l = this.add.image(ch.x + Phaser.Math.Between(-40, 40), ch.y + 20, 'beam').setOrigin(0.5, 1).setAngle(a).setTint(hint)
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(12).setScale(0.25, 0).setAlpha(0.9);
      this.tweens.add({ targets: l, scaleY: { from: 0, to: big ? 1.1 : 0.6 }, duration: dur, delay: k * (dur / nLeak / 2), ease: 'Quad.in' });
      leaks.push(l);
    }
    // shake harder and harder
    const t0 = this.time.now, amp = { COMMON: 5, RARE: 6, EPIC: 9, LEGENDARY: 13, CURSED: 8 }[tier];
    const shaker = this.time.addEvent({ delay: 33, loop: true, callback: () => {
      const p = Math.min(1, (this.time.now - t0) / dur), a = amp * (0.35 + p);
      ch.spr.setPosition(ch.x + Phaser.Math.FloatBetween(-a, a), ch.y + 80 + 12 + Phaser.Math.FloatBetween(-a * 0.4, 0));
      ch.spr.setAngle(Phaser.Math.FloatBetween(-a * 0.25, a * 0.25));
    } });
    if (big) this.cameras.main.shake(dur, leg ? 0.004 : 0.0025);
    this.time.delayedCall(dur, () => { shaker.remove(); ch.spr.setPosition(ch.x, ch.y + 92).setAngle(0); leaks.forEach((l) => this.tweens.add({ targets: l, alpha: 0, duration: 200, onComplete: () => l.destroy() })); this.reveal(ch, it); });
  }
  // the two chests you did NOT pick: pop open greyed out to show what you missed, then sink away (~1s)
  reject(o) {
    const miss = nameItem(openChest(o.c, Math.random, this.stage));
    window.DC.missed.push({ name: miss.name, rule: ruleText(miss), rarity: miss.rarity });
    this.tweens.killTweensOf([o.spr, o.glow, o.gem]);
    this.tweens.add({ targets: [o.glow, o.gem], alpha: 0, duration: 150 });
    this.time.delayedCall(110, () => {
      o.spr.setTexture('open_' + o.c.type).setTint(0x6a6a6a);
      this.tweens.add({ targets: o.spr, angle: { from: -6, to: 0 }, duration: 160 });
      const ic = this.add.image(o.x, o.y + 10, 'icons', miss.frame).setScale(1.2).setTint(0x8a8a8a).setAlpha(0.9).setDepth(5);
      const rt = txt(this, o.x, o.y - 158, ruleText(miss), 18, '#a8a0b0', { strokeThickness: 4, maxW: 230 }).setDepth(5).setAlpha(0);
      const ms = txt(this, o.x, o.y - 182, t('missed'), 16, '#8a7a9a', { strokeThickness: 3, maxW: 230 }).setDepth(5).setAlpha(0);
      this.tweens.add({ targets: ic, y: o.y - 110, scale: 2.2, duration: 260, ease: 'Back.out' });
      this.tweens.add({ targets: [rt, ms], alpha: 1, duration: 180, delay: 120 });
      // sink + fade
      this.time.delayedCall(750, () => {
        this.tweens.add({ targets: [o.spr, o.label, o.el], y: '+=46', alpha: 0, duration: 320, ease: 'Quad.in' });
        this.tweens.add({ targets: [ic, rt, ms], alpha: 0, y: '-=16', duration: 320 });
      });
    });
  }
  dimIn(a) {
    if (this.dim) return;
    this.dim = this.add.rectangle(-100, -100, W + 200, H + 200, 0x05030a, 1).setOrigin(0).setDepth(10).setAlpha(0);
    this.vig = this.add.image(W / 2, H / 2, 'vig').setDisplaySize(W + 40, H + 40).setDepth(10).setAlpha(0);
    this.tweens.add({ targets: this.dim, alpha: a, duration: 450 }); this.tweens.add({ targets: this.vig, alpha: 1, duration: 450 });
  }
  dimOut(delay) {
    if (!this.dim) return;
    this.tweens.add({ targets: [this.dim, this.vig], alpha: 0, duration: 600, delay });
  }
  slowMo(scale, ms) { // slow every tween in the scene for `ms` real milliseconds
    this.tweens.timeScale = scale; this.time.timeScale = scale;
    setTimeout(() => { if (this.tweens) { this.tweens.timeScale = 1; this.time.timeScale = 1; } }, ms);
  }
  reveal(ch, it) {
    this.items.push(it);
    const tier = it.rarity, R = RARITY[tier], big = tier === 'EPIC' || tier === 'LEGENDARY', leg = tier === 'LEGENDARY';
    const lite = this.scale.displaySize.width < 700 ? 0.6 : 1; // fewer particles on small screens
    const N = (n) => Math.max(4, Math.round(n * lite));
    const cam = this.cameras.main;
    window.DC.reveal = { rarity: tier, stage: 'pop' };
    ch.spr.setTexture('open_' + ch.c.type);
    this.tweens.killTweensOf(ch.soft); ch.soft.setScale(big ? 4 : 2.5).setAlpha(1); this.tweens.add({ targets: ch.soft, scale: big ? 2.75 : 2, alpha: 0.55, duration: 900, ease: 'Quad.out' });
    const iy = ch.y - (big ? 170 : 150), D = 13;
    // hit-stop: freeze a beat on the pop (bigger = longer), then slow motion
    if (big) {
      this.tweens.pauseAll(); this.anims.pauseAll();
      setTimeout(() => { if (this.tweens) { this.tweens.resumeAll(); this.anims.resumeAll(); this.slowMo(leg ? 0.3 : 0.45, leg ? 900 : 450); } }, leg ? 170 : 100);
    }
    // god-ray pillar
    if (tier !== 'COMMON') {
      const pil = this.add.image(ch.x, ch.y + 40, 'beam').setOrigin(0.5, 1).setTint(R.col).setBlendMode(Phaser.BlendModes.ADD).setDepth(D)
        .setScale(0, big ? 3 : 2).setAlpha(big ? 1 : 0.7);
      this.tweens.add({ targets: pil, scaleX: { from: 0, to: big ? (leg ? 2.4 : 1.8) : 1 }, duration: 260, ease: 'Quad.out' });
      this.tweens.add({ targets: pil, alpha: 0, scaleX: 0.2, delay: big ? 1300 : 700, duration: 700, onComplete: () => pil.destroy() });
    }
    // rotating rays behind the item
    if (tier !== 'COMMON') {
      const rays = this.add.image(ch.x, iy, 'rays').setTint(R.col).setBlendMode(Phaser.BlendModes.ADD).setDepth(D).setScale(0).setAlpha(big ? 0.9 : 0.55);
      this.tweens.add({ targets: rays, scale: big ? (leg ? 1.9 : 1.5) : 1, duration: 420, ease: 'Back.out' });
      this.tweens.add({ targets: rays, angle: 360, duration: leg ? 5000 : 7000, repeat: -1 });
      if (leg) { const r2 = this.add.image(ch.x, iy, 'rays').setTint(0xffffff).setBlendMode(Phaser.BlendModes.ADD).setDepth(D).setScale(1.2).setAlpha(0.35); this.tweens.add({ targets: r2, angle: -360, duration: 9000, repeat: -1 }); }
    }
    // shockwave ring(s)
    const ring = (delay, w, to) => {
      const r = this.add.circle(ch.x, ch.y, 30).setStrokeStyle(w, R.col, 1).setDepth(D + 1).setBlendMode(Phaser.BlendModes.ADD);
      r.isFilled = false;
      this.tweens.add({ targets: r, scale: to, alpha: { from: 1, to: 0 }, delay, duration: 650, ease: 'Cubic.out', onComplete: () => r.destroy() });
    };
    ring(0, big ? 10 : 6, big ? 9 : 2 + R.n / 10);
    if (leg) ring(180, 6, 13);
    // radial burst + lingering sparkles
    burst(this, ch.x, ch.y - 10, R.col, N(big ? R.n * 1.6 : R.n), 200 + R.n * (big ? 7 : 4)).setDepth(D + 2);
    if (tier !== 'COMMON') burst(this, ch.x, ch.y - 10, itemCol(it), N(R.n / 2), 180, 'px').setDepth(D + 2);
    if (tier !== 'COMMON') {
      const lin = this.add.particles(ch.x, iy, 'glowdot', {
        x: { min: -90, max: 90 }, y: { min: -80, max: 80 }, lifespan: { min: 600, max: 1200 }, speedY: { min: -40, max: -10 },
        scale: { start: big ? 0.09 : 0.065, end: 0 }, alpha: { start: 1, end: 0 }, tint: [R.col, 0xffffff], blendMode: 'ADD', frequency: big ? 45 / lite : 110 / lite,
      }).setDepth(D + 2);
      this.time.delayedCall(big ? 2600 : 1500, () => lin.stop()); this.time.delayedCall(big ? 4000 : 2800, () => lin.destroy());
    }
    // flash + shake
    if (leg) { softFlash(this, 0xffe6a0, 0.25, 260); cam.shake(650, 0.02); }
    else if (tier === 'EPIC') cam.shake(380, 0.011);
    else if (tier === 'CURSED') cam.shake(300, R.shake);
    // legendary: coin + confetti shower
    if (leg) {
      const cols = [0xffcf40, 0xff5a8a, 0x5ad2ff, 0x8aff7a, 0xd58cff, 0xffffff];
      const coins = this.add.particles(0, -20, 'coin', { x: { min: 20, max: 840 }, lifespan: 2200, speedY: { min: 120, max: 260 }, speedX: { min: -40, max: 40 }, gravityY: 260, rotate: { min: 0, max: 360 }, scale: { min: 1.4, max: 2.2 }, frequency: 28 / lite, quantity: 1 }).setDepth(D + 3);
      const conf = this.add.particles(0, -20, 'conf', { x: { min: 20, max: 840 }, lifespan: 2600, speedY: { min: 80, max: 200 }, speedX: { min: -80, max: 80 }, gravityY: 140, rotate: { start: 0, end: 720 }, scale: { min: 1.5, max: 2.5 }, tint: cols, frequency: 22 / lite, quantity: 1 }).setDepth(D + 3);
      this.time.delayedCall(1700, () => { coins.stop(); conf.stop(); });
      this.time.delayedCall(4600, () => { coins.destroy(); conf.destroy(); });
    }
    // sound
    sfx(this, 'open');
    if (leg) { sfx(this, 'legendary', 0.95); sfx(this, 'rare', 0.6); }
    else if (tier === 'EPIC') { sfx(this, 'epic', 0.85); sfx(this, 'rare', 0.45); }
    else sfx(this, it.kind === 'cursed' ? 'curse' : tier === 'COMMON' ? 'open' : 'rare', tier === 'COMMON' ? 0.4 : 0.7);
    // item rises with glow and a bounce
    const icon = this.tip.attach(this.add.image(ch.x, ch.y, 'icons', it.frame).setScale(1).setDepth(D + 4), it);
    if (tier !== 'COMMON') { try { if (icon.preFX) icon.preFX.addGlow(R.col, big ? 6 : 3, 0, false, 0.1, 12); } catch (e) {} }
    const sc = leg ? 4 : big ? 3.6 : 3;
    this.tweens.add({ targets: icon, y: iy, scale: sc, duration: big ? 520 : 450, ease: 'Back.out', onComplete: () => {
      if (big) this.tweens.add({ targets: icon, y: iy - 8, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.inOut' });
    } });
    // rarity banner with a shine sweep
    if (big) {
      this.time.delayedCall(leg ? 260 : 200, () => {
        const label = leg ? t('banLeg') : t('banEpic'), size = leg ? 66 : 70;
        const bw = Math.min(820, label.length * size * (CJK_FONT[LANG] ? 1 : 0.62));
        const bx = Phaser.Math.Clamp(ch.x, bw / 2 + 12, 856 - bw / 2);
        const ban = txt(this, bx, ch.y + 64, label, size, R.css, { strokeThickness: 12, stroke: leg ? '#4a2400' : '#2a0a40', maxW: 820 }).setDepth(D + 5);
        try { if (ban.preFX) { ban.preFX.addShine(leg ? 0.9 : 0.7, 0.35, 4); ban.preFX.addGlow(R.col, 4, 0, false, 0.1, 10); } } catch (e) {}
        popText(this, ban, 1); sfx(this, 'banner', 0.7);
        this.tweens.add({ targets: ban, angle: { from: -4, to: 4 }, yoyo: true, repeat: -1, duration: 500, ease: 'Sine.inOut' });
        window.DC.reveal = { rarity: tier, stage: 'banner' };
      });
      this.dimOut(leg ? 1900 : 1400);
    }
    // item card with the item's own damage rule
    this.time.delayedCall(big ? (leg ? 700 : 560) : 0, () => {
      const card = this.add.container(430, 540).setDepth(20);
      const pg = panel(this, -330, -62, 660, 124, { border: R.col });
      const tag = txt(this, -250, -38, t('rar')[tier], 16, R.css, { strokeThickness: 4, maxW: 130 });
      const t1 = txt(this, 40, -36, it.name, 28, it.kind === 'cursed' ? '#d9a6ff' : EL_CSS[it.element], { maxW: 480 });
      const t2 = txt(this, 0, 2, ruleText(it), 32, it.kind === 'cursed' ? '#ff6a7a' : it.mult ? '#ffd84a' : '#b8f0a0', { maxW: 620 });
      const t3 = txt(this, 0, 38, setLine(it, this.items), 18, EL_CSS[it.element], { strokeThickness: 4, maxW: 630 });
      card.add([pg, tag, t1, t2, t3]); card.setAlpha(0);
      this.tweens.add({ targets: card, alpha: 1, duration: 150 }); popText(this, card, 1);
    });
    this.addInvRow(this.items.length - 1, it);
    this.updateCounters();
    // tap anywhere to skip once the reveal has landed
    setTimeout(() => { this.canSkip = true; if (window.DC.reveal) window.DC.reveal.skippable = true; }, big ? (leg ? 1000 : 750) : 350);
    this.autoNext = this.time.delayedCall({ COMMON: 1900, RARE: 2200, CURSED: 2200, EPIC: 2400, LEGENDARY: 2700 }[tier], () => this.next(true));
  }
  next(fromTimer) {
    if (this.done) return;
    if (fromTimer && this.tip && this.tip.visible) { this.autoNext = this.time.delayedCall(600, () => this.next(true)); return; } // let players read
    this.done = true; if (this.tip) this.tip.hide(true);
    this.tweens.timeScale = 1; this.time.timeScale = 1; this.tweens.resumeAll(); this.anims.resumeAll();
    if (this.autoNext) this.autoNext.remove();
    const r = this.round + 1;
    if (r % RULES.picksPerStage === 0) this.scene.start('strike', { stage: r / RULES.picksPerStage - 1, items: this.items, log: this.log });
    else this.scene.start('pick', { round: r, items: this.items, log: this.log });
  }
}

// Stage card before each stage's chests: who is next, how much HP, gear carried over
class Intro extends Phaser.Scene {
  constructor() { super('intro'); }
  init(d) { this.stage = d.stage; this.items = d.items; this.log = d.log || []; this.gone = false; }
  create() {
    window.DC.phase = 'intro'; window.DC.stage = this.stage + 1;
    this.tweens.timeScale = 1; this.time.timeScale = 1;
    fadeInMain(this);
    const st = RULES.stages[this.stage], c = BOSSES[this.stage], last = this.stage === RULES.stages.length - 1;
    backdrop(this, 'bg_lava', 0.55);
    this.add.image(W / 2, H / 2, 'vig').setDisplaySize(W + 40, H + 40).setAlpha(0.9);
    const bx = 860, sc = c.scale * (this.stage === 2 ? 0.8 : 1);
    shadow(this, bx + (c.body[0] - c.fw / 2) * sc, LAVA_GROUND, c.body[1] * sc * 1.05);
    const boss = this.add.sprite(bx + 260, LAVA_GROUND, c.tex).setScale(sc).setOrigin(0.5, 1).play(c.anim).setAlpha(0);
    this.tweens.add({ targets: boss, x: bx, alpha: 1, duration: 520, ease: 'Back.out' });
    try { if (boss.preFX) boss.preFX.addGlow(Phaser.Display.Color.HexStringToColor(c.col).color, 2, 0, false, 0.1, 8); } catch (e) {}
    // stage pips
    for (let k = 0; k < RULES.stages.length; k++) {
      const done = k < this.stage, cur = k === this.stage;
      const pip = this.add.star(330 + (k - 1) * 70, 70, 5, 10, 24, done ? 0x8aff7a : cur ? 0xffd36a : 0x4a3a5a).setStrokeStyle(3, 0x140812);
      if (cur) this.tweens.add({ targets: pip, scale: 1.25, yoyo: true, repeat: -1, duration: 420 });
    }
    const t1 = txt(this, 330, 150, t('stage', this.stage + 1, RULES.stages.length), 72, '#ffd36a', { strokeThickness: 10, maxW: 600 });
    popText(this, t1, 1);
    try { if (t1.preFX) t1.preFX.addShine(0.8, 0.3, 4); } catch (e) {}
    const t2 = txt(this, 330, 236, t('boss')[this.stage], 50, c.col, { strokeThickness: 8, maxW: 600 }); t2.setAlpha(0);
    this.tweens.add({ targets: t2, alpha: 1, x: { from: 250, to: 330 }, duration: 380, delay: 200, ease: 'Quad.out' });
    const t3 = txt(this, 330, 296, `HP ${fmt(st.hp)}`, 40, '#ff5a4a'); t3.setAlpha(0);
    this.tweens.add({ targets: t3, alpha: 1, duration: 300, delay: 420 });
    txt(this, 330, 360, t('openChests', RULES.picksPerStage), 26, '#ffffff', { maxW: 600 });
    txt(this, 330, 398, this.items.length ? t('carry', this.items.length) : t('carry0'), 22, '#b8f0a0', { strokeThickness: 4, maxW: 600 });
    if (last) txt(this, 330, 434, t('finalBoss'), 22, '#ff9a7a', { strokeThickness: 4, maxW: 600 });
    const tap = txt(this, 330, 520, t('tapCont'), 30, '#fff2c0', { maxW: 600 });
    this.tweens.add({ targets: tap, alpha: 0.35, yoyo: true, repeat: -1, duration: 600 });
    sfx(this, 'stage', 0.7); if (this.stage) sfx(this, 'charge', 0.4);
    this.cameras.main.fadeIn(300, 0, 0, 0);
    this.time.delayedCall(600, () => this.input.once('pointerdown', () => this.go()));
    this.time.delayedCall(4200, () => this.go());
  }
  go() {
    if (this.gone) return; this.gone = true;
    this.scene.start('pick', { round: this.stage * RULES.picksPerStage, items: this.items, log: this.log });
  }
}

class Strike extends Phaser.Scene {
  constructor() { super('strike'); }
  init(d) {
    this.stage = d.stage; this.items = d.items; this.log = d.log || []; this.struck = false; this.leaving = false;
    this.cfg = BOSSES[this.stage]; this.st = RULES.stages[this.stage]; this.hpMax = this.st.hp;
  }
  create() {
    window.DC.phase = 'strike'; window.DC.stage = this.stage + 1; window.DC.overkill = 0; window.DC.popped = 0; window.DC.bonus = null; window.DC.bonusShown = false;
    this.tweens.timeScale = 1; this.time.timeScale = 1;
    fadeInMain(this);
    backdrop(this, 'bg_lava', 0.12);
    const res = this.res = computeDamage(this.items, Math.random); // each item rolls inside its ATK range
    res.ratio = res.total / this.hpMax; res.L = okLevel(res.total, this.hpMax); res.hp = this.hpMax;
    window.DC.result = res;
    this.tip = new Tooltip(this, () => this.items);
    const c = this.cfg;
    this.bShadow = shadow(this, c.x, LAVA_GROUND, c.body[1] * c.scale * 1.05);
    this.hShadow = shadow(this, 230, LAVA_GROUND, 90);
    this.boss = this.add.sprite(c.x, LAVA_GROUND, c.tex).setScale(c.scale).setOrigin(0.5, 1).play(c.anim);
    this.hero = this.add.sprite(230, LAVA_GROUND, 'hero_idle').setScale(3).setOrigin(0.5, 1).play('hero-idle');
    heroGlow(this.hero);
    panel(this, 640, 14, 440, 140);
    txt(this, 860, 40, t('stage', this.stage + 1, RULES.stages.length), 20, '#ffd36a', { strokeThickness: 4, maxW: 400 });
    txt(this, 860, 76, t('boss')[this.stage], 34, c.col, { maxW: 410 });
    this.add.rectangle(860, 120, 400, 28, 0x220000).setStrokeStyle(3, 0xffd36a);
    this.hp = this.add.rectangle(662, 120, 396, 22, 0xd22a2a).setOrigin(0, 0.5);
    this.hpText = txt(this, 860, 120, `${fmt(this.hpMax)} / ${fmt(this.hpMax)}`, 20);
    this.gearPanel = panel(this, 8, 560, this.items.length * 50 + 16, 60);
    this.items.forEach((it, i) => {
      this.add.rectangle(40 + i * 50, 590, 42, 42, itemCol(it), 0.3).setStrokeStyle(2, it.bonus ? 0xffd36a : itemCol(it));
      this.tip.attach(this.add.image(40 + i * 50, 590, 'icons', it.frame), it);
    });
    this.ready = txt(this, 250, 190, t('ready', this.items.length), 28, '#ffffff', { maxW: 460 });
    this.btn = button(this, 250, 262, t('strike'), () => this.strike(), 240);
    window.DC.phase = 'strike-ready';
  }
  update() { // shadows stay glued to the feet
    if (this.hero) { this.hShadow.x = this.hero.x; this.hShadow.setVisible(this.hero.visible && this.hero.alpha > 0.2); this.hShadow.scaleX = this.hero.scaleX / 3; }
    if (this.boss && this.boss.active) { const c = this.cfg, k = this.boss.scaleX; this.bShadow.x = this.boss.x + (c.body[0] - c.fw / 2) * k; this.bShadow.scaleX = k / c.scale; }
  }
  pt(p) { const c = this.cfg; return { x: c.x + (p[0] - c.fw / 2) * c.scale, y: LAVA_GROUND - (c.fh - p[1]) * c.scale }; }
  head() { return this.pt(this.cfg.head); }
  strike() {
    if (this.struck) return; this.struck = true; window.DC.phase = 'striking';
    this.btn.destroy(); this.ready.destroy();
    this.tip.hide(true);
    this.charge();
  }
  charge() {
    window.DC.phase = 'striking';
    const r = this.res, hd = this.head();
    this.hero.play('hero-run');
    this.cameras.main.zoomTo(1.06, 500, 'Sine.easeInOut');
    this.cameras.main.pan(W / 2 + 40, 330, 500, 'Sine.easeInOut');
    this.tweens.add({
      targets: this.hero, x: hd.x - 130, duration: 470, ease: 'Quad.in', onComplete: () => {
        sfx(this, 'swing');
        this.hero.play('hero-attack');
        this.time.delayedCall(140, () => this.impact(r));
        this.hero.once('animationcomplete', () => this.hero.play('hero-idle'));
      },
    });
  }
  lite() { return this.scale.displaySize.width < 700 ? 0.6 : 1; }
  hitStop(ms) { // freeze everything for a beat (real time)
    this.tweens.pauseAll(); this.anims.pauseAll();
    setTimeout(() => { if (this.tweens) { this.tweens.resumeAll(); this.anims.resumeAll(); } }, ms);
  }
  ring(x, y, col, w, to, delay = 0, dur = 650) {
    const r = this.add.circle(x, y, 30).setStrokeStyle(w, col, 1).setDepth(40).setBlendMode(Phaser.BlendModes.ADD);
    r.isFilled = false;
    this.tweens.add({ targets: r, scale: to, alpha: { from: 1, to: 0 }, delay, duration: dur, ease: 'Cubic.out', onComplete: () => r.destroy() });
  }
  impact(r) {
    window.DC.phase = 'impact';
    const L = r.L, cam = this.cameras.main, hd = this.head(), N = (n) => Math.max(4, Math.round(n * this.lite()));
    window.DC.head = hd;
    sfx(this, 'hit', 0.9);
    cam.shake(300, 0.02);
    this.boss.setTintFill(0xffffff); this.time.delayedCall(110, () => this.boss.clearTint());
    this.slash(hd.x, hd.y);
    burst(this, hd.x, hd.y, 0xffd36a, N(40), 380).setDepth(41);
    burst(this, hd.x, hd.y, 0xff5a2a, N(20), 280, 'px').setDepth(41);
    this.hitStop(90);
    // live damage counter (nothing is revealed before the blade lands)
    const TX = this.TX = 500, TY = this.TY = 180;
    this.rays = this.add.image(TX, TY, 'rays').setTint(0xffd36a).setBlendMode(Phaser.BlendModes.ADD).setDepth(43).setScale(0).setAlpha(0);
    this.tweens.add({ targets: this.rays, angle: 360, duration: 6000, repeat: -1 });
    this.dmgLabel = txt(this, TX, TY - 66, t('damage'), 22, '#ffe8b0', { strokeThickness: 5 }).setDepth(46);
    this.dmg = txt(this, TX, TY, '0', 84, '#ffffff', { strokeThickness: 12 }).setDepth(46);
    popText(this, this.dmg, 1);
    this.br = txt(this, TX, TY + 56, '', 20, '#ffffff', { strokeThickness: 4, maxW: 560 }).setDepth(45);
    this.dmgScale = 1; this.shown = 0;
    // damage steps: hero's swing, every flat item's roll, then multipliers, then the set bonus
    const its = this.items, steps = [{ kind: 'base', v: RULES.baseAtk }];
    its.forEach((it, i) => { if (!it.mult) steps.push({ kind: 'flat', it, v: r.rolls[i] }); });
    its.forEach((it) => { if (it.mult) steps.push({ kind: 'mult', it, v: it.mult }); });
    if (r.set > 1) steps.push({ kind: 'set', v: r.set });
    let flat = 0, mult = 0, set = 1, shown = 0, next = 1;
    const value = () => Math.round(Math.max(0, Math.round(flat)) * (1 + Math.round(mult * 10) / 10) * set);
    const show = (v) => {
      this.dmg.setText(fmt(v));
      const left = Math.max(0, this.hpMax - v);
      this.hp.width = 396 * left / this.hpMax; this.hpText.setText(`${fmt(left)} / ${fmt(this.hpMax)}`);
      while (next <= L && v >= OK_TIERS[next].at * this.hpMax) { this.pulse(next, v); next++; }
    };
    window.DC.popped = 0;
    const runStep = (k) => {
      if (k >= steps.length) return this.afterCount(r, show, () => next);
      const s = steps[k];
      if (s.kind === 'base' || s.kind === 'flat') flat += s.v; else if (s.kind === 'mult') mult += s.v; else set = s.v;
      const target = k === steps.length - 1 ? r.total : value();
      this.popNumber(s, k);
      window.DC.popped = k + 1;
      const c = { v: shown }, gap = Math.max(130, 300 - k * 22);
      this.tweens.add({ targets: c, v: target, duration: gap * 0.8, ease: 'Cubic.out', onUpdate: () => show(Math.round(c.v)),
        onComplete: () => { shown = target; show(target); } });
      this.time.delayedCall(gap, () => runStep(k + 1));
    };
    this.time.delayedCall(260, () => runStep(0));
    this.tweens.add({ targets: this.hero, x: hd.x - 300, duration: 500, delay: 300, ease: 'Quad.out' });
  }
  // one floating number bursting out of the boss
  popNumber(s, k) {
    const hd = this.head(), x = hd.x + ((k % 3) - 1) * 85 + Phaser.Math.Between(-15, 15), y = hd.y - 30 - (k % 2) * 55 + Phaser.Math.Between(-10, 10);
    let label, col, size;
    if (s.kind === 'base') { label = `+${s.v}`; col = '#ffffff'; size = 30; }
    else if (s.kind === 'flat') {
      const neg = s.v < 0; label = (neg ? '' : '+') + s.v;
      col = neg ? '#c890ff' : EL_CSS[s.it.element]; size = Math.round(28 + Math.min(30, Math.abs(s.v) / 9));
    } else if (s.kind === 'mult') { label = `+${s.v.toFixed(1)}x`; col = '#ffd84a'; size = 44; }
    else { label = t('setPop', s.v); col = '#ffffff'; size = 56; }
    const fl = txt(this, x, y, label, size, col, { strokeThickness: Math.max(6, size / 6) }).setDepth(44);
    fl.setScale(0.2);
    this.tweens.add({ targets: fl, scale: 1, duration: 140, ease: 'Back.out' });
    this.tweens.add({ targets: fl, y: y - 90 - Phaser.Math.Between(0, 40), x: x + Phaser.Math.Between(-30, 30), alpha: { from: 1, to: 0 }, delay: 260, duration: 700, ease: 'Quad.in', onComplete: () => fl.destroy() });
    // the boss flinches with every number
    const neg = s.kind === 'flat' && s.v < 0;
    this.boss.setTint(neg ? 0xc090ff : 0xffd0b0); this.time.delayedCall(70, () => this.boss.clearTint());
    this.tweens.add({ targets: this.boss, x: this.cfg.x + (neg ? -4 : 6), yoyo: true, duration: 45 });
    burst(this, x, y, neg ? CURSE_COL : s.kind === 'mult' || s.kind === 'set' ? 0xffd84a : (s.it ? EL_COLOR[s.it.element] : 0xffffff), Math.max(4, Math.round((s.kind === 'set' ? 30 : 12) * this.lite())), 240, 'px').setDepth(43);
    sfx(this, neg ? 'curse' : s.kind === 'set' || s.kind === 'mult' ? 'banner' : 'tick', neg ? 0.35 : s.kind === 'set' ? 0.7 : 0.55);
    if (s.kind === 'set') { this.cameras.main.shake(200, 0.012); this.ring(x, y, 0xffd84a, 8, 5); }
    else if (!neg && s.kind === 'flat' && s.v >= 150) { sfx(this, 'hit', 0.45); this.cameras.main.shake(120, 0.008); }
  }
  afterCount(r, show, getNext) {
    show(r.total); this.dmg.setText(fmt(r.total));
    const parts = [`${t('atk')} ${r.flat}`, `x${(1 + r.mult).toFixed(1)}`]; if (r.set > 1) parts.push(t('setPart', r.set, elName(r.setEl)));
    setFit(this.br, parts.join('   ') + `  =  ${fmt(r.total)}`);
    this.finalLabel(r);
    window.DC.phase = 'impact-done';
    const L = r.L, cam = this.cameras.main;
    this.time.delayedCall(800 + 220 * L, () => {
      cam.zoomTo(1, 400); cam.pan(W / 2, H / 2, 400);
      this.time.delayedCall(420, () => L >= 1 ? this.killSeq(r) : this.loseSeq());
    });
  }
  // escalating hit at each overkill threshold
  pulse(L, v) {
    const T = OK_TIERS[L], cam = this.cameras.main, hd = this.head(), N = (n) => Math.max(4, Math.round(n * this.lite()));
    this.shown = L; window.DC.overkill = L;
    this.dmgScale = T.font / 84;
    this.dmg.setColor(T.css);
    this.tweens.killTweensOf(this.dmg);
    this.dmg.setScale(this.dmgScale * 1.5);
    this.tweens.add({ targets: this.dmg, scale: this.dmgScale, duration: 220, ease: 'Back.out' });
    this.tweens.add({ targets: this.dmg, angle: { from: L % 2 ? -6 : 6, to: 0 }, duration: 260 });
    if (L === 1) { // HP hits zero
      sfx(this, 'hit', 1); sfx(this, 'banner', 0.5);
      cam.shake(260, T.shake);
      this.hp.setFillStyle(0xffffff); this.time.delayedCall(90, () => this.hp.setFillStyle(0xd22a2a));
      this.boss.setTint(0xff6a5a); this.time.delayedCall(120, () => this.boss.clearTint());
      burst(this, hd.x, hd.y, T.col, N(40), 380).setDepth(41);
      return;
    }
    // L >= 2: overkill tiers
    sfx(this, T.snd, 0.75 + 0.08 * L); if (L >= 3) sfx(this, 'hit', 1);
    this.hitStop(T.stop);
    cam.shake(380 + L * 140, T.shake);
        if (L === 4) softFlash(this, T.col, 0.28, 240); // the only strike flash: soft, tinted, top tier
    cam.zoomTo(1.06 + 0.04 * L, 90, 'Quad.out', true);
    this.time.delayedCall(200, () => cam.zoomTo(1.06, 260, 'Sine.easeOut', true));
    this.boss.setTint(0xffc0a0); this.time.delayedCall(80 + L * 30, () => this.boss.clearTint());
    this.tweens.add({ targets: this.boss, x: this.boss.x + 10 * L, yoyo: true, duration: 70, repeat: 1 });
    this.slash(hd.x, hd.y, 1 + 0.3 * (L - 1), T.col);
    for (let k = 0; k < L - 1; k++) this.ring(hd.x, hd.y, T.col, 8 - k * 2, 5 + k * 3 + L * 2, k * 120, 600);
    burst(this, hd.x, hd.y, T.col, N(40 * T.n), 300 + 120 * L).setDepth(41);
    burst(this, hd.x, hd.y, 0xffffff, N(20 * T.n), 500 + 80 * L, 'px').setDepth(41);
    this.rays.setTint(T.col); this.tweens.add({ targets: this.rays, scale: 1.2 + 0.5 * L, alpha: 0.25 + 0.08 * L, duration: 260, ease: 'Back.out' });
    // overkill label for this tier
    if (this.okT) this.okT.destroy();
    const ratio = Math.max(OK_TIERS[L].at, v / this.hpMax);
    this.okT = txt(this, this.TX, this.TY + 104, okLabel(L, ratio), 30 + 8 * L, T.css, { strokeThickness: 8, stroke: '#1a0410', maxW: 600 }).setDepth(47);
    try { if (this.okT.preFX) { this.okT.preFX.addGlow(T.col, 3, 0, false, 0.1, 10); if (L >= 3) this.okT.preFX.addShine(0.9, 0.35, 4); } } catch (e) {}
    popText(this, this.okT, 1);
    this.tweens.add({ targets: this.okT, angle: { from: -3, to: 3 }, yoyo: true, repeat: -1, duration: 300 });
    if (L === 4) { // GODLIKE: screen-wide lightning-ish white beams
      for (let k = 0; k < 5; k++) {
        const b = this.add.image(hd.x + Phaser.Math.Between(-260, 260), LAVA_GROUND + 40, 'beam').setOrigin(0.5, 1).setTint(k % 2 ? 0xffffff : T.col)
          .setBlendMode(Phaser.BlendModes.ADD).setDepth(42).setScale(0.6, 1.4).setAlpha(0);
        this.tweens.add({ targets: b, alpha: { from: 0.6, to: 0 }, scaleX: 0.1, duration: 600, delay: k * 70, onComplete: () => b.destroy() });
      }
    }
  }
  finalLabel(r) {
    const L = r.L;
    if (L >= 2) { if (this.okT) setFit(this.okT, okLabel(L, r.ratio)); }
    else {
      const lbl = txt(this, this.TX, this.TY + 100, L === 1 ? t('kill') : t('notEnough', fmt(r.total), fmt(this.hpMax)), L === 1 ? 46 : 30, OK_TIERS[L].css, { strokeThickness: 8, maxW: 600 }).setDepth(47);
      popText(this, lbl, 1); this.okT = lbl;
    }
    if (L >= 1) {
      const over = r.total - this.hpMax;
      if (over > 0) setFit(this.br, `${this.br.text}   ${t('overTail', fmt(over))}`);
    }
  }
  slash(x, y, k0 = 1, col = 0xffd36a) { // crescent arcs centred on the head
    for (let k = 0; k < 3; k++) {
      const g = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(40);
      g.lineStyle((14 - k * 4) * k0, k === 0 ? 0xffffff : col, 1 - k * 0.25);
      g.beginPath(); g.arc(x, y, (62 + k * 16) * k0, Phaser.Math.DegToRad(-150), Phaser.Math.DegToRad(30), false); g.strokePath();
      g.setAlpha(0);
      this.tweens.add({ targets: g, alpha: { from: 1, to: 0 }, duration: 380, delay: k * 50, onComplete: () => g.destroy() });
    }
  }
  // blow the boss sprite apart into chunks of its current frame
  shatter(cols, rows, power) {
    const b = this.boss, c = this.cfg, f = b.frame, tex = b.texture, s = b.scaleX;
    const cw = Math.ceil(c.fw / cols), ch = Math.ceil(c.fh / rows), x0 = b.x - c.fw * s / 2, y0 = b.y - c.fh * s;
    const cx = this.pt(c.body ? [c.body[0], c.fh * 0.55] : [c.fw / 2, c.fh / 2]);
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const w = Math.min(cw, c.fw - i * cw), h = Math.min(ch, c.fh - j * ch); if (w <= 0 || h <= 0) continue;
      const key = `${f.name}_sh${cols}_${i}_${j}`;
      if (!tex.has(key)) tex.add(key, f.sourceIndex, f.cutX + i * cw, f.cutY + j * ch, w, h);
      const px = x0 + (i * cw + w / 2) * s, py = y0 + (j * ch + h / 2) * s;
      const p = this.add.image(px, py, tex.key, key).setScale(s).setDepth(30);
      const ang = Math.atan2(py - cx.y, px - cx.x) + Phaser.Math.FloatBetween(-0.4, 0.4), sp = power * Phaser.Math.FloatBetween(0.5, 1.2);
      this.tweens.add({ targets: p, x: px + Math.cos(ang) * sp, duration: 1300, ease: 'Quad.out' });
      this.tweens.add({ targets: p, y: { value: py + Math.sin(ang) * sp - power * 0.5, duration: 450, ease: 'Quad.out' } });
      this.tweens.add({ targets: p, y: LAVA_GROUND + 60, delay: 450, duration: 850, ease: 'Quad.in' });
      this.tweens.add({ targets: p, angle: Phaser.Math.Between(-540, 540), alpha: { from: 1, to: 0 }, duration: 1300, ease: 'Quad.in', onComplete: () => p.destroy() });
    }
    b.setVisible(false); this.tweens.add({ targets: this.bShadow, alpha: 0, duration: 400 });
  }
  killSeq(r) {
    window.DC.phase = 'kill';
    const L = r.L, cam = this.cameras.main, last = this.stage === RULES.stages.length - 1, hd = this.head(), N = (n) => Math.max(4, Math.round(n * this.lite()));
    this.boss.stop();
    if (L >= 3) { // blown apart
      sfx(this, 'shatter', 0.9); sfx(this, L === 4 ? 'nuke' : 'boom', 0.8);
      cam.shake(700, 0.03);
      this.ring(hd.x, hd.y - 20, OK_TIERS[L].col, 14, 14, 0, 800);
      this.shatter(L === 4 ? 9 : 6, L === 4 ? 7 : 5, L === 4 ? 520 : 360);
      for (let k = 0; k < 3 + L; k++) this.time.delayedCall(k * 110, () => burst(this, hd.x + Phaser.Math.Between(-120, 120), hd.y + Phaser.Math.Between(-60, 80), k % 2 ? 0xff7a2a : OK_TIERS[L].col, N(40), 420).setDepth(41));
      window.DC.blownApart = true;
    } else { // falls / gets knocked back
      sfx(this, 'win');
      cam.shake(500, 0.02);
      for (let k = 0; k < 4; k++) this.time.delayedCall(k * 150, () => burst(this, hd.x - 40 + k * 50, LAVA_GROUND - 100, 0xffcf40, N(40), 380));
      this.boss.setTint(0x777777);
      if (L === 2) this.tweens.add({ targets: this.boss, x: this.boss.x + 180, angle: 18, alpha: 0, scaleY: this.cfg.scale * 0.8, duration: 900, ease: 'Cubic.in' });
      else this.tweens.add({ targets: this.boss, alpha: 0, scaleY: this.cfg.scale * 0.8, duration: 1000, ease: 'Cubic.in' });
      this.tweens.add({ targets: this.bShadow, alpha: 0, duration: 1000 });
    }
    this.log.push({ stage: this.stage, dmg: r.total, hp: this.hpMax, L, ratio: r.ratio });
    window.DC.log = this.log;
    this.time.delayedCall(L >= 3 ? 1400 : 1100, () => last ? this.end(true) : this.stageClear());
  }
  stageClear() {
    window.DC.phase = 'stage-clear';
    this.tweens.add({ targets: [this.dmg, this.br, this.okT, this.rays, this.dmgLabel].filter(Boolean), alpha: 0, duration: 250 });
    const N = (n) => Math.max(4, Math.round(n * this.lite()));
    sfx(this, 'banner', 0.8); sfx(this, 'rare', 0.5);
    this.tweens.add({ targets: this.hero, x: 520, duration: 400 });
    const ban = txt(this, W / 2, 220, t('stageClear', this.stage + 1), 76, '#ffd36a', { strokeThickness: 12, stroke: '#4a2400', maxW: 1100 }).setDepth(60);
    try { if (ban.preFX) { ban.preFX.addShine(0.9, 0.35, 4); ban.preFX.addGlow(0xffcf40, 4, 0, false, 0.1, 10); } } catch (e) {}
    popText(this, ban, 1);
    const nx = RULES.stages[this.stage + 1];
    const sub = txt(this, W / 2, 300, t('next', t('boss')[this.stage + 1], fmt(nx.hp)), 30, '#ffffff', { maxW: 1000 }).setDepth(60); sub.setAlpha(0);
    this.tweens.add({ targets: sub, alpha: 1, duration: 300, delay: 300 });
    const coins = this.add.particles(0, -20, 'coin', { x: { min: 100, max: 1100 }, lifespan: 2000, speedY: { min: 120, max: 260 }, gravityY: 260, rotate: { min: 0, max: 360 }, scale: { min: 1.4, max: 2.2 }, frequency: 30 / this.lite() }).setDepth(59);
    this.time.delayedCall(1200, () => coins.stop());
    burst(this, W / 2, 220, 0xffcf40, N(60), 420).setDepth(61);
    this.time.delayedCall(700, () => this.bonusMoment());
  }
  // OVERKILL BONUS: reward scaled by damage / boss HP, auto-opened, added to the gear
  bonusMoment() {
    const r = this.res, b = bonusDrop(r.total, this.hpMax, Math.random), N = (n) => Math.max(4, Math.round(n * this.lite()));
    const it = nameItem(b.item); it.bonus = b.tier;
    const R = RARITY[it.rarity], leg = it.rarity === 'LEGENDARY', jack = b.tier === 'jackpot';
    window.DC.phase = 'bonus'; window.DC.bonus = { tier: b.tier, type: b.type, name: it.name, rule: ruleText(it), rarity: it.rarity };
    this.log[this.log.length - 1].bonus = b.tier;
    const X = 860;
    const title = txt(this, X, 352, t('bonusTitle'), 40, '#ffd36a', { strokeThickness: 8, stroke: '#4a2400', maxW: 560 }).setDepth(62);
    popText(this, title, 1); sfx(this, 'banner', 0.7);
    const tier = txt(this, X, 392, t('bonusTier')[b.tier], 24, jack ? '#ffcf40' : b.tier === 'chest' ? '#d58cff' : '#e8dcff', { strokeThickness: 5, maxW: 560 }).setDepth(62);
    tier.setAlpha(0); this.tweens.add({ targets: tier, alpha: 1, duration: 200, delay: 150 });
    const CX = X - 80, IX = X + 95; // chest on the left, the item floats out to its right (clear of the banner text)
    shadow(this, CX, LAVA_GROUND, 100).setDepth(61);
    const ch = this.add.image(CX, -60, 'chest_' + b.type).setScale(3.2).setOrigin(0.5, 1).setDepth(62);
    if (jack) { const g = this.add.image(CX, LAVA_GROUND - 50, 'glowdot').setTint(0xffcf40).setBlendMode(Phaser.BlendModes.ADD).setDepth(61).setScale(2.5).setAlpha(0.6); this.tweens.add({ targets: g, scale: 3.2, yoyo: true, repeat: 4, duration: 140 }); this.time.delayedCall(1400, () => g.destroy()); sfx(this, 'charge', 0.6); }
    this.tweens.add({ targets: ch, y: LAVA_GROUND + 6, duration: 380, ease: 'Bounce.out', onComplete: () => {
      sfx(this, 'open', 0.5);
      this.tweens.add({ targets: ch, angle: { from: -7, to: 7 }, yoyo: true, repeat: jack ? 4 : 2, duration: 55, onComplete: () => {
        ch.setAngle(0).setTexture('open_' + b.type);
        const iy = LAVA_GROUND - 75;
        if (it.rarity !== 'COMMON') {
          const rays = this.add.image(IX, iy, 'rays').setTint(R.col).setBlendMode(Phaser.BlendModes.ADD).setDepth(62).setScale(0).setAlpha(0.7);
          this.tweens.add({ targets: rays, scale: leg ? 1.2 : 0.85, duration: 360, ease: 'Back.out' }); this.tweens.add({ targets: rays, angle: 360, duration: 6000, repeat: -1 });
        }
        burst(this, CX, LAVA_GROUND - 40, R.col, N(leg ? 80 : 40), leg ? 460 : 320).setDepth(63);
        this.ring(CX, LAVA_GROUND - 40, R.col, leg ? 10 : 6, leg ? 8 : 4);
        if (leg) { softFlash(this, 0xffe6a0, 0.22, 260); sfx(this, 'legendary', 0.85); this.cameras.main.shake(400, 0.012);
          const coins = this.add.particles(0, -20, 'coin', { x: { min: 600, max: 1150 }, lifespan: 1800, speedY: { min: 120, max: 240 }, gravityY: 260, rotate: { min: 0, max: 360 }, scale: { min: 1.4, max: 2.2 }, frequency: 30 / this.lite() }).setDepth(63);
          this.time.delayedCall(900, () => coins.stop()); }
        else if (it.rarity === 'EPIC') { sfx(this, 'epic', 0.7); this.cameras.main.shake(250, 0.008); }
        else sfx(this, it.rarity === 'COMMON' ? 'open' : 'rare', 0.6);
        const icon = this.add.image(CX, LAVA_GROUND - 40, 'icons', it.frame).setDepth(64).setScale(1);
        try { if (icon.preFX && it.rarity !== 'COMMON') icon.preFX.addGlow(R.col, 4, 0, false, 0.1, 10); } catch (e) {}
        this.tweens.add({ targets: icon, x: IX, y: iy, scale: 3, duration: 420, ease: 'Back.out' });
        const nm = txt(this, X, 560, it.name, 24, EL_CSS[it.element], { strokeThickness: 5, maxW: 600 }).setDepth(64).setAlpha(0);
        const rl = txt(this, X, 592, `${t('rar')[it.rarity]} · ${ruleText(it)}`, 22, it.mult ? '#ffd84a' : '#b8f0a0', { strokeThickness: 5, maxW: 600 }).setDepth(64).setAlpha(0);
        this.tweens.add({ targets: [nm, rl], alpha: 1, duration: 200, delay: 200 });
        // add to gear: the new icon appears in the gear bar
        this.items.push(it);
        this.time.delayedCall(700, () => {
          const i = this.items.length - 1, gx = 40 + i * 50;
          this.gearPanel.clear(); this.gearPanel = panel(this, 8, 560, this.items.length * 50 + 16, 60); this.gearPanel.setDepth(-1);
          const sq = this.add.rectangle(gx, 590, 42, 42, itemCol(it), 0.3).setStrokeStyle(2, 0xffd36a).setDepth(64);
          const gi = this.tip.attach(this.add.image(gx, 590, 'icons', it.frame).setDepth(64), it);
          popText(this, gi, 1); burst(this, gx, 590, 0xffd36a, N(16), 160, 'px').setDepth(64); sfx(this, 'tick', 0.6);
          window.DC.bonusShown = true;
        });
        this.time.delayedCall(leg ? 2300 : 1900, () => this.toNextStage());
      } });
    } });
  }
  toNextStage() {
    if (this.leaving) return; this.leaving = true;
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('intro', { stage: this.stage + 1, items: this.items, log: this.log }));
  }
  loseSeq() {
    // the boss lunges and EATS the hero
    window.DC.phase = 'eating';
    this.tweens.add({ targets: [this.dmg, this.br, this.okT, this.rays, this.dmgLabel].filter(Boolean), alpha: 0, duration: 250 });
    const cam = this.cameras.main, c = this.cfg, s0 = c.scale, b = this.boss;
    this.log.push({ stage: this.stage, dmg: this.res.total, hp: this.hpMax, L: 0, ratio: this.res.ratio, failed: true });
    window.DC.log = this.log;
    this.tweens.add({ targets: b, scaleY: s0 * 0.92, scaleX: s0 * 1.05, duration: 220, ease: 'Quad.out' }); // rear back
    this.time.delayedCall(230, () => {
      const mo = (c.mouth[0] - c.fw / 2) * s0, targetX = this.hero.x - mo + 30; // mouth lands on the hero
      this.tweens.add({
        targets: b, x: targetX, scaleX: s0, scaleY: s0, duration: 260, ease: 'Back.in', onComplete: () => {
          const m = { x: b.x + mo, y: LAVA_GROUND - (c.fh - c.mouth[1]) * s0 };
          this.hero.anims.stop();
          this.hero.setTint(0xffb0a0);
          this.tweens.add({ targets: this.hero, x: m.x + 10, y: m.y + 40, scaleX: 0.3, scaleY: 0.3, angle: -200, alpha: 0, duration: 260, ease: 'Quad.in' });
          this.time.delayedCall(240, () => {
            sfx(this, 'lose'); sfx(this, 'hit', 0.6);
            cam.shake(420, 0.03);
            const chomp = txt(this, Phaser.Math.Clamp(m.x, 160, W - 160), m.y - 90, t('chomp'), 64, '#ff5a4a', { strokeThickness: 10 }).setDepth(50);
            chomp.setAngle(-8); popText(this, chomp, 1);
            burst(this, m.x, m.y + 20, 0xff3030, 40, 300, 'px');
            window.DC.phase = 'chomp';
            // chew: squash + stretch
            this.tweens.add({ targets: b, scaleY: s0 * 0.875, scaleX: s0 * 1.075, yoyo: true, repeat: 2, duration: 110, ease: 'Sine.inOut',
              onComplete: () => { b.setScale(s0); this.hero.setVisible(false); this.time.delayedCall(500, () => this.end(false)); } });
          });
        },
      });
    });
  }
  end(win) {
    window.DC.phase = 'end'; window.DC.win = win;
    endMusic(this, win);
    const log = this.log, total = log.reduce((a, e) => a + e.dmg, 0), best = log.reduce((a, e) => e.dmg > a.dmg ? e : a, log[0]);
    window.DC.summary = { total, best: best.dmg, stages: log.length, cleared: log.filter((e) => !e.failed).length };
    this.add.rectangle(-100, -100, W + 200, H + 200, 0x000000, 0.68).setOrigin(0).setDepth(70);
    const D = 71, g = panel(this, W / 2 - 390, 20, 780, 468, { border: win ? 0xffcf40 : 0xd04a3a }); g.setDepth(D);
    const tt = txt(this, W / 2, 72, win ? t('allSlain') : t('ate')[this.stage], 58, win ? '#ffd36a' : '#ff5a4a', { strokeThickness: 10, maxW: 740 }).setDepth(D);
    try { if (win && tt.preFX) tt.preFX.addShine(0.8, 0.3, 4); } catch (e) {}
    popText(this, tt, 1);
    RULES.stages.forEach((st, k) => {
      const e = log[k], y = 132 + k * 34;
      const c1 = txt(this, W / 2 - 360, y, t('endStage', k + 1, t('boss')[k]), 22, e ? (e.failed ? '#ff8a7a' : '#ffffff') : '#6a5a7a', { strokeThickness: 4, maxW: 300 }).setOrigin(0, 0.5).setDepth(D);
      const c2 = txt(this, W / 2 + 90, y, e ? `${fmt(e.dmg)} / ${fmt(e.hp)}` : '—', 22, e ? '#ffffff' : '#6a5a7a', { strokeThickness: 4 }).setOrigin(1, 0.5).setDepth(D);
      const lab = !e ? t('notReached') : e.failed ? t('eaten') : okLabel(e.L, e.ratio);
      txt(this, W / 2 + 360, y, lab, 22, !e ? '#6a5a7a' : e.failed ? '#ff5a4a' : OK_TIERS[e.L].css, { strokeThickness: 4, maxW: 250 }).setOrigin(1, 0.5).setDepth(D);
    });
    txt(this, W / 2, 252, t('totals', fmt(total), fmt(best.dmg)), 30, '#ffd36a', { maxW: 740 }).setDepth(D);
    txt(this, W / 2, 292, win ? t('winLine') : t('loseLine'), 22, '#e8dcff', { maxW: 740 }).setDepth(D);
    const n = this.items.length, sp = 66;
    this.items.forEach((it, i) => {
      const x = W / 2 - (n - 1) * sp / 2 + i * sp;
      this.add.rectangle(x, 360, 56, 56, itemCol(it), 0.3).setStrokeStyle(2, itemCol(it)).setDepth(D);
      this.tip.attach(this.add.image(x, 360, 'icons', it.frame).setScale(1.5).setDepth(D), it);
    });
    txt(this, W / 2, 410, t('tapItem'), 16, '#bba8d0', { strokeThickness: 3, maxW: 740 }).setDepth(D);
    if (win) { burst(this, W / 2, 72, 0xffcf40, 60, 420).setDepth(D + 1); this.time.delayedCall(300, () => burst(this, W / 2, 252, 0xff7ab0, 40, 360).setDepth(D + 1)); }
    button(this, W / 2, 548, t('playAgain'), () => { restoreMusic(this); this.scene.start('intro', { stage: 0, items: [], log: [] }); }, 300).setDepth(D);
  }
}

function startGame() {
  if (window.__dcStarted) return; window.__dcStarted = true;
  window.game = new Phaser.Game({
    type: Phaser.AUTO, width: W, height: H, backgroundColor: '#0b0912', parent: 'game',
    pixelArt: true, roundPixels: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { keyboard: false }, audio: { disableWebAudio: false },
    scene: [Boot, Title, Intro, Pick, Strike],
  });
}
if (typeof Phaser !== 'undefined') {
  // make sure the pixel font (and the CJK pixel font for zh/ja/ko) is ready before any Phaser text is drawn (max 3s wait)
  setLang(LANG);
  loadLangFont(LANG).then(startGame, startGame);
}
