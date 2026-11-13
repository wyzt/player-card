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
  pre: { Fire: ['Ember', 'Blaze', 'Inferno', 'Cinder', 'Frostfire'], Ice: ['Frost', 'Glacier', 'Rime', 'Winter', 'Frostfire'], Thunder: ['Storm', 'Volt', 'Thunder', 'Tempest', 'Skybolt'] },
  mid: ['Dragonbone', 'Runed', 'Ancient', 'Moonsteel', 'Obsidian', 'Royal', 'Elven', 'Dwarven'],
  cursed: ['Cursed', 'Hexed', 'Doomed', 'Haunted'],
};
function nameItem(it) {
  const p = (a) => a[Math.floor(Math.random() * a.length)];
  if (it.kind === 'cursed') { const c = p(ICONS.cursed); it.frame = c[0]; it.name = `${p(NAMES.cursed)} ${p(NAMES.pre[it.element])} ${c[1]}`; return it; }
  const c = p(ICONS[it.kind][it.element]); it.frame = c[0];
  it.name = `${p(NAMES.pre[it.element])} ${p(NAMES.mid)} ${c[1]}`;
  return it;
}
const statText = (it) => it.mult ? `+${it.mult.toFixed(1)}x DMG` : `${it.flat >= 0 ? '+' : ''}${it.flat} ATK`;
const itemCol = (it) => it.kind === 'cursed' ? CURSE_COL : EL_COLOR[it.element];

// ===== PHASER =====
const W = 1200, H = 628;
const FONT = '"Trebuchet MS", Verdana, sans-serif';
window.DC = { phase: 'boot', round: 0 };

function txt(scene, x, y, s, size, color = '#ffffff', extra = {}) {
  return scene.add.text(x, y, s, Object.assign({ fontFamily: FONT, fontSize: size + 'px', color, fontStyle: 'bold', stroke: '#000000', strokeThickness: Math.max(3, size / 8), align: 'center' }, extra)).setOrigin(0.5);
}
function sfx(scene, key, vol = 0.8) { try { scene.sound.play(key, { volume: vol }); } catch (e) {} }
// 432x240 pixel backdrops, drawn at an exact 3x scale and centered
function backdrop(scene, key, dim) {
  scene.add.image(W / 2, H / 2, key).setScale(3);
  if (dim) scene.add.rectangle(0, 0, W, H, 0x0a0612, dim).setOrigin(0);
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
    ['chest_wood', 'chest_gold', 'chest_black', 'open_wood', 'open_gold', 'open_black', 'bg_hoard', 'bg_lava'].forEach((k) => this.load.image(k, I + k + '.png'));
    this.load.spritesheet('icons', I + 'icons.png', { frameWidth: 34, frameHeight: 34 });
    this.load.spritesheet('dragon_idle', I + 'dragon_idle.png', { frameWidth: 144, frameHeight: 64 });
    this.load.spritesheet('dragon_breath', I + 'dragon_breath.png', { frameWidth: 144, frameHeight: 64 });
    this.load.spritesheet('knight_idle', I + 'knight_idle.png', { frameWidth: 22, frameHeight: 24 });
    this.load.spritesheet('knight_run', I + 'knight_run.png', { frameWidth: 22, frameHeight: 24 });
    this.load.spritesheet('knight_attack', I + 'knight_attack.png', { frameWidth: 40, frameHeight: 30 });
    ['click', 'open', 'rare', 'curse', 'swing', 'hit', 'win', 'lose', 'music'].forEach((k) => this.load.audio(k, A + k + '.mp3'));
  }
  create() {
    const a = (key, tex, rate, repeat = -1) => this.anims.create({ key, frames: this.anims.generateFrameNumbers(tex), frameRate: rate, repeat });
    a('dragon-idle', 'dragon_idle', 8); a('dragon-breath', 'dragon_breath', 12, 0);
    a('knight-idle', 'knight_idle', 8); a('knight-run', 'knight_run', 14); a('knight-attack', 'knight_attack', 20, 0);
    this.scene.start('title');
  }
}

class Title extends Phaser.Scene {
  constructor() { super('title'); }
  create() {
    window.DC.phase = 'title';
    backdrop(this, 'bg_lava', 0.25);
    this.add.sprite(W / 2 + 190, 392, 'dragon_idle').setScale(4).setOrigin(0.5, 1).play('dragon-idle');
    this.add.sprite(W / 2 - 290, 392, 'knight_idle').setScale(5).setOrigin(0.5, 1).play('knight-idle');
    txt(this, W / 2, 90, 'DRAGON CHEST', 84, '#ffd36a', { strokeThickness: 10 });
    txt(this, W / 2, 432, 'Open 8 chests. Then strike the dragon ONCE.', 30, '#ffffff');
    txt(this, W / 2, 472, 'Kill it, or get eaten.', 26, '#ff9a7a');
    const tap = txt(this, W / 2, 550, '▶  TAP TO START', 40, '#fff2c0');
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
    backdrop(this, 'bg_hoard', 0.5);
    txt(this, 430, 46, `CHEST ${this.round + 1} / ${RULES.rounds}`, 40, '#ffd36a');
    txt(this, 430, 92, 'Pick one', 24, '#f0e6ff');
    this.drawInventory();
    this.offer = rollOffer(Math.random);
    const xs = [170, 430, 690];
    this.chests = this.offer.map((c, i) => {
      const x = xs[i], y = 300;
      const glow = this.add.circle(x, y + 10, 100, EL_COLOR[c.element], 0.2).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: glow, scale: 1.12, alpha: 0.32, yoyo: true, repeat: -1, duration: 900 + i * 120 });
      const spr = this.add.image(x, y, 'chest_' + c.type).setScale(5);
      const gem = this.add.star(x, y - 112, 4, 9, 20, EL_COLOR[c.element]).setStrokeStyle(3, 0x000000);
      this.tweens.add({ targets: gem, y: y - 120, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.inOut' });
      const label = txt(this, x, y + 112, { wood: 'Wooden', gold: 'Gold', black: 'Black' }[c.type], 28, { wood: '#f0c08a', gold: '#ffd84a', black: '#c9a6ff' }[c.type]);
      const el = txt(this, x, y + 145, c.element, 22, EL_CSS[c.element]);
      const zone = this.add.zone(x, y, 220, 280).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.choose(i));
      this.tweens.add({ targets: spr, y: y - 5, yoyo: true, repeat: -1, duration: 800 + i * 150, ease: 'Sine.inOut' });
      return { c, x, y, spr, glow, gem, label, el, zone };
    });
    this.input.on('pointerdown', () => { if (this.canSkip) this.next(); });
  }
  drawInventory() {
    const x0 = 880, y0 = 150;
    this.add.rectangle(x0 - 15, y0 - 15, 330, 460, 0x000000, 0.65).setOrigin(0).setStrokeStyle(3, 0x8a6a3a);
    txt(this, x0 + 150, y0 + 10, 'BAG', 24, '#ffd36a');
    for (let i = 0; i < RULES.rounds; i++) this.addInvRow(i, this.items[i]);
  }
  addInvRow(i, it) {
    const x0 = 880, y = 205 + i * 50;
    if (!it) { this.add.rectangle(x0 + 2, y, 38, 38, 0xffffff, 0.07).setOrigin(0, 0.5); return; }
    this.add.rectangle(x0 + 21, y, 42, 42, itemCol(it), 0.35).setStrokeStyle(2, itemCol(it));
    this.add.image(x0 + 21, y, 'icons', it.frame);
    const nm = it.name.length > 22 ? it.name.slice(0, 21) + '…' : it.name;
    this.add.text(x0 + 50, y - 12, nm, { fontFamily: FONT, fontSize: '17px', color: '#ffffff', fontStyle: 'bold' });
    this.add.text(x0 + 50, y + 7, statText(it), { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: it.kind === 'cursed' ? '#ff7a8a' : it.mult ? '#ffd84a' : '#b8f0a0' });
  }
  choose(i) {
    if (this.locked) return; this.locked = true;
    const ch = this.chests[i];
    this.chests.forEach((o, j) => { o.zone.disableInteractive(); if (j !== i) { this.tweens.killTweensOf([o.spr, o.glow, o.gem]); this.tweens.add({ targets: [o.spr, o.glow, o.gem, o.label, o.el], alpha: 0.12, duration: 250 }); } });
    sfx(this, 'click');
    this.tweens.killTweensOf(ch.spr);
    this.tweens.add({ targets: ch.spr, x: { from: ch.x - 6, to: ch.x + 6 }, duration: 55, yoyo: true, repeat: 4, onComplete: () => this.reveal(ch) });
  }
  reveal(ch) {
    const it = nameItem(openChest(ch.c, Math.random));
    this.items.push(it);
    ch.spr.setTexture('open_' + ch.c.type).setX(ch.x);
    const big = it.kind === 'cursed' || it.mult >= 0.6 || it.flat >= 200;
    const burst = this.add.circle(ch.x, ch.y - 20, 30, itemCol(it), 0.9).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: burst, scale: big ? 7 : 4, alpha: 0, duration: 600, onComplete: () => burst.destroy() });
    if (big && it.kind !== 'cursed') this.cameras.main.flash(250, 255, 230, 150);
    if (it.kind === 'cursed') this.cameras.main.shake(300, 0.01);
    sfx(this, 'open');
    sfx(this, it.kind === 'cursed' ? 'curse' : big ? 'rare' : 'open', it.kind === 'cursed' || big ? 0.7 : 0.5);
    const icon = this.add.image(ch.x, ch.y - 10, 'icons', it.frame).setScale(1);
    this.tweens.add({ targets: icon, y: ch.y - 150, scale: 3, duration: 450, ease: 'Back.out' });
    const card = this.add.container(430, 540);
    const bg = this.add.rectangle(0, 0, 680, 84, 0x000000, 0.8).setStrokeStyle(3, itemCol(it));
    const t1 = txt(this, 0, -16, it.name, 28, it.kind === 'cursed' ? '#d9a6ff' : EL_CSS[it.element]);
    const t2 = txt(this, 0, 20, `${it.kind === 'cursed' ? 'CURSED' : it.kind.toUpperCase()} · ${it.element} · ${statText(it)}`, 20, it.kind === 'cursed' ? '#ff7a8a' : '#ffffff');
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
    backdrop(this, 'bg_lava', 0.15);
    this.res = computeDamage(this.items);
    window.DC.result = this.res;
    const GROUND = 560; // lava floor line of the 3x backdrop
    this.dragon = this.add.sprite(880, GROUND, 'dragon_idle').setScale(4).setOrigin(0.5, 1).play('dragon-idle');
    this.hero = this.add.sprite(230, GROUND, 'knight_idle').setScale(5).setOrigin(0.5, 1).play('knight-idle');
    this.add.rectangle(860, 110, 460, 96, 0x000000, 0.45);
    txt(this, 860, 85, 'ANCIENT DRAGON', 34, '#ff8a6a');
    this.add.rectangle(860, 128, 420, 30, 0x220000).setStrokeStyle(3, 0xffffff);
    this.hp = this.add.rectangle(650, 128, 420, 24, 0xd22a2a).setOrigin(0, 0.5);
    this.hpText = txt(this, 860, 128, `${RULES.dragonHP} / ${RULES.dragonHP}`, 20);
    this.add.rectangle(0, 590, 8 * 50 + 30, 56, 0x000000, 0.55).setOrigin(0, 0.5);
    this.items.forEach((it, i) => {
      this.add.rectangle(35 + i * 50, 590, 42, 42, itemCol(it), 0.35).setStrokeStyle(2, itemCol(it));
      this.add.image(35 + i * 50, 590, 'icons', it.frame);
    });
    txt(this, 250, 200, 'Your gear is ready.', 26);
    this.btn = button(this, 250, 270, 'STRIKE!', () => this.strike(), 240);
    window.DC.phase = 'strike-ready';
  }
  strike() {
    if (this.struck) return; this.struck = true; window.DC.phase = 'striking';
    this.btn.destroy();
    const r = this.res, win = r.total >= RULES.dragonHP;
    this.hero.play('knight-run');
    this.tweens.add({
      targets: this.hero, x: 520, duration: 420, ease: 'Cubic.in', onComplete: () => {
        sfx(this, 'swing');
        this.hero.play('knight-attack');
        this.time.delayedCall(220, () => this.impact(r, win));
        this.hero.once('animationcomplete', () => this.hero.play('knight-idle'));
      },
    });
  }
  impact(r, win) {
    sfx(this, 'hit', 0.9);
    this.cameras.main.shake(400, 0.02); this.cameras.main.flash(200, 255, 255, 255);
    this.dragon.setTintFill(0xffffff); this.time.delayedCall(120, () => this.dragon.clearTint());
    const slash = this.add.rectangle(780, 430, 380, 14, 0xffffff).setAngle(-35).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: slash, scaleY: 0, alpha: 0, duration: 400 });
    const dmg = txt(this, 860, 230, '0', 72, '#ffd36a', { strokeThickness: 10 });
    const parts = [`ATK ${r.flat}`, `x${(1 + r.mult).toFixed(1)}`]; if (r.set > 1) parts.push(`x${r.set} ${r.setEl} set`);
    txt(this, 860, 178, parts.join('  '), 22, '#ffffff');
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
  }
  winSeq() {
    sfx(this, 'win'); this.dragon.stop();
    this.tweens.add({ targets: this.dragon, alpha: 0, y: this.dragon.y + 60, duration: 900, ease: 'Cubic.in' });
    this.dragon.setTint(0x777777);
    this.time.delayedCall(700, () => this.end(true));
  }
  loseSeq() {
    sfx(this, 'lose');
    this.tweens.add({
      targets: this.dragon, x: 760, duration: 250, onComplete: () => {
        this.dragon.play('dragon-breath');
        this.time.delayedCall(300, () => {
          this.hero.setTint(0xff4020); this.cameras.main.shake(300, 0.02); this.cameras.main.flash(300, 200, 40, 0);
          this.tweens.add({ targets: this.hero, alpha: 0, duration: 300 });
        });
        this.dragon.once('animationcomplete', () => { this.dragon.play('dragon-idle'); this.time.delayedCall(300, () => this.end(false)); });
      },
    });
  }
  end(win) {
    window.DC.phase = 'end'; window.DC.win = win;
    this.add.rectangle(0, 0, W, H, 0x000000, 0.8).setOrigin(0);
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
    pixelArt: true, roundPixels: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { keyboard: false }, audio: { disableWebAudio: false },
    scene: [Boot, Title, Pick, Strike],
  });
}
