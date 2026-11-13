// ===== GAME LOGIC (pure, no Phaser) =====
const RULES = {
  rounds: 8,
  dragonHP: 1000,
  wood:  { min: 40, max: 70 },
  gold:  { accChance: 0.8, multMin: 0.3, multMax: 0.8, wMin: 20, wMax: 50 },
  black: { goodChance: 0.5, wMin: 160, wMax: 260, cMin: 60, cMax: 130 },
  setCount: 5, setMult: 2,
  offerWeights: { wood: 0.45, gold: 0.25, black: 0.30 },
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
const EL_CSS = { Fire: '#ff7a4a', Ice: '#7adcff', Thunder: '#ffe866' };
const NAMES = {
  pre: { Fire: ['Ember', 'Blaze', 'Inferno', 'Cinder', 'Frostfire'], Ice: ['Frost', 'Glacier', 'Rime', 'Winter', 'Frostfire'], Thunder: ['Storm', 'Volt', 'Thunder', 'Tempest', 'Skybolt'] },
  mid: ['Dragonbone', 'Runed', 'Ancient', 'Moonsteel', 'Obsidian', 'Royal', 'Elven', 'Dwarven'],
  weapon: [['Sword', 'i_sword'], ['Dagger', 'i_dagger'], ['Hammer', 'i_hammer'], ['Staff', 'i_magical_staff'], ['Bow', 'i_bow']],
  armor: [['Shield', 'i_shield'], ['Boots', 'i_boot']],
  accessory: [['Ring', 'i_big_coin'], ['Amulet', 'i_big_coin'], ['Elixir', 'i_potion_full'], ['Charm', 'i_pouch']],
  cursed: ['Cursed', 'Hexed', 'Doomed', 'Haunted'],
};
function nameItem(it) {
  const r = Math.random, p = (a) => a[Math.floor(r() * a.length)];
  if (it.kind === 'cursed') { const w = p(NAMES.weapon); it.icon = 'i_skull_left'; it.name = `${p(NAMES.cursed)} ${p(NAMES.pre[it.element])} ${w[0]}`; return it; }
  const base = p(NAMES[it.kind]); it.icon = base[1];
  it.name = `${p(NAMES.pre[it.element])} ${p(NAMES.mid)} ${base[0]}`;
  return it;
}
const statText = (it) => it.mult ? `+${it.mult.toFixed(1)}x DMG` : `${it.flat >= 0 ? '+' : ''}${it.flat} ATK`;

// ===== PHASER =====
const W = 1200, H = 628;
const FONT = '"Trebuchet MS", Verdana, sans-serif';
window.DC = { phase: 'boot', round: 0 };

function txt(scene, x, y, s, size, color = '#ffffff', extra = {}) {
  return scene.add.text(x, y, s, Object.assign({ fontFamily: FONT, fontSize: size + 'px', color, fontStyle: 'bold', stroke: '#000000', strokeThickness: Math.max(3, size / 8), align: 'center' }, extra)).setOrigin(0.5);
}
function sfx(scene, key, vol = 0.8) { try { scene.sound.play(key, { volume: vol }); } catch (e) {} }
function drawRoom(scene) {
  for (let x = 0; x < W; x += 128) for (let y = 128; y < H; y += 128) scene.add.image(x, y, 'floor').setOrigin(0).setTint(0x8a8aa0);
  for (let x = 0; x < W; x += 128) scene.add.image(x, 0, 'wall').setOrigin(0).setTint(0x9a9ab0);
  scene.add.rectangle(0, 0, W, H, 0x05040c, 0.35).setOrigin(0);
  const g = scene.add.graphics(); g.fillStyle(0x000000, 0.45); g.fillRect(0, 118, W, 10);
  [90, 1110].forEach((x) => { const t = scene.add.sprite(x, 70, 'torch1').setScale(1.3); t.play('torch'); scene.add.circle(x, 70, 70, 0xffa040, 0.08).setBlendMode(Phaser.BlendModes.ADD); });
}
function button(scene, x, y, label, cb, w = 260) {
  const c = scene.add.container(x, y);
  const bg = scene.add.rectangle(0, 0, w, 64, 0x7a1c12).setStrokeStyle(4, 0xffd36a);
  const t = txt(scene, 0, 0, label, 30, '#fff2c0');
  c.add([bg, t]); c.setSize(w, 64);
  bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => { sfx(scene, 'click'); cb(); });
  scene.tweens.add({ targets: c, scale: 1.05, yoyo: true, repeat: -1, duration: 600, ease: 'Sine.inOut' });
  return c;
}

class Boot extends Phaser.Scene {
  constructor() { super('boot'); }
  preload() {
    const bar = this.add.rectangle(W / 2 - 200, H / 2, 4, 20, 0xffd36a).setOrigin(0, 0.5);
    this.load.on('progress', (p) => bar.width = 400 * p);
    const I = 'assets/img/', A = 'assets/audio/';
    ['chest_wood', 'chest_gold', 'chest_black', 'open_wood', 'open_gold', 'open_black', 'dragon', 'knight', 'torch1', 'torch2', 'torch3', 'torch4',
      'i_sword', 'i_dagger', 'i_hammer', 'i_magical_staff', 'i_bow', 'i_shield', 'i_boot', 'i_big_coin', 'i_potion_full', 'i_pouch', 'i_skull_left'].forEach((k) => this.load.image(k, I + k + '.png'));
    this.load.image('floor', I + 'floor.jpg'); this.load.image('wall', I + 'wall.jpg');
    ['click', 'open', 'rare', 'curse', 'swing', 'hit', 'win', 'lose', 'music'].forEach((k) => this.load.audio(k, A + k + '.mp3'));
  }
  create() {
    ['dragon', 'knight', 'i_sword', 'i_dagger', 'i_hammer', 'i_magical_staff', 'i_bow', 'i_shield', 'i_boot', 'i_big_coin', 'i_potion_full', 'i_pouch', 'i_skull_left']
      .forEach((k) => this.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST));
    this.anims.create({ key: 'torch', frames: [1, 2, 3, 4].map((i) => ({ key: 'torch' + i })), frameRate: 8, repeat: -1 });
    this.scene.start('title');
  }
}

class Title extends Phaser.Scene {
  constructor() { super('title'); }
  create() {
    window.DC.phase = 'title';
    drawRoom(this);
    const d = this.add.image(W / 2, 250, 'dragon').setScale(0.9).setAlpha(0.9);
    this.tweens.add({ targets: d, y: 240, yoyo: true, repeat: -1, duration: 1400, ease: 'Sine.inOut' });
    txt(this, W / 2, 90, 'DRAGON CHEST', 84, '#ffd36a', { strokeThickness: 10 });
    txt(this, W / 2, 430, 'Open 8 chests. Then strike the dragon ONCE.', 30, '#ffffff');
    txt(this, W / 2, 470, 'Kill it, or get eaten.', 26, '#ff9a7a');
    const tap = txt(this, W / 2, 550, '▶  TAP TO START', 40, '#fff2c0');
    this.tweens.add({ targets: tap, alpha: 0.35, yoyo: true, repeat: -1, duration: 650 });
    this.input.once('pointerdown', () => {
      const ctx = this.sound.context; if (ctx && ctx.state === 'suspended') ctx.resume();
      if (!this.sound.get('music')) { try { this.sound.add('music', { loop: true, volume: 0.35 }).play(); } catch (e) {} }
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
    drawRoom(this);
    txt(this, W / 2, 46, `CHEST ${this.round + 1} / ${RULES.rounds}`, 40, '#ffd36a');
    txt(this, W / 2, 92, 'Pick one', 24, '#d8d0ff');
    this.drawInventory();
    this.offer = rollOffer(Math.random);
    const xs = [210, 470, 730];
    this.chests = this.offer.map((c, i) => {
      const x = xs[i], y = 300;
      const glow = this.add.circle(x, y + 10, 95, EL_COLOR[c.element], 0.18).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: glow, scale: 1.12, alpha: 0.28, yoyo: true, repeat: -1, duration: 900 + i * 120 });
      const spr = this.add.image(x, y, 'chest_' + c.type).setScale(1.05);
      const gem = this.add.star(x, y - 105, 4, 9, 20, EL_COLOR[c.element]).setStrokeStyle(3, 0x000000);
      this.tweens.add({ targets: gem, y: y - 113, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.inOut' });
      const label = txt(this, x, y + 108, { wood: 'Wooden', gold: 'Gold', black: 'Black' }[c.type], 26, { wood: '#e0b07a', gold: '#ffd84a', black: '#c9a6ff' }[c.type]);
      const el = txt(this, x, y + 140, c.element, 22, EL_CSS[c.element]);
      const zone = this.add.zone(x, y, 220, 280).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.choose(i));
      spr.setData('base', 1.05);
      this.tweens.add({ targets: spr, y: y - 4, yoyo: true, repeat: -1, duration: 800 + i * 150, ease: 'Sine.inOut' });
      return { c, x, y, spr, glow, gem, label, el, zone };
    });
    this.input.on('pointerdown', () => { if (this.canSkip) this.next(); });
  }
  drawInventory() {
    const x0 = 880, y0 = 150;
    this.add.rectangle(x0 - 15, y0 - 15, 330, 460, 0x000000, 0.55).setOrigin(0).setStrokeStyle(3, 0x6a5a3a);
    txt(this, x0 + 150, y0 + 10, 'BAG', 24, '#ffd36a');
    this.invRows = [];
    for (let i = 0; i < RULES.rounds; i++) this.addInvRow(i, this.items[i]);
  }
  addInvRow(i, it) {
    const x0 = 880, y = 205 + i * 50;
    if (!it) { this.add.rectangle(x0 + 2, y, 34, 34, 0xffffff, 0.06).setOrigin(0, 0.5); return; }
    const col = it.kind === 'cursed' ? 0xb070ff : EL_COLOR[it.element];
    this.add.image(x0 + 19, y, it.icon).setScale(0.6).setTint(col);
    const nm = it.name.length > 22 ? it.name.slice(0, 21) + '…' : it.name;
    this.add.text(x0 + 46, y - 11, nm, { fontFamily: FONT, fontSize: '17px', color: '#ffffff', fontStyle: 'bold' });
    this.add.text(x0 + 46, y + 8, statText(it), { fontFamily: FONT, fontSize: '14px', color: it.kind === 'cursed' ? '#ff7a8a' : it.mult ? '#ffd84a' : '#b8f0a0' });
  }
  choose(i) {
    if (this.locked) return; this.locked = true;
    const ch = this.chests[i];
    this.chests.forEach((o, j) => { o.zone.disableInteractive(); if (j !== i) { this.tweens.killTweensOf([o.spr, o.glow, o.gem]); this.tweens.add({ targets: [o.spr, o.glow, o.gem, o.label, o.el], alpha: 0.12, duration: 250 }); } });
    sfx(this, 'click');
    this.tweens.killTweensOf(ch.spr);
    this.tweens.add({ targets: ch.spr, x: { from: ch.x - 7, to: ch.x + 7 }, duration: 55, yoyo: true, repeat: 4, onComplete: () => this.reveal(ch) });
  }
  reveal(ch) {
    const it = nameItem(openChest(ch.c, Math.random));
    this.items.push(it);
    ch.spr.setTexture('open_' + ch.c.type).setX(ch.x);
    const big = it.kind === 'cursed' || it.mult >= 0.6 || it.flat >= 200;
    const flashCol = it.kind === 'cursed' ? 0x8a2aff : EL_COLOR[it.element];
    const burst = this.add.circle(ch.x, ch.y - 20, 30, flashCol, 0.9).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: burst, scale: big ? 7 : 4, alpha: 0, duration: 600, onComplete: () => burst.destroy() });
    if (big && it.kind !== 'cursed') this.cameras.main.flash(250, 255, 230, 150);
    if (it.kind === 'cursed') this.cameras.main.shake(300, 0.01);
    sfx(this, 'open');
    sfx(this, it.kind === 'cursed' ? 'curse' : big ? 'rare' : 'open', it.kind === 'cursed' || big ? 0.7 : 0.5);
    const icon = this.add.image(ch.x, ch.y - 10, it.icon).setScale(0.4).setTint(it.kind === 'cursed' ? 0xb070ff : EL_COLOR[it.element]);
    this.tweens.add({ targets: icon, y: ch.y - 150, scale: 1.6, duration: 450, ease: 'Back.out' });
    const card = this.add.container(W * 0.36, 535);
    const bg = this.add.rectangle(0, 0, 640, 84, 0x000000, 0.75).setStrokeStyle(3, it.kind === 'cursed' ? 0xb070ff : EL_COLOR[it.element]);
    const t1 = txt(this, 0, -16, it.name, 28, it.kind === 'cursed' ? '#d9a6ff' : EL_CSS[it.element]);
    const t2 = txt(this, 0, 20, `${it.kind === 'cursed' ? 'CURSED' : it.kind.toUpperCase()} · ${it.element === 'Shadow' ? '' : it.element + ' · '}${statText(it)}`, 20, it.kind === 'cursed' ? '#ff7a8a' : '#ffffff');
    card.add([bg, t1, t2]); card.setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: card, scale: 1, alpha: 1, duration: 250, ease: 'Back.out' });
    this.addInvRow(this.items.length - 1, it);
    this.time.delayedCall(350, () => { this.canSkip = true; });
    this.autoNext = this.time.delayedCall(1700, () => this.next());
  }
  next() {
    if (this.done) return; this.done = true;
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
    drawRoom(this);
    this.res = computeDamage(this.items);
    window.DC.result = this.res;
    this.dragon = this.add.image(860, 340, 'dragon').setScale(1.1);
    this.tweens.add({ targets: this.dragon, y: 330, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.inOut' });
    this.hero = this.add.image(250, 400, 'knight').setScale(1.4).setFlipX(true);
    txt(this, 860, 110, 'ANCIENT DRAGON', 34, '#ff8a6a');
    this.add.rectangle(860, 150, 420, 30, 0x220000).setStrokeStyle(3, 0xffffff);
    this.hp = this.add.rectangle(650, 150, 420, 24, 0xd22a2a).setOrigin(0, 0.5);
    this.hpText = txt(this, 860, 150, `${RULES.dragonHP} / ${RULES.dragonHP}`, 20);
    // equipped strip
    this.items.forEach((it, i) => this.add.image(70 + i * 56, 580, it.icon).setScale(0.75).setTint(it.kind === 'cursed' ? 0xb070ff : EL_COLOR[it.element]));
    txt(this, 250, 200, 'Your gear is ready.', 26);
    this.btn = button(this, 250, 270, 'STRIKE!', () => this.strike(), 240);
    window.DC.phase = 'strike-ready';
  }
  strike() {
    if (this.struck) return; this.struck = true; window.DC.phase = 'striking';
    this.btn.destroy();
    const r = this.res, win = r.total >= RULES.dragonHP;
    sfx(this, 'swing');
    this.tweens.add({
      targets: this.hero, x: 700, duration: 350, ease: 'Cubic.in', onComplete: () => {
        sfx(this, 'hit', 0.9);
        this.cameras.main.shake(400, 0.02); this.cameras.main.flash(200, 255, 255, 255);
        const slash = this.add.rectangle(860, 340, 380, 14, 0xffffff).setAngle(-35).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: slash, scaleY: 0, alpha: 0, duration: 400 });
        const dmg = txt(this, 860, 240, '0', 72, '#ffd36a', { strokeThickness: 10 });
        const parts = [`ATK ${r.flat}`, `x${(1 + r.mult).toFixed(1)}`]; if (r.set > 1) parts.push(`x${r.set} ${r.setEl} set`);
        txt(this, 860, 195, parts.join('  '), 22, '#ffffff');
        const counter = { v: 0 };
        this.tweens.add({
          targets: counter, v: r.total, duration: 1300, ease: 'Cubic.out',
          onUpdate: () => {
            const v = Math.round(counter.v); dmg.setText(v);
            const left = Math.max(0, RULES.dragonHP - v);
            this.hp.width = 420 * left / RULES.dragonHP; this.hpText.setText(`${left} / ${RULES.dragonHP}`);
          },
          onComplete: () => this.time.delayedCall(400, () => win ? this.winSeq() : this.loseSeq()),
        });
        this.tweens.add({ targets: this.hero, x: 400, duration: 400, delay: 200 });
      },
    });
  }
  winSeq() {
    sfx(this, 'win'); this.tweens.killTweensOf(this.dragon);
    this.tweens.add({ targets: this.dragon, angle: 90, y: 480, alpha: 0, duration: 900, ease: 'Cubic.in' });
    this.time.delayedCall(700, () => this.end(true));
  }
  loseSeq() {
    sfx(this, 'lose'); this.tweens.killTweensOf(this.dragon);
    this.tweens.add({
      targets: this.dragon, x: 420, scale: 1.6, duration: 450, ease: 'Back.in', onComplete: () => {
        this.hero.setVisible(false); this.cameras.main.shake(300, 0.02); this.cameras.main.flash(300, 160, 0, 0);
        this.time.delayedCall(500, () => this.end(false));
      },
    });
  }
  end(win) {
    window.DC.phase = 'end'; window.DC.win = win;
    this.add.rectangle(0, 0, W, H, 0x000000, 0.78).setOrigin(0);
    txt(this, W / 2, 80, win ? 'DRAGON SLAIN!' : 'THE DRAGON ATE YOU', 64, win ? '#ffd36a' : '#ff5a4a', { strokeThickness: 10 });
    txt(this, W / 2, 145, `You dealt ${this.res.total} / ${RULES.dragonHP}`, 28);
    txt(this, W / 2, 210, 'THE HIDDEN RULES', 26, '#c9a6ff');
    const lines = [
      ['Wooden = small steady ATK · Gold = damage multipliers', '#ffe7a0'],
      ['Black = 50% huge weapon, 50% curse', '#d9b8ff'],
      [`${RULES.setCount}+ items of one element = x${RULES.setMult} damage`, '#9adfff'],
    ];
    lines.forEach(([s, c], i) => txt(this, W / 2, 260 + i * 46, s, 28, c));
    button(this, W / 2, 520, 'PLAY AGAIN', () => this.scene.start('pick', { round: 0, items: [] }), 300);
  }
}

if (typeof Phaser !== 'undefined') {
  window.game = new Phaser.Game({
    type: Phaser.AUTO, width: W, height: H, backgroundColor: '#0b0912', parent: 'game',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { keyboard: false }, audio: { disableWebAudio: false },
    scene: [Boot, Title, Pick, Strike],
  });
}
