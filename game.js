// ===== GAME LOGIC (pure, no Phaser) =====
const RULES = {
  rounds: 8,
  dragonHP: 1000,
  wood:  { min: 15, max: 30, spread: 0.35 },
  gold:  { accChance: 0.8, multMin: 0.3, multMax: 0.8, wMin: 20, wMax: 50, spread: 0.3 },
  black: { goodChance: 0.56, wMin: 190, wMax: 290, cMin: 70, cMax: 140, wSpread: 0.2, cSpread: 0.3 },
  setCount: 5, setMult: 2,
  offerWeights: { wood: 0.5, gold: 0.22, black: 0.28 },
};
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
function openChest(chest, rng) {
  const R = RULES, el = chest.element;
  const flatItem = (kind, c, sp) => { const [lo, hi] = span(c, sp); return { kind, element: el, flat: c, lo, hi, mult: 0 }; };
  if (chest.type === 'wood') return flatItem(pick(rng, ['weapon', 'armor']), ri(rng, R.wood.min, R.wood.max), R.wood.spread);
  if (chest.type === 'gold') {
    if (rng() < R.gold.accChance) return { kind: 'accessory', element: el, flat: 0, lo: 0, hi: 0, mult: ri(rng, R.gold.multMin * 10, R.gold.multMax * 10) / 10 };
    return flatItem('weapon', ri(rng, R.gold.wMin, R.gold.wMax), R.gold.spread);
  }
  if (rng() < R.black.goodChance) return flatItem('weapon', ri(rng, R.black.wMin, R.black.wMax), R.black.wSpread);
  const c = ri(rng, R.black.cMin, R.black.cMax), [a, b] = span(c, R.black.cSpread);
  return { kind: 'cursed', element: el, flat: -c, lo: -b, hi: -a, mult: 0 };
}
// rng given -> roll every item inside its range; no rng -> use the average (for previews)
function rollItem(it, rng) { return it.lo === it.hi ? it.lo : rng ? ri(rng, it.lo, it.hi) : (it.lo + it.hi) / 2; }
function computeDamage(items, rng) {
  let flat = 0, mult = 0; const cnt = { Fire: 0, Ice: 0, Thunder: 0 };
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
const NAMES = {
  pre: { Fire: ['Ember', 'Blaze', 'Inferno', 'Cinder', 'Magma'], Ice: ['Frost', 'Glacier', 'Rime', 'Winter', 'Hoarfrost'], Thunder: ['Storm', 'Volt', 'Thunder', 'Tempest', 'Skybolt'] },
  mid: ['Dragonbone', 'Runed', 'Ancient', 'Moonsteel', 'Obsidian', 'Royal', 'Elven', 'Dwarven'],
  cursed: ['Cursed', 'Hexed', 'Doomed', 'Haunted'],
};
function nameItem(it) {
  const p = (a) => a[Math.floor(Math.random() * a.length)];
  if (it.kind === 'cursed') { const c = p(ICONS.cursed); it.frame = c[0]; it.name = `${p(NAMES.cursed)} ${p(NAMES.pre[it.element])} ${c[1]}`; }
  else { const c = p(ICONS[it.kind][it.element]); it.frame = c[0]; it.name = `${p(NAMES.pre[it.element])} ${p(NAMES.mid)} ${c[1]}`; }
  it.rarity = it.kind === 'cursed' ? 'CURSED' : (it.flat >= 240 || it.mult >= 0.7) ? 'LEGENDARY' : (it.flat >= 150 || it.mult >= 0.5) ? 'EPIC' : it.mult ? 'RARE' : 'COMMON';
  return it;
}
// Every item states its own damage rule.
const ruleText = (it) => it.kind === 'cursed' ? `${it.hi} to ${it.lo} ATK (cursed)` : it.mult ? `+${it.mult.toFixed(1)}x total damage` : `${it.lo}–${it.hi} ATK`;
const elemCount = (items, el) => items.filter((i) => i.element === el).length;
const setLine = (it, items) => `${it.element} set: ${RULES.setCount} ${it.element} items = x${RULES.setMult} damage (you have ${Math.min(elemCount(items, it.element), RULES.setCount)}/${RULES.setCount})`;
const itemCol = (it) => it.kind === 'cursed' ? CURSE_COL : EL_COLOR[it.element];
const RARITY = {
  COMMON: { css: '#d8d8d8', col: 0xd8d8d8, n: 10, shake: 0 },
  RARE: { css: '#7adcff', col: 0x7adcff, n: 22, shake: 0 },
  EPIC: { css: '#d58cff', col: 0xd58cff, n: 36, shake: 0.006 },
  LEGENDARY: { css: '#ffcf40', col: 0xffcf40, n: 60, shake: 0.012 },
  CURSED: { css: '#ff6a8a', col: 0x9a3aff, n: 44, shake: 0.012 },
};

// ===== PHASER =====
const W = 1200, H = 628;
const FONT = '"Pixelify Sans", "Trebuchet MS", sans-serif';
const LAVA_GROUND = 512;   // lava floor line of bg_lava drawn at 3x
window.DC = { phase: 'boot', round: 0 };

function txt(scene, x, y, s, size, color = '#ffffff', extra = {}) {
  return scene.add.text(x, y, s, Object.assign({ fontFamily: FONT, fontSize: size + 'px', color, fontStyle: 'bold', stroke: '#140812', strokeThickness: Math.max(4, Math.round(size / 7)), align: 'center' }, extra)).setOrigin(0.5);
}
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
  const t = txt(scene, 0, -2, label, 32, '#fff4c8');
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
      [`${it.rarity} · ${it.kind === 'cursed' ? 'Cursed item' : it.kind[0].toUpperCase() + it.kind.slice(1)} · ${it.element}`, 19, R.css],
      [ruleText(it), 28, it.kind === 'cursed' ? '#ff6a7a' : it.mult ? '#ffd84a' : '#b8f0a0'],
      [setLine(it, items), 18, EL_CSS[it.element]],
    ];
    const h = 34 + lines.reduce((a, l) => a + l[1] + 12, 0);
    const g = panel(sc, 0, 0, w, h, { border: R.col, alpha: 0.95 });
    this.c.add(g);
    let y = 18;
    lines.forEach(([t, size, col]) => {
      const tx = sc.add.text(w / 2, y, t, { fontFamily: FONT, fontSize: size + 'px', color: col, fontStyle: 'bold', stroke: '#140812', strokeThickness: 4, align: 'center', wordWrap: { width: w - 30 } }).setOrigin(0.5, 0);
      this.c.add(tx); y += size + 12;
    });
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
    this.load.spritesheet('hero_idle', I + 'hero_idle.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('hero_run', I + 'hero_run.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('hero_attack', I + 'hero_attack.png', { frameWidth: 64, frameHeight: 64 });
    ['click', 'open', 'rare', 'curse', 'swing', 'hit', 'win', 'lose', 'music', 'epic', 'legendary', 'charge', 'banner', 'tick', 'victory', 'defeat'].forEach((k) => this.load.audio(k, A + k + '.mp3'));
  }
  create() {
    const a = (key, tex, rate, repeat = -1) => this.anims.create({ key, frames: this.anims.generateFrameNumbers(tex), frameRate: rate, repeat });
    a('dragon-idle', 'dragon_idle', 8); a('dragon-breath', 'dragon_breath', 12, 0);
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
    window.DC.phase = 'title';
    backdrop(this, 'bg_lava', 0.2);
    shadow(this, W / 2 + 120 + 94, LAVA_GROUND, 290); shadow(this, W / 2 - 300, LAVA_GROUND, 90);
    this.add.sprite(W / 2 + 120, LAVA_GROUND, 'dragon_idle').setScale(4).setOrigin(0.5, 1).play('dragon-idle');
    heroGlow(this.add.sprite(W / 2 - 300, LAVA_GROUND, 'hero_idle').setScale(3).setOrigin(0.5, 1).play('hero-idle'));
    panel(this, W / 2 - 330, 22, 660, 170);
    txt(this, W / 2, 82, 'DRAGON CHEST', 80, '#ffd36a', { strokeThickness: 10 });
    txt(this, W / 2, 142, 'Open 8 chests. Strike the dragon ONCE.', 28, '#ffffff');
    txt(this, W / 2, 175, 'Kill it, or get eaten.', 22, '#ff9a7a');
    const tap = txt(this, W / 2, 575, '▶  TAP TO START', 40, '#fff2c0');
    this.tweens.add({ targets: tap, alpha: 0.35, yoyo: true, repeat: -1, duration: 650 });
    this.input.once('pointerup', () => {
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
      this.scene.start('pick', { round: 0, items: [] });
    });
  }
}

class Pick extends Phaser.Scene {
  constructor() { super('pick'); }
  init(data) { this.round = data.round; this.items = data.items; this.locked = false; this.done = false; this.canSkip = false; this.autoNext = null; this.dim = null; }
  create() {
    window.DC.phase = 'pick'; window.DC.round = this.round + 1; window.DC.reveal = null;
    this.tweens.timeScale = 1; this.time.timeScale = 1;
    fadeInMain(this);
    backdrop(this, 'bg_hoard', 0.45);
    panel(this, 250, 14, 360, 92);
    txt(this, 430, 46, `CHEST ${this.round + 1} / ${RULES.rounds}`, 40, '#ffd36a');
    txt(this, 430, 84, 'Pick one', 22, '#f0e6ff');
    this.tip = new Tooltip(this, () => this.items);
    this.drawInventory();
    this.offer = rollOffer(Math.random);
    const xs = [170, 430, 690], base = 390;
    this.chests = this.offer.map((c, i) => {
      const x = xs[i];
      shadow(this, x, base, 160);
      const glow = this.add.circle(x, base - 80, 105, EL_COLOR[c.element], 0.16).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: glow, scale: 1.1, alpha: 0.26, yoyo: true, repeat: -1, duration: 900 + i * 120 });
      const spr = this.add.image(x, base + 12, 'chest_' + c.type).setScale(5).setOrigin(0.5, 1);
      const gem = this.add.star(x, base - 205, 4, 9, 20, EL_COLOR[c.element]).setStrokeStyle(3, 0x000000);
      this.tweens.add({ targets: gem, y: base - 213, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.inOut' });
      const label = txt(this, x, base + 32, { wood: 'Wooden', gold: 'Gold', black: 'Black' }[c.type], 30, { wood: '#f0c08a', gold: '#ffd84a', black: '#c9a6ff' }[c.type]);
      const el = txt(this, x, base + 64, c.element, 24, EL_CSS[c.element]);
      const zone = this.add.zone(x, base - 80, 220, 300).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.choose(i));
      zone.on('pointerover', () => { if (this.locked) return; this.tweens.add({ targets: spr, scale: 5.4, duration: 120 }); glow.setAlpha(0.45); });
      zone.on('pointerout', () => { if (this.locked) return; this.tweens.add({ targets: spr, scale: 5, duration: 120 }); glow.setAlpha(0.2); });
      // idle sparkle so chests feel alive without lifting off the ground
      const sp = this.add.particles(x, base - 70, 'px', { x: { min: -60, max: 60 }, y: { min: -50, max: 40 }, lifespan: 900, speedY: { min: -30, max: -10 }, scale: { start: 1.5, end: 0 }, frequency: 260, tint: EL_COLOR[c.element], blendMode: 'ADD' });
      return { c, x, y: base - 80, spr, glow, gem, label, el, zone, sp };
    });
    this.input.on('pointerdown', (p, over) => { if (this.canSkip && !over.some((o) => o.getData && o.getData('item'))) this.next(); });
  }
  drawInventory() {
    const x0 = 880, y0 = 150;
    panel(this, x0 - 18, y0 - 30, 334, 486);
    txt(this, x0 + 149, y0 - 2, 'BAG', 26, '#ffd36a');
    this.counters = ELEMENTS.map((el, k) => {
      const cx = x0 - 4 + k * 98;
      this.add.star(cx + 6, y0 + 30, 4, 4, 9, EL_COLOR[el]).setStrokeStyle(2, 0x000000);
      return this.add.text(cx + 16, y0 + 30, '', { fontFamily: FONT, fontSize: '16px', color: EL_CSS[el], fontStyle: 'bold', stroke: '#140812', strokeThickness: 3 }).setOrigin(0, 0.5);
    });
    this.updateCounters();
    for (let i = 0; i < RULES.rounds; i++) this.addInvRow(i, this.items[i]);
  }
  updateCounters() {
    ELEMENTS.forEach((el, k) => {
      const n = elemCount(this.items, el);
      this.counters[k].setText(`${el} ${Math.min(n, RULES.setCount)}/${RULES.setCount}`).setColor(n >= RULES.setCount ? '#ffffff' : EL_CSS[el]);
    });
  }
  addInvRow(i, it) {
    const x0 = 880, y = 226 + i * 48;
    if (!it) { this.add.rectangle(x0 + 21, y, 40, 40, 0xffffff, 0.06).setStrokeStyle(1, 0x5a4a3a); return; }
    this.add.rectangle(x0 + 21, y, 42, 42, itemCol(it), 0.3).setStrokeStyle(2, itemCol(it));
    this.tip.attach(this.add.image(x0 + 21, y, 'icons', it.frame), it);
    const nm = it.name.length > 22 ? it.name.slice(0, 21) + '…' : it.name;
    this.add.text(x0 + 50, y - 19, nm, { fontFamily: FONT, fontSize: '17px', color: '#ffffff', fontStyle: 'bold' });
    this.add.text(x0 + 50, y + 1, ruleText(it), { fontFamily: FONT, fontSize: '16px', color: it.kind === 'cursed' ? '#ff7a8a' : it.mult ? '#ffd84a' : '#b8f0a0' });
  }
  forcedItem(ch) { // test hook: DC.force = 'EPIC' | 'LEGENDARY'
    const f = window.DC.force; if (!f) return null; window.DC.force = null;
    const c = f === 'LEGENDARY' ? 270 : 200, [lo, hi] = span(c, RULES.black.wSpread);
    return { kind: 'weapon', element: ch.c.element, flat: c, lo, hi, mult: 0 };
  }
  choose(i) {
    if (this.locked) return; this.locked = true;
    const ch = this.chests[i];
    this.chests.forEach((o, j) => { o.zone.disableInteractive(); o.sp.stop(); if (j !== i) { this.tweens.killTweensOf([o.spr, o.glow, o.gem]); this.tweens.add({ targets: [o.spr, o.glow, o.gem, o.label, o.el], alpha: 0.12, duration: 250 }); } });
    sfx(this, 'click');
    const it = nameItem(this.forcedItem(ch) || openChest(ch.c, Math.random));
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
    if (leg) { cam.flash(420, 255, 230, 140); cam.shake(650, 0.02); }
    else if (tier === 'EPIC') { cam.flash(260, 220, 160, 255); cam.shake(380, 0.011); }
    else if (tier === 'CURSED') { cam.flash(200, 120, 0, 160); cam.shake(300, R.shake); }
    else if (tier === 'RARE') cam.flash(120, 140, 220, 255);
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
        const label = leg ? 'LEGENDARY!!' : 'EPIC!', size = leg ? 66 : 70;
        const bw = label.length * size * 0.62;
        const bx = Phaser.Math.Clamp(ch.x, bw / 2 + 12, 856 - bw / 2);
        const ban = txt(this, bx, ch.y + 64, label, size, R.css, { strokeThickness: 12, stroke: leg ? '#4a2400' : '#2a0a40' }).setDepth(D + 5);
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
      const tag = txt(this, -250, -38, tier, 16, R.css, { strokeThickness: 4 });
      const t1 = txt(this, 30, -36, it.name, 28, it.kind === 'cursed' ? '#d9a6ff' : EL_CSS[it.element]);
      const t2 = txt(this, 0, 2, ruleText(it), 32, it.kind === 'cursed' ? '#ff6a7a' : it.mult ? '#ffd84a' : '#b8f0a0');
      const t3 = txt(this, 0, 38, setLine(it, this.items), 18, EL_CSS[it.element], { strokeThickness: 4 });
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
    if (this.round + 1 >= RULES.rounds) this.scene.start('strike', { items: this.items });
    else this.scene.start('pick', { round: this.round + 1, items: this.items });
  }
}

class Strike extends Phaser.Scene {
  constructor() { super('strike'); }
  init(d) { this.items = d.items; this.struck = false; }
  create() {
    window.DC.phase = 'strike';
    backdrop(this, 'bg_lava', 0.12);
    this.res = computeDamage(this.items, Math.random); // each item rolls inside its ATK range
    window.DC.result = this.res;
    this.tip = new Tooltip(this, () => this.items);
    this.dShadow = shadow(this, 900 + 94, LAVA_GROUND, 290);
    this.hShadow = shadow(this, 230, LAVA_GROUND, 90);
    this.dragon = this.add.sprite(900, LAVA_GROUND, 'dragon_idle').setScale(4).setOrigin(0.5, 1).play('dragon-idle');
    this.hero = this.add.sprite(230, LAVA_GROUND, 'hero_idle').setScale(3).setOrigin(0.5, 1).play('hero-idle');
    heroGlow(this.hero);
    panel(this, 640, 30, 440, 120);
    txt(this, 860, 66, 'ANCIENT DRAGON', 34, '#ff8a6a');
    this.add.rectangle(860, 112, 400, 28, 0x220000).setStrokeStyle(3, 0xffd36a);
    this.hp = this.add.rectangle(662, 112, 396, 22, 0xd22a2a).setOrigin(0, 0.5);
    this.hpText = txt(this, 860, 112, `${RULES.dragonHP} / ${RULES.dragonHP}`, 20);
    panel(this, 8, 560, 8 * 50 + 16, 60);
    this.items.forEach((it, i) => {
      this.add.rectangle(40 + i * 50, 590, 42, 42, itemCol(it), 0.3).setStrokeStyle(2, itemCol(it));
      this.tip.attach(this.add.image(40 + i * 50, 590, 'icons', it.frame), it);
    });
    this.ready = txt(this, 250, 190, 'Your gear is ready.', 28);
    this.btn = button(this, 250, 262, 'STRIKE!', () => this.strike(), 240);
    window.DC.phase = 'strike-ready';
  }
  update() { // shadows stay glued to the feet
    if (this.hero) { this.hShadow.x = this.hero.x; this.hShadow.setVisible(this.hero.visible && this.hero.alpha > 0.2); this.hShadow.scaleX = this.hero.scaleX / 3; }
    if (this.dragon) this.dShadow.x = this.dragon.x + 94 * this.dragon.scaleX / 4;
  }
  mouth() { return { x: this.dragon.x - 288 + 66 * 4, y: LAVA_GROUND - 36 * 4 }; }
  strike() {
    if (this.struck) return; this.struck = true; window.DC.phase = 'striking';
    this.btn.destroy(); this.ready.destroy();
    this.tip.hide(true);
    this.rollSeq(() => this.charge());
  }
  // show every item's roll ticking up inside its range, then the total
  rollSeq(done) {
    window.DC.phase = 'rolling';
    const r = this.res, its = this.items, n = its.length, rowH = 31, top = 84, x0 = 20, w = 600;
    const h = top - 16 + n * rowH + 64;
    const box = this.add.container(0, 0).setDepth(50);
    box.add(panel(this, x0, 16, w, h));
    box.add(txt(this, x0 + w / 2, 46, 'ROLLING YOUR GEAR', 28, '#ffd36a'));
    const st = (x, y, t, size, col, ox = 0) => this.add.text(x, y, t, { fontFamily: FONT, fontSize: size + 'px', color: col, fontStyle: 'bold', stroke: '#140812', strokeThickness: 3 }).setOrigin(ox, 0.5);
    let sum = 0, mult = 0;
    const foot = txt(this, x0 + w / 2, 16 + h - 32, 'ATK 0', 30, '#ffffff'); box.add(foot);
    const footText = () => `ATK ${Math.max(0, Math.round(sum))}` + (mult ? `   x${(1 + mult).toFixed(1)}` : '');
    const step = 190;
    its.forEach((it, i) => {
      const y = top + i * rowH, col = it.kind === 'cursed' ? '#ff7a8a' : it.mult ? '#ffd84a' : '#b8f0a0';
      const ic = this.add.image(x0 + 28, y, 'icons', it.frame).setScale(0.8).setAlpha(0.35);
      const nm = st(x0 + 50, y, it.name.length > 24 ? it.name.slice(0, 23) + '…' : it.name, 17, '#ffffff').setAlpha(0.35);
      const rg = st(x0 + 440, y, it.mult ? 'no roll' : it.kind === 'cursed' ? `${it.hi} to ${it.lo}` : `${it.lo}–${it.hi}`, 16, '#bba8d0', 1).setAlpha(0.35);
      const val = st(x0 + w - 22, y, '', 22, col, 1);
      box.add([ic, nm, rg, val]);
      this.time.delayedCall(250 + i * step, () => {
        [ic, nm, rg].forEach((o) => o.setAlpha(1));
        if (it.mult) { val.setText(`+${it.mult.toFixed(1)}x`); mult += it.mult; foot.setText(footText()); popText(this, val, 1); sfx(this, 'tick', 0.5); return; }
        const c = { v: it.lo };
        this.tweens.add({ targets: c, v: r.rolls[i], duration: 170, ease: 'Cubic.out',
          onUpdate: () => val.setText((c.v >= 0 ? '+' : '') + Math.round(c.v)),
          onComplete: () => { val.setText((r.rolls[i] >= 0 ? '+' : '') + r.rolls[i]); sum += r.rolls[i]; foot.setText(footText()); sfx(this, 'tick', 0.5); popText(this, val, 1);
            const hi = it.hi === it.lo ? 1 : (r.rolls[i] - it.lo) / (it.hi - it.lo); if (it.kind !== 'cursed' && hi >= 0.85) val.setColor('#ffffff'); } });
      });
    });
    this.time.delayedCall(250 + n * step + 250, () => {
      const parts = [`ATK ${r.flat}`, `x${(1 + r.mult).toFixed(1)}`]; if (r.set > 1) parts.push(`x${r.set} ${r.setEl} set`);
      foot.setText(parts.join('  ') + `  =  ${r.total}`).setColor('#ffd36a'); popText(this, foot, 1); sfx(this, 'banner', 0.5);
      window.DC.phase = 'rolled';
      this.time.delayedCall(1000, () => this.tweens.add({ targets: box, alpha: 0, duration: 250, onComplete: () => { box.destroy(); done(); } }));
    });
  }
  charge() {
    window.DC.phase = 'striking';
    const r = this.res, win = r.total >= RULES.dragonHP;
    this.hero.play('hero-run');
    this.cameras.main.zoomTo(1.12, 500, 'Sine.easeInOut');
    this.cameras.main.pan(700, 380, 500, 'Sine.easeInOut');
    this.tweens.add({
      targets: this.hero, x: 760, duration: 470, ease: 'Quad.in', onComplete: () => {
        sfx(this, 'swing');
        this.hero.play('hero-attack');
        this.time.delayedCall(140, () => this.impact(r, win));
        this.hero.once('animationcomplete', () => this.hero.play('hero-idle'));
      },
    });
  }
  head() { return { x: this.dragon.x - 288 + 70 * 4, y: LAVA_GROUND - 30 * 4 }; } // dragon faces left; head ~ frame (70,34)
  slash(x, y) { // crescent arcs centred on the head
    for (let k = 0; k < 3; k++) {
      const g = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      g.lineStyle(14 - k * 4, k === 0 ? 0xffffff : 0xffd36a, 1 - k * 0.25);
      g.beginPath(); g.arc(x, y, 62 + k * 16, Phaser.Math.DegToRad(-150), Phaser.Math.DegToRad(30), false); g.strokePath();
      g.setAlpha(0);
      this.tweens.add({ targets: g, alpha: { from: 1, to: 0 }, duration: 380, delay: k * 50, onComplete: () => g.destroy() });
    }
  }
  impact(r, win) {
    sfx(this, 'hit', 0.9);
    const cam = this.cameras.main;
    cam.shake(450, 0.025); cam.flash(180, 255, 255, 255);
    this.dragon.setTintFill(0xffffff); this.time.delayedCall(110, () => this.dragon.clearTint());
    const hd = this.head(); window.DC.head = hd;
    this.slash(hd.x, hd.y);
    burst(this, hd.x, hd.y, 0xffd36a, 50, 420);
    burst(this, hd.x, hd.y, 0xff5a2a, 30, 300, 'px');
    // brief hit-stop for weight
    this.anims.pauseAll(); this.time.delayedCall(90, () => this.anims.resumeAll());
    const parts = [`ATK ${r.flat}`, `x${(1 + r.mult).toFixed(1)}`]; if (r.set > 1) parts.push(`x${r.set} ${r.setEl} set`);
    const dmg = txt(this, 860, 230, '0', 84, '#ffd36a', { strokeThickness: 12 });
    popText(this, dmg, 1);
    const br = txt(this, 860, 172, parts.join('   '), 24, '#ffffff'); br.setScrollFactor(1);
    const counter = { v: 0 };
    this.tweens.add({
      targets: counter, v: r.total, duration: 1300, ease: 'Cubic.out',
      onUpdate: () => {
        const v = Math.round(counter.v); dmg.setText(v);
        const left = Math.max(0, RULES.dragonHP - v);
        this.hp.width = 396 * left / RULES.dragonHP; this.hpText.setText(`${left} / ${RULES.dragonHP}`);
      },
      onComplete: () => {
        popText(this, dmg, win ? 1.25 : 1);
        this.time.delayedCall(450, () => { cam.zoomTo(1, 400); cam.pan(W / 2, H / 2, 400); this.time.delayedCall(420, () => win ? this.winSeq() : this.loseSeq()); });
      },
    });
    this.tweens.add({ targets: this.hero, x: 520, duration: 500, delay: 450, ease: 'Quad.out' });
  }
  winSeq() {
    sfx(this, 'win'); this.dragon.stop();
    this.cameras.main.flash(300, 255, 230, 150); this.cameras.main.shake(500, 0.02);
    for (let k = 0; k < 4; k++) this.time.delayedCall(k * 150, () => burst(this, this.dragon.x - 60 + k * 50, LAVA_GROUND - 120, 0xffcf40, 40, 380));
    this.dragon.setTint(0x777777);
    this.tweens.add({ targets: this.dragon, alpha: 0, scaleY: 3.2, duration: 1000, ease: 'Cubic.in' });
    this.tweens.add({ targets: this.dShadow, alpha: 0, duration: 1000 });
    this.time.delayedCall(1000, () => this.end(true));
  }
  loseSeq() {
    // the dragon lunges and EATS the hero (no fire)
    window.DC.phase = 'eating';
    const cam = this.cameras.main;
    this.tweens.add({ targets: this.dragon, scaleY: 3.7, scaleX: 4.2, duration: 220, ease: 'Quad.out' }); // rear back
    this.time.delayedCall(230, () => {
      const targetX = this.hero.x + 288 - 66 * 4 + 30; // mouth lands on the hero
      this.tweens.add({
        targets: this.dragon, x: targetX, scaleX: 4, scaleY: 4, duration: 260, ease: 'Back.in', onComplete: () => {
          const m = this.mouth();
          this.hero.anims.stop();
          this.hero.setTint(0xffb0a0);
          this.tweens.add({ targets: this.hero, x: m.x + 10, y: m.y + 40, scaleX: 0.3, scaleY: 0.3, angle: -200, alpha: 0, duration: 260, ease: 'Quad.in' });
          this.time.delayedCall(240, () => {
            sfx(this, 'lose'); sfx(this, 'hit', 0.6);
            cam.shake(420, 0.03); cam.flash(160, 180, 0, 0);
            const chomp = txt(this, m.x, m.y - 90, 'CHOMP!', 64, '#ff5a4a', { strokeThickness: 10 });
            chomp.setAngle(-8); popText(this, chomp, 1);
            burst(this, m.x, m.y + 20, 0xff3030, 40, 300, 'px');
            window.DC.phase = 'chomp';
            // chew: squash + stretch twice
            this.tweens.add({ targets: this.dragon, scaleY: 3.5, scaleX: 4.3, yoyo: true, repeat: 2, duration: 110, ease: 'Sine.inOut',
              onComplete: () => { this.dragon.setScale(4); this.hero.setVisible(false); this.time.delayedCall(500, () => this.end(false)); } });
          });
        },
      });
    });
  }
  end(win) {
    window.DC.phase = 'end'; window.DC.win = win;
    endMusic(this, win);
    this.add.rectangle(0, 0, W, H, 0x000000, 0.65).setOrigin(0);
    panel(this, W / 2 - 360, 70, 720, 340, { border: win ? 0xffcf40 : 0xd04a3a });
    const t = txt(this, W / 2, 140, win ? 'DRAGON SLAIN!' : 'THE DRAGON ATE YOU', 64, win ? '#ffd36a' : '#ff5a4a', { strokeThickness: 10 });
    popText(this, t, 1);
    txt(this, W / 2, 215, `You dealt ${this.res.total} / ${RULES.dragonHP}`, 32);
    txt(this, W / 2, 262, win ? 'Legends will sing of your loot.' : 'Read your items. Choose better.', 24, '#e8dcff');
    this.items.forEach((it, i) => {
      const x = W / 2 - 4 * 70 + 35 + i * 70;
      this.add.rectangle(x, 336, 56, 56, itemCol(it), 0.3).setStrokeStyle(2, itemCol(it));
      this.tip.attach(this.add.image(x, 336, 'icons', it.frame).setScale(1.5), it);
    });
    if (win) burst(this, W / 2, 140, 0xffcf40, 60, 420);
    txt(this, W / 2, 384, 'Tap an item to inspect it', 16, '#bba8d0', { strokeThickness: 3 });
    button(this, W / 2, 470, 'PLAY AGAIN', () => { restoreMusic(this); this.scene.start('pick', { round: 0, items: [] }); }, 300);
  }
}

function startGame() {
  if (window.__dcStarted) return; window.__dcStarted = true;
  window.game = new Phaser.Game({
    type: Phaser.AUTO, width: W, height: H, backgroundColor: '#0b0912', parent: 'game',
    pixelArt: true, roundPixels: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { keyboard: false }, audio: { disableWebAudio: false },
    scene: [Boot, Title, Pick, Strike],
  });
}
if (typeof Phaser !== 'undefined') {
  // make sure the pixel font is ready before any Phaser text is drawn (max 3s wait)
  const fontsReady = (document.fonts && document.fonts.load)
    ? Promise.all(['700 32px "Pixelify Sans"', '400 16px "Pixelify Sans"'].map((f) => document.fonts.load(f))) : Promise.resolve();
  Promise.race([fontsReady, new Promise((r) => setTimeout(r, 3000))]).then(startGame, startGame);
}
