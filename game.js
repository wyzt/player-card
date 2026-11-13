// ===== GAME LOGIC (pure, no Phaser) =====
const RULES = {
  rounds: 8,
  dragonHP: 1000,
  wood:  { min: 15, max: 30 },
  gold:  { accChance: 0.8, multMin: 0.3, multMax: 0.8, wMin: 20, wMax: 50 },
  black: { goodChance: 0.55, wMin: 190, wMax: 290, cMin: 70, cMax: 140 },
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
function openChest(chest, rng) {
  const R = RULES, el = chest.element;
  if (chest.type === 'wood') return { kind: pick(rng, ['weapon', 'armor']), element: el, flat: ri(rng, R.wood.min, R.wood.max), mult: 0 };
  if (chest.type === 'gold') {
    if (rng() < R.gold.accChance) return { kind: 'accessory', element: el, flat: 0, mult: ri(rng, R.gold.multMin * 10, R.gold.multMax * 10) / 10 };
    return { kind: 'weapon', element: el, flat: ri(rng, R.gold.wMin, R.gold.wMax), mult: 0 };
  }
  if (rng() < R.black.goodChance) return { kind: 'weapon', element: el, flat: ri(rng, R.black.wMin, R.black.wMax), mult: 0 };
  return { kind: 'cursed', element: el, flat: -ri(rng, R.black.cMin, R.black.cMax), mult: 0 };
}
function computeDamage(items) {
  let flat = 0, mult = 0; const cnt = { Fire: 0, Ice: 0, Thunder: 0 };
  for (const it of items) { flat += it.flat; mult += it.mult; if (cnt[it.element] !== undefined) cnt[it.element]++; }
  let setEl = null; for (const e of ELEMENTS) if (cnt[e] >= RULES.setCount && (!setEl || cnt[e] > cnt[setEl])) setEl = e;
  const set = setEl ? RULES.setMult : 1;
  flat = Math.max(0, flat);
  return { flat, mult: Math.round(mult * 10) / 10, set, setEl, total: Math.round(flat * (1 + mult) * set) };
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
const ruleText = (it) => it.kind === 'cursed' ? `${it.flat} ATK (cursed)` : it.mult ? `+${it.mult.toFixed(1)}x total damage` : `+${it.flat} ATK`;
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
    window.DC.tooltip = { name: it.name, x, y: ty, w: sw, h: sh };
  }
  hide(force) { if (force) this.pinned = false; this.c.setVisible(false); this.cur = null; window.DC.tooltip = null; }
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
    ['click', 'open', 'rare', 'curse', 'swing', 'hit', 'win', 'lose', 'music'].forEach((k) => this.load.audio(k, A + k + '.mp3'));
  }
  create() {
    const a = (key, tex, rate, repeat = -1) => this.anims.create({ key, frames: this.anims.generateFrameNumbers(tex), frameRate: rate, repeat });
    a('dragon-idle', 'dragon_idle', 8); a('dragon-breath', 'dragon_breath', 12, 0);
    a('hero-idle', 'hero_idle', 3); a('hero-run', 'hero_run', 16); a('hero-attack', 'hero_attack', 14, 0);
    // generated FX textures
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff, 1); g.fillRect(0, 0, 6, 6); g.generateTexture('spark', 6, 6); g.clear();
    g.fillStyle(0xffffff, 1); g.fillRect(0, 0, 3, 3); g.generateTexture('px', 3, 3); g.destroy();
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
  init(data) { this.round = data.round; this.items = data.items; this.locked = false; this.done = false; this.canSkip = false; this.autoNext = null; }
  create() {
    window.DC.phase = 'pick'; window.DC.round = this.round + 1;
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
  choose(i) {
    if (this.locked) return; this.locked = true;
    const ch = this.chests[i];
    this.chests.forEach((o, j) => { o.zone.disableInteractive(); o.sp.stop(); if (j !== i) { this.tweens.killTweensOf([o.spr, o.glow, o.gem]); this.tweens.add({ targets: [o.spr, o.glow, o.gem, o.label, o.el], alpha: 0.12, duration: 250 }); } });
    sfx(this, 'click');
    this.tweens.killTweensOf(ch.spr); ch.spr.setScale(5);
    ch.glow.setAlpha(0.6);
    this.tweens.add({ targets: ch.spr, x: { from: ch.x - 6, to: ch.x + 6 }, duration: 55, yoyo: true, repeat: 4, onComplete: () => this.reveal(ch) });
  }
  reveal(ch) {
    const it = nameItem(openChest(ch.c, Math.random));
    this.items.push(it);
    const R = RARITY[it.rarity];
    ch.spr.setTexture('open_' + ch.c.type).setX(ch.x);
    const ring = this.add.circle(ch.x, ch.y, 30, R.col, 0.8).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: ring, scale: 2 + R.n / 10, alpha: 0, duration: 600, onComplete: () => ring.destroy() });
    burst(this, ch.x, ch.y - 10, R.col, R.n, 200 + R.n * 4);
    if (it.rarity !== 'COMMON') burst(this, ch.x, ch.y - 10, itemCol(it), Math.round(R.n / 2), 180, 'px');
    if (R.shake) this.cameras.main.shake(300, R.shake);
    if (it.rarity === 'LEGENDARY') this.cameras.main.flash(260, 255, 220, 120);
    if (it.rarity === 'CURSED') this.cameras.main.flash(200, 120, 0, 160);
    sfx(this, 'open');
    sfx(this, it.kind === 'cursed' ? 'curse' : it.rarity === 'COMMON' ? 'open' : 'rare', it.rarity === 'COMMON' ? 0.4 : 0.7);
    const icon = this.tip.attach(this.add.image(ch.x, ch.y, 'icons', it.frame).setScale(1), it);
    this.tweens.add({ targets: icon, y: ch.y - 150, scale: 3, duration: 450, ease: 'Back.out' });
    // item card with the item's own damage rule
    const card = this.add.container(430, 540);
    const pg = panel(this, -330, -62, 660, 124, { border: R.col });
    const tag = txt(this, -250, -38, it.rarity, 16, R.css, { strokeThickness: 4 });
    const t1 = txt(this, 30, -36, it.name, 28, it.kind === 'cursed' ? '#d9a6ff' : EL_CSS[it.element]);
    const t2 = txt(this, 0, 2, ruleText(it), 32, it.kind === 'cursed' ? '#ff6a7a' : it.mult ? '#ffd84a' : '#b8f0a0');
    const t3 = txt(this, 0, 38, setLine(it, this.items), 18, EL_CSS[it.element], { strokeThickness: 4 });
    card.add([pg, tag, t1, t2, t3]); card.setAlpha(0);
    this.tweens.add({ targets: card, alpha: 1, duration: 150 }); popText(this, card, 1);
    this.addInvRow(this.items.length - 1, it);
    this.updateCounters();
    this.time.delayedCall(350, () => { this.canSkip = true; });
    this.autoNext = this.time.delayedCall(1900, () => this.next(true));
  }
  next(fromTimer) {
    if (this.done) return;
    if (fromTimer && this.tip && this.tip.visible) { this.autoNext = this.time.delayedCall(600, () => this.next(true)); return; } // let players read
    this.done = true; if (this.tip) this.tip.hide(true);
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
    this.res = computeDamage(this.items);
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
    button(this, W / 2, 470, 'PLAY AGAIN', () => this.scene.start('pick', { round: 0, items: [] }), 300);
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
