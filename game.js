// ===== GAME LOGIC (pure, no Phaser) =====
// ENDLESS: every stage = ONE chest pick (pick 1 of 3), then ONE strike. Kill -> next stage, forever.
// Every 5th stage is a BIG BOSS: more HP, better loot in its chest, guaranteed bonus chest on the kill.
// Boss HP grows exponentially; new loot scales with the stage; gear lives in fixed slots and auto-upgrades.
const RULES = {
  picksPerStage: 1,
  hp0: 30, hpGrowth: 2.1,          // boss HP at stage s (0-based) = hp0 * hpGrowth^s
  bigEvery: 5, bigHp: 2.5, bigTier: 3,   // BIG BOSS: x2.5 HP, loot rolls rarities as if 3 stages later
  lootGrowth: 1.3,                 // flat ATK of loot found at stage s is x lootGrowth^s
  wood:  { min: 9, max: 18, spread: 0.35 },
  gold:  { accChance: 0.7, multMin: 0.3, multMax: 0.8, wMin: 30, wMax: 60, spread: 0.3 },
  // BLACK = pure gamble: the good side is a big weapon rolled several stages' rarity ahead; the bad side is a CURSE
  black: { safeStages: 3, goodFirst: 0.9, good: 0.6, wMin: 190, wMax: 290, wSpread: 0.2, tierBoost: 4 },
  // CURSE: no item, no slot, no compensation - one RANDOM debuff for the next `stages` stages (this one included).
  // Several curses stack. weak: damage x0.5 | elem: one element's items do nothing (no ATK, no x, no set) |
  // minroll: weapons & armor roll their minimum | hp: boss HP x1.5 | rarity: chests roll one rarity lower
  curse: { stages: 3, pool: ['weak', 'elem', 'minroll', 'hp', 'rarity'], weak: 0.5, hp: 1.5, demote: 0.7 },
  baseAtk: 25,                     // the hero's own swing
  slots: { weapon: 3, armor: 2, accessory: 3 },
  maxStars: 5,                     // ★1..★5 (each star doubles the item); a merge into a ★5 item salvages instead
  // ELEMENT SYNERGIES (count of equipped items of an element -> level 0..3 at 2/4/6 items), each element plays differently:
  // FIRE burn: the hit keeps burning for +x% of it over 3 ticks (steady). ICE frostbite: boss takes x more from everything
  // and crit chance rises (amplifier). THUNDER chain: a chance for a huge chain crit (swingy).
  elem: { at: [2, 4, 6], baseCrit: 0.05, critX: 2,
    Fire: { burn: [0, 0.35, 0.8, 1.4], ticks: 3 },
    Ice: { vuln: [1, 1.15, 1.35, 1.6], crit: [0, 0.1, 0.2, 0.3] },
    Thunder: { chance: [0, 0.25, 0.35, 0.45], mult: [1, 3, 3.5, 4.5] } },
  // rarities above Legendary: chance per chest grows with the stage; power multiplier for flat ATK / for multipliers
  tiers: { MYTHIC: { from: 4, per: 0.03, max: 0.3, pow: 3, mpow: 2 }, COSMIC: { from: 10, per: 0.02, max: 0.25, pow: 10, mpow: 4 } },
  salvage: { COMMON: 0.01, RARE: 0.02, EPIC: 0.03, LEGENDARY: 0.05, MYTHIC: 0.08, COSMIC: 0.12 },
  offerWeights: { wood: 0.4, gold: 0.27, black: 0.33 },
  // overkill bonus after every kill (q = damage / boss HP): q<3 trophy (wooden roll), 3<=q<8 bonus chest (no curse), q>=8 jackpot
  bonus: { chestAt: 3, jackpotAt: 8, chestWeights: { wood: 0.3, gold: 0.35, black: 0.35 }, jackpotLeg: 0.5, jackpotTier: 6 },
  milestone: 5,                    // victory fanfare every 5 stages
  variants: { weapon: 5, armor: 2, accessory: 2, cursed: 4 },
  cap: 1e300,                      // doubles: never reach Infinity
};
const TYPES = ['wood', 'gold', 'black'];
const ELEMENTS = ['Fire', 'Ice', 'Thunder'];
const CATS = ['weapon', 'armor', 'accessory'];
const RANKS = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC', 'COSMIC'];
const ri = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const capN = (x) => (x > RULES.cap ? RULES.cap : x < -RULES.cap ? -RULES.cap : x);
const isBig = (s) => (s + 1) % RULES.bigEvery === 0;
const bossHp = (s) => capN(RULES.hp0 * Math.pow(RULES.hpGrowth, s) * (isBig(s) ? RULES.bigHp : 1));
const lootScale = (s) => capN(Math.pow(RULES.lootGrowth, s));
function rollOffer(rng) {
  const w = RULES.offerWeights;
  const one = () => { const x = rng(); return x < w.wood ? 'wood' : x < w.wood + w.gold ? 'gold' : 'black'; };
  return [0, 1, 2].map(() => ({ type: one(), element: pick(rng, ELEMENTS) }));
}
const starK = (it) => Math.pow(2, (it.stars || 1) - 1);   // every star doubles the item
// effective (star-boosted) numbers
const eLo = (it) => capN(it.lo * starK(it)), eHi = (it) => capN(it.hi * starK(it)), eMult = (it) => it.mult * starK(it);
const eAvg = (it) => (eLo(it) + eHi(it)) / 2;
// make an item: c = unscaled centre value (for flat items) or m (for accessories)
function mkItem(kind, el, c, sp, s, rng, tierBoost = 0, isMult = false) {
  const it = { kind, element: el, v: ri(rng, 0, RULES.variants[kind] - 1), stars: 1, stage: s, mult: 0, lo: 0, hi: 0, flat: 0 };
  let rank = isMult ? (c >= 0.5 ? 3 : c >= 0.4 ? 2 : 1) : (c >= 240 ? 3 : c >= 150 ? 2 : 0);
  if (kind !== 'cursed') {
    const T = RULES.tiers, x = rng(), sb = s + tierBoost;
    const pc = sb >= T.COSMIC.from ? Math.min(T.COSMIC.max, (sb - T.COSMIC.from + 1) * T.COSMIC.per) : 0;
    const pm = sb >= T.MYTHIC.from ? Math.min(T.MYTHIC.max, (sb - T.MYTHIC.from + 1) * T.MYTHIC.per) : 0;
    if (x < pc) rank = 5; else if (x < pc + pm) rank = 4;
  }
  const P = rank === 5 ? RULES.tiers.COSMIC : rank === 4 ? RULES.tiers.MYTHIC : null;
  it.rarity = kind === 'cursed' ? 'CURSED' : RANKS[rank];
  if (isMult) { it.mult = Math.round(c * (P ? P.mpow : 1) * 10) / 10; return it; }
  const k = lootScale(s) * (P ? P.pow : 1), h = c * sp;
  it.flat = capN(c * k); it.lo = capN((c - h) * k); it.hi = capN((c + h) * k);
  if (kind === 'cursed') { it.flat = -it.flat; const lo = -it.hi; it.hi = -it.lo; it.lo = lo; }
  return it;
}
function mkCurse(el, s, rng) {
  const d = pick(rng, RULES.curse.pool);
  return { kind: 'cursed', element: el, v: ri(rng, 0, RULES.variants.cursed - 1), stars: 1, stage: s, rarity: 'CURSED', mult: 0, lo: 0, hi: 0, flat: 0, debuff: d, delem: d === 'elem' ? pick(rng, ELEMENTS) : null };
}
function openChest(chest, rng, s = 0, noCurse = false, tierBoost = 0) {
  const R = RULES, el = chest.element;
  if (chest.type === 'wood') return mkItem(pick(rng, ['weapon', 'armor']), el, ri(rng, R.wood.min, R.wood.max), R.wood.spread, s, rng, tierBoost - 3);
  if (chest.type === 'gold') {
    if (rng() < R.gold.accChance) return mkItem('accessory', el, ri(rng, R.gold.multMin * 10, R.gold.multMax * 10) / 10, 0, s, rng, tierBoost, true);
    return mkItem(pick(rng, ['weapon', 'armor']), el, ri(rng, R.gold.wMin, R.gold.wMax), R.gold.spread, s, rng, tierBoost);
  }
  if (noCurse || rng() < (s < R.black.safeStages ? R.black.goodFirst : R.black.good)) return mkItem('weapon', el, ri(rng, R.black.wMin, R.black.wMax), R.black.wSpread, s, rng, tierBoost + R.black.tierBoost);
  return mkCurse(el, s, rng);
}
// reward for overkilling a boss; null if the boss survived
function bonusDrop(dmg, hp, rng, s = 0) {
  const B = RULES.bonus, el = pick(rng, ELEMENTS); let q = dmg / hp; if (!(q >= 1)) return null;
  if (isBig(s)) q = Math.max(q, B.chestAt); // a BIG BOSS always drops at least a bonus chest
  if (q < B.chestAt) return { tier: 'minor', type: 'wood', item: openChest({ type: 'wood', element: el }, rng, s) };
  if (q < B.jackpotAt) {
    const x = rng(), w = B.chestWeights, type = x < w.wood ? 'wood' : x < w.wood + w.gold ? 'gold' : 'black';
    return { tier: 'chest', type, item: openChest({ type, element: el }, rng, s, true) };
  }
  if (rng() < B.jackpotLeg) return { tier: 'jackpot', type: 'black', item: mkItem('weapon', el, ri(rng, 240, 290), RULES.black.wSpread, s, rng, B.jackpotTier) };
  return { tier: 'jackpot', type: 'gold', item: mkItem('accessory', el, ri(rng, 5, 6) / 10, 0, s, rng, B.jackpotTier, true) };
}
// ---- gear: fixed slots per category, duplicates merge into stars, a full category auto-keeps the best loadout ----
function newGear() { return { weapon: [], armor: [], accessory: [], debuffs: [], salv: 0 }; }
const hasDb = (G, id) => G.debuffs.some((d) => d.id === id);
const weakMult = (G) => G.debuffs.reduce((a, d) => (d.id === 'weak' ? a * RULES.curse.weak : a), 1);
const hpMult = (G) => G.debuffs.reduce((a, d) => (d.id === 'hp' ? a * RULES.curse.hp : a), 1);
const offEls = (G) => G.debuffs.filter((d) => d.id === 'elem').map((d) => d.el);
const stageHp = (s, G) => capN(bossHp(s) * hpMult(G));   // the HP you actually have to beat
function tickCurse(G) { G.debuffs.forEach((d) => d.left--); G.debuffs = G.debuffs.filter((d) => d.left > 0); } // after every strike
// 'rarity' debuff: a found item drops one rarity tier (Mythic/Cosmic lose their power boost, others lose 30%)
function demote(it) {
  if (it.kind === 'cursed') return it;
  const T = RULES.tiers, r = RANKS.indexOf(it.rarity);
  const k = it.rarity === 'COSMIC' ? T.MYTHIC.pow / T.COSMIC.pow : it.rarity === 'MYTHIC' ? 1 / T.MYTHIC.pow : RULES.curse.demote;
  const km = it.rarity === 'COSMIC' ? T.MYTHIC.mpow / T.COSMIC.mpow : it.rarity === 'MYTHIC' ? 1 / T.MYTHIC.mpow : RULES.curse.demote;
  if (it.kind === 'accessory') it.mult = Math.max(0.1, Math.round(it.mult * km * 10) / 10);
  else { it.lo *= k; it.hi *= k; it.flat *= k; }
  it.rarity = RANKS[Math.max(0, r - 1)]; it.demoted = true;
  return it;
}
const gearList = (G) => [...G.weapon, ...G.armor, ...G.accessory];
function elemLv(list) {
  const cnt = { Fire: 0, Ice: 0, Thunder: 0 }; list.forEach((it) => { if (cnt[it.element] !== undefined) cnt[it.element]++; });
  const lv = {}; ELEMENTS.forEach((e) => { lv[e] = RULES.elem.at.filter((k) => cnt[e] >= k).length; });
  return { cnt, lv };
}
function synergy(list) { // the numbers each element gives right now
  const E = RULES.elem, { cnt, lv } = elemLv(list);
  return { cnt, lv, burn: E.Fire.burn[lv.Fire], vuln: E.Ice.vuln[lv.Ice], crit: E.baseCrit + E.Ice.crit[lv.Ice], chance: E.Thunder.chance[lv.Thunder], chainX: E.Thunder.mult[lv.Thunder] };
}
const synExp = (y) => (1 + y.burn) * y.vuln * (1 + y.crit * (RULES.elem.critX - 1)) * (1 + y.chance * (y.chainX - 1));
// expected damage of a loadout (average rolls, curses ignored) - used to decide what to keep
function expDamage(list, salv, s) {
  let flat = RULES.baseAtk, mult = 1;
  list.forEach((it) => { if (it.kind === 'accessory') mult *= 1 + eMult(it); else flat += eAvg(it); });
  return capN(flat * mult * synExp(synergy(list)) * (1 + salv));
}
// hero POWER shown in the HUD: the expected strike damage of the current gear incl. synergies and active curses (not a guarantee)
function expStrike(G) {
  const off = offEls(G), minr = hasDb(G, 'minroll'), list = gearList(G).filter((it) => !off.includes(it.element));
  let flat = RULES.baseAtk, mult = 1;
  list.forEach((it) => { if (it.kind === 'accessory') mult *= 1 + eMult(it); else flat += minr ? eLo(it) : eAvg(it); });
  return capN(Math.max(0, flat) * mult * synExp(synergy(list)) * (1 + G.salv) * weakMult(G));
}
const itemPower = (it) => it.kind === 'accessory' ? eMult(it) : eAvg(it);
const salvageVal = (it) => (RULES.salvage[it.rarity] || 0.01) * (it.stars || 1);
// returns what happened, for the UI: curse | merge | equip | replace | salvage
function equip(G, it, s = 0) {
  if (it.kind === 'cursed') {
    let el = it.delem; if (it.debuff === 'elem') { const free = ELEMENTS.filter((e) => !offEls(G).includes(e)); if (free.length && !free.includes(el)) el = free[0]; }
    const d = { id: it.debuff, el, left: RULES.curse.stages }; G.debuffs.push(d);
    return { type: 'curse', item: it, debuff: d };
  }
  const cat = G[it.kind];
  const dup = cat.find((x) => x.v === it.v && x.element === it.element);
  if (dup && (dup.stars || 1) >= RULES.maxStars) { const gain = salvageVal(it); G.salv += gain; return { type: 'salvage', item: it, gain, maxed: dup }; }
  if (dup) {
    const old = { ...dup };
    if (itemPower({ ...it, stars: 1 }) > itemPower({ ...dup, stars: 1 })) ['lo', 'hi', 'flat', 'mult', 'rarity', 'stage', 'np', 'frame'].forEach((k) => { if (it[k] !== undefined) dup[k] = it[k]; });
    dup.stars = (dup.stars || 1) + 1;
    return { type: 'merge', item: dup, old, stars: dup.stars };
  }
  if (cat.length < RULES.slots[it.kind]) { cat.push(it); return { type: 'equip', item: it }; }
  const list = gearList(G), base = expDamage(list, G.salv, s);
  let best = -1, bestV = base;
  cat.forEach((old, j) => {
    const trial = list.map((x) => (x === old ? it : x));
    const v = expDamage(trial, G.salv, s);
    if (v > bestV * 1.0000001) { bestV = v; best = j; }
  });
  if (best < 0) { const gain = salvageVal(it); G.salv += gain; return { type: 'salvage', item: it, gain }; }
  const old = cat[best], gain = salvageVal(old);
  cat[best] = it; G.salv += gain;
  return { type: 'replace', item: it, old, gain, slot: best };
}
// rng given -> roll every item inside its range; no rng -> use the average (for previews)
function rollItem(it, rng) { const lo = eLo(it), hi = eHi(it); return lo === hi ? lo : rng ? lo + rng() * (hi - lo) : (lo + hi) / 2; }
function computeDamage(G, rng, s = 0) {
  const off = offEls(G), minr = hasDb(G, 'minroll');
  const list = gearList(G).filter((it) => !off.includes(it.element)), base = RULES.baseAtk;   // disabled element: those items do nothing
  const flatItems = list.filter((it) => it.kind !== 'accessory');
  const rolls = flatItems.map((it) => (minr ? eLo(it) : rollItem(it, rng)));
  let flat = base; rolls.forEach((r) => (flat += r));
  let mult = 1; const mults = list.filter((it) => it.kind === 'accessory').map((it) => 1 + eMult(it)); mults.forEach((m) => (mult *= m));
  const Y = synergy(list), raw = flat; flat = Math.max(0, flat);
  const r1 = rng ? rng() : 1, r2 = rng ? rng() : 1;
  const crit = r1 < Y.crit, chain = Y.chance > 0 && r2 < Y.chance;
  const glob = 1 + G.salv, cm = weakMult(G);
  const critX = crit ? RULES.elem.critX : 1, chainX = chain ? Y.chainX : 1;
  const hit = capN(flat * mult * glob * cm * Y.vuln * critX * chainX), burn = capN(hit * Y.burn);
  const n = RULES.elem.Fire.ticks, ticks = Y.burn > 0 ? Array.from({ length: n }, () => burn / n) : [];
  return { base, flatItems, rolls, raw, flat, mults, mult: capN(mult), glob, weak: cm, off, minr, Y, vuln: Y.vuln, crit, critX, chain, chainX, hit, burn, ticks, total: capN(hit + burn) };
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
// the variant (it.v, rolled by the logic) picks the icon + noun, so duplicates look identical and merge into stars
function nameItem(it) {
  const r = (n) => Math.floor(Math.random() * n);
  const pool = it.kind === 'cursed' ? ICONS.cursed : ICONS[it.kind][it.element], c = pool[(it.v || 0) % pool.length];
  it.frame = c[0];
  it.np = it.kind === 'cursed' ? { cur: r(4), pre: r(5), noun: NOUN_KEYS.indexOf(c[1]) } : { pre: r(5), mid: r(8), noun: NOUN_KEYS.indexOf(c[1]) };
  Object.defineProperty(it, 'name', { get() { return itemName(this); }, configurable: true, enumerable: false }); // localized on every read
  return it;
}
function itemName(it) {
  const N = t('names'), pre = N.pre[it.element][it.np.pre], noun = N.noun[it.np.noun];
  return it.kind === 'cursed' ? N.fmtCur(N.cur[it.np.cur], pre, noun) : N.fmt(pre, N.mid[it.np.mid], noun);
}
const elName = (e) => t('el')[e];
// Every item states its own damage rule.
const fmtX = (x) => '×' + (x >= 1e4 ? fmt(x) : x >= 100 ? Math.round(x) : x >= 10 ? x.toFixed(1) : x.toFixed(2).replace(/0$/, ''));
const dbDescOf = (d) => t('dbDesc')[d.id].replace('{el}', elName(d.el || 'Fire'));
const ruleText = (it) => it.kind === 'cursed' ? t('curseRule', t('db')[it.debuff], RULES.curse.stages) : it.kind === 'accessory' ? t('ruleMult', fmtX(1 + eMult(it))) : t('ruleFlat', fmt(eLo(it)), fmt(eHi(it)));
const starStr = (it) => (it.stars || 1) > 1 ? '★' + it.stars + ' ' : '';
const elemCount = (items, el) => items.filter((i) => i.element === el).length;
// element synergy text: [name + level line, effect line]
function synLines(el, items) {
  const Y = synergy(items), n = Y.cnt[el], lv = Y.lv[el], nx = RULES.elem.at[lv];
  const E = RULES.elem, P = (x) => Math.round(x * 100);
  const fx = !lv ? t('synOff') : el === 'Fire' ? t('synFx').Fire(P(E.Fire.burn[lv])) : el === 'Ice' ? t('synFx').Ice(P(E.Ice.vuln[lv] - 1), P(Y.crit)) : t('synFx').Thunder(P(E.Thunder.chance[lv]), E.Thunder.mult[lv]);
  return [`${elName(el)} ${t('syn')[el]} · ${t('synLv', n, lv, nx)}`, fx];
}
const DB_COL = { weak: '#ff7a9a', elem: '#c8a0ff', minroll: '#d0b090', hp: '#ff6a4a', rarity: '#a0a0c0' };
const itemCol = (it) => it.kind === 'cursed' ? CURSE_COL : EL_COLOR[it.element];
const RARITY = {
  COMMON: { css: '#d8d8d8', col: 0xd8d8d8, n: 10, shake: 0 },
  RARE: { css: '#7adcff', col: 0x7adcff, n: 22, shake: 0 },
  EPIC: { css: '#d58cff', col: 0xd58cff, n: 36, shake: 0.006 },
  LEGENDARY: { css: '#ffcf40', col: 0xffcf40, n: 60, shake: 0.012 },
  MYTHIC: { css: '#ff6a7a', col: 0xff4a64, n: 76, shake: 0.014 },
  COSMIC: { css: '#8af6ff', col: 0x6af0ff, n: 96, shake: 0.016 },
  CURSED: { css: '#ff6a8a', col: 0x9a3aff, n: 44, shake: 0.012 },
};

// Bosses, in order of menace (all CC0 by ansimuz). fw/fh = frame size; head/mouth/body in frame pixels (all face left).
// After the 15th the roster cycles with a tier prefix (ELDER, ABYSSAL, ...), a palette tint and a slightly bigger body.
const BOSSES = [
  { tex: 'b_mushroom', anim: 'b-mushroom', fw: 27, fh: 27, n: 4, fps: 6, scale: 5.5, head: [13, 9], mouth: [11, 11], body: [13, 18], col: '#ff8aa0' },
  { tex: 'b_frog', anim: 'b-frog', fw: 41, fh: 35, n: 4, fps: 6, scale: 5.0, head: [5, 19], mouth: [3, 21], body: [19, 30], col: '#8aff9a' },
  { tex: 'b_snake', anim: 'b-snake', fw: 18, fh: 18, n: 4, fps: 6, scale: 8.5, head: [8, 4], mouth: [6, 6], body: [9, 12], col: '#6ae0a0' },
  { tex: 'b_lizard', anim: 'b-lizard', fw: 25, fh: 13, n: 4, fps: 7, scale: 10.0, head: [4, 5], mouth: [2, 7], body: [12, 18], col: '#e08aff' },
  { tex: 'hound_idle', anim: 'hound-idle', fw: 64, fh: 32, scale: 4.5, head: [15, 16], mouth: [12, 20], body: [30, 40], col: '#ff9a5a' },
  { tex: 'b_bird', anim: 'b-bird', fw: 27, fh: 26, n: 7, fps: 10, scale: 7.5, head: [4, 13], mouth: [2, 15], body: [13, 20], col: '#8ae2ff' },
  { tex: 'b_sghost', anim: 'b-sghost', fw: 30, fh: 37, n: 6, fps: 8, scale: 5.5, head: [14, 10], mouth: [12, 12], body: [14, 22], col: '#ff8ad8' },
  { tex: 'b_skull', anim: 'b-skull', fw: 91, fh: 100, n: 8, fps: 10, scale: 2.5, head: [42, 41], mouth: [40, 47], body: [42, 54], col: '#ffa040' },
  { tex: 'b_reaper', anim: 'b-reaper', fw: 30, fh: 48, n: 7, fps: 8, scale: 5.5, head: [14, 14], mouth: [12, 17], body: [14, 19], col: '#8ab8ff' },
  { tex: 'beast_idle', anim: 'beast-idle', fw: 55, fh: 67, scale: 3.4, head: [21, 28], mouth: [19, 32], body: [28, 46], col: '#ff6a5a' },
  { tex: 'b_nightmare', anim: 'b-nightmare', fw: 102, fh: 90, n: 4, fps: 7, scale: 3.0, head: [12, 49], mouth: [10, 55], body: [46, 73], col: '#7ad8ff' },
  { tex: 'b_wyrm', anim: 'b-wyrm', fw: 252, fh: 168, n: 4, fps: 4, scale: 1.7, head: [57, 38], mouth: [22, 50], body: [126, 201], col: '#ffd08a' },
  { tex: 'b_serpent', anim: 'b-serpent', fw: 182, fh: 162, n: 9, fps: 10, scale: 2.0, head: [28, 104], mouth: [26, 112], body: [90, 130], col: '#7a9aff' },
  { tex: 'b_demon', anim: 'b-demon', fw: 157, fh: 126, n: 6, fps: 7, scale: 2.5, head: [82, 38], mouth: [80, 48], body: [82, 107], col: '#ff5a7a' },
  { tex: 'dragon_idle', anim: 'dragon-idle', fw: 144, fh: 64, scale: 4, head: [70, 34], mouth: [66, 28], body: [95, 71], col: '#ff8a6a' },
];
const NEW_BOSSES = BOSSES.filter((b) => b.tex.startsWith('b_')).map((b) => b.tex.slice(2));
const TIER_TINT = [0xffffff, 0xc8b0ff, 0x8ac8ff, 0xff9ae0, 0xffe08a, 0x9affd8];
function bossFor(s) {
  const b = BOSSES[s % BOSSES.length], cyc = Math.floor(s / BOSSES.length), big = isBig(s);
  const k = Math.min(1.35, 1 + 0.07 * cyc) * (big ? 1.12 : 1);
  const scale = Math.min(b.scale * k, Math.max(b.scale, 330 / b.fh, 0), Math.max(b.scale, 600 / b.fw)), w = b.fw * scale;
  const x = Math.round(Math.min(1180 - w / 2, Math.max(860, 760 + w / 2)));
  const tint = cyc ? TIER_TINT[((cyc - 1) % (TIER_TINT.length - 1)) + 1] : null;
  return { ...b, scale, x, tint, cyc, big, idx: s % BOSSES.length };
}
function bossName(s) {
  const c = bossFor(s), base = t('bosses')[c.idx];
  if (!c.cyc) return base;
  const tiers = t('tiers'), p = c.cyc <= tiers.length ? tiers[c.cyc - 1] : 'Ω' + c.cyc;
  return t('bossTier', p, base);
}
// Strike feedback grows with damage / boss HP. L0 = not enough, L1 = kill, L2 = x2, L3 = x5, L4 = x10
const OK_TIERS = [
  { at: 0, label: 'NOT ENOUGH', font: 72, shake: 0.012, stop: 60, n: 0.6, col: 0xff5a4a, css: '#ff6a5a', snd: null },
  { at: 1, label: 'KILL!', font: 84, shake: 0.025, stop: 90, n: 1, col: 0xffd36a, css: '#ffd36a', snd: 'hit' },
  { at: 2, label: 'OVERKILL', font: 100, shake: 0.035, stop: 160, n: 1.6, col: 0xffa040, css: '#ffb24a', snd: 'smash' },
  { at: 5, label: 'MEGA OVERKILL', font: 118, shake: 0.05, stop: 260, n: 2.4, col: 0xff4a8a, css: '#ff7ab0', snd: 'boom' },
  { at: 10, label: 'GODLIKE', font: 138, shake: 0.07, stop: 380, n: 3.4, col: 0xc080ff, css: '#e0b8ff', snd: 'nuke' },
  { at: 100, label: 'ANNIHILATION', font: 150, shake: 0.08, stop: 440, n: 4, col: 0x6af0ff, css: '#a8f8ff', snd: 'nuke' },
];
function okLevel(dmg, hp) { let L = 0; OK_TIERS.forEach((t, i) => { if (i && dmg >= t.at * hp) L = i; }); return L; }
const okLabel = (L, ratio) => L >= 2 ? `${t('ok')[L - 2]} x${ratio >= 1e4 ? fmt(ratio) : ratio >= 10 ? Math.floor(ratio) : ratio.toFixed(1)}` : L === 1 ? t('kill') : '';
// number suffixes live in the PixelDigits font at private-use code points (blocky K M B T e that match the digits)
const SFX = { K: '\uE000', M: '\uE001', B: '\uE002', T: '\uE003', e: '\uE004' };
// 9,999 -> 12.3K -> 4.56M -> B -> T -> 1.23e15 (language-agnostic); doubles, never Infinity/NaN
function fmt(n) {
  if (n !== n) n = 0; if (!isFinite(n)) n = n > 0 ? RULES.cap : -RULES.cap;
  const a = Math.abs(n), sg = n < 0 ? '-' : '';
  if (a < 1e4) return sg + String(Math.round(a)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (a < 1e15) {
    const U = ['', SFX.K, SFX.M, SFX.B, SFX.T]; let e = Math.floor(Math.log10(a) / 3), x = a / Math.pow(1000, e);
    let s = x >= 100 ? String(Math.round(x)) : x >= 10 ? x.toFixed(1) : x.toFixed(2);
    if (parseFloat(s) >= 1000) { if (e >= 4) return sg + '1.00' + SFX.e + '15'; e++; x = a / Math.pow(1000, e); s = x.toFixed(2); }
    return sg + s + U[e];
  }
  const e = Math.floor(Math.log10(a)); let m = a / Math.pow(10, e); if (m >= 9.995) { m /= 10; return sg + m.toFixed(2) + SFX.e + (e + 1); }
  return sg + m.toFixed(2) + SFX.e + e;
}

// ===== PHASER =====
const W = 1200, H = 628;
let FONT = fontFor(LANG);
const LAVA_GROUND = 512;   // lava floor line of bg_lava drawn at 3x
window.DC = { phase: 'boot', round: 0 };
// test hook: DC.jump(20) starts stage 21 with gear built by 20 stages of picks
window.DC.jump = (n, seed, scene, bare) => {
  const g = window.game, R = jumpRun(n, seed); if (bare) R.G = newGear();
  const act = g.scene.getScenes(true), key = scene || (isBig(n) ? 'intro' : 'pick');
  act.slice(1).forEach((sc) => sc.scene.stop());
  if (act[0]) act[0].scene.start(key, { run: R }); else g.scene.start(key, { run: R });
  return gearSummary(R.G);
};

const TEXT_RES = 2;
(() => { const F = Phaser.GameObjects.GameObjectFactory.prototype, mk = F.text; // crisp text: render at 2x, sample LINEAR so FIT scaling never drops pixel rows from glyphs
  F.text = function (...a) { const o = mk.apply(this, a); try { o.setResolution(TEXT_RES); o.texture.setFilter(Phaser.Textures.FilterMode.LINEAR); } catch (e) {} return o; }; })();
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
    this.unhl(); if (obj.getData('row')) { obj.setFillStyle(0xffe6a0, 0.14).setStrokeStyle(2, 0xffd36a, 0.75); this.hl = obj; }
    const w = 470; let lines;
    if (it.kind === 'debuff') lines = [[t('curseT') + ': ' + t('db')[it.d.id], 26, DB_COL[it.d.id]], [dbDescOf(it.d), 24, '#ffb0c0'], [t('dbLeft', it.d.left), 20, '#ffffff']];
    else if (it.kind === 'syn') { const [a, b] = synLines(it.element, items); lines = [[a, 22, EL_CSS[it.element]], [t('synDesc')[it.element], 18, '#ffffff'], [b, 24, '#ffd84a']]; }
    else {
      lines = [
        [starStr(it) + it.name, 26, it.kind === 'cursed' ? '#d9a6ff' : EL_CSS[it.element]],
        [`${t('rar')[it.rarity]} · ${t('kind')[it.kind]}${it.kind === 'cursed' ? '' : ' · ' + elName(it.element)}`, 19, R.css],
        [ruleText(it), 28, it.kind === 'cursed' ? '#ff6a7a' : it.kind === 'accessory' ? '#ffd84a' : '#b8f0a0'],
      ];
      if (it.kind !== 'cursed') { const [a, b] = synLines(it.element, items); lines.push([a, 18, EL_CSS[it.element]], [b, 17, '#ffe8a0']); }
    }
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
    window.DC.tooltip = { name: lines[0][0], rule: lines[lines.length > 2 ? 2 : 1][0], x, y: ty, w: sw, h: sh };
  }
  unhl() { if (this.hl && this.hl.active) this.hl.setFillStyle(0xffffff, 0.001).setStrokeStyle(); this.hl = null; }
  hide(force) { if (force) this.pinned = false; this.c.setVisible(false); this.cur = null; this.unhl(); window.DC.tooltip = null; }
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

// ---- endless run state, records, gear-event labels
const BIG_R = { EPIC: 1, LEGENDARY: 1, MYTHIC: 1, COSMIC: 1 }, LEG_R = { LEGENDARY: 1, MYTHIC: 1, COSMIC: 1 };
const pct = (x) => { const p = x * 100; return p >= 100 ? fmt(p) : p >= 10 ? Math.round(p) : p.toFixed(1).replace(/\.0$/, ''); };
function newRun() { return { s: 0, G: newGear(), log: [], total: 0, maxHit: 0 }; }
function loadBest() {
  let st = 0, hit = 0;
  try { st = +localStorage.getItem('dc_best_stage') || 0; hit = +localStorage.getItem('dc_best_hit') || 0; } catch (e) {}
  return { stage: st, hit: isFinite(hit) ? hit : 0 };
}
function saveBest(st, hit) { try { localStorage.setItem('dc_best_stage', String(st)); localStorage.setItem('dc_best_hit', String(hit)); } catch (e) {} }
const EV_COL = { equip: 0x8aff7a, merge: 0xffe066, replace: 0x8aff7a, salvage: 0x6af0ff, curse: CURSE_COL };
const EV_CSS = { equip: '#b8f0a0', merge: '#ffe066', replace: '#8aff7a', salvage: '#9ae8ff', curse: '#ff8a9a' };
function evText(ev) {
  if (ev.type === 'merge') return t('evMerge', ev.stars);
  if (ev.type === 'replace') return t('evUpgrade');
  if (ev.type === 'salvage') return ev.maxed ? `${t('evMax')} +${pct(ev.gain)}%` : t('evSalvage', pct(ev.gain));
  if (ev.type === 'curse') return t('evCurse', t('db')[ev.debuff.id]);
  return t('evEquip');
}
function gearSummary(G) {
  return { weapon: G.weapon.map((x) => x.stars), armor: G.armor.map((x) => x.stars), accessory: G.accessory.map((x) => x.stars), debuffs: G.debuffs.map((d) => d.id + ':' + d.left), salv: G.salv };
}
// short victory fanfare on every BIG BOSS kill (the main loop ducks under it, then comes back)
function milestoneJingle(scene) {
  const snd = scene.sound, m = snd.get('music');
  if (m && m.isPlaying) { // duck, then ramp back with plain timers (survives the scene change)
    m.setVolume(0.06); clearInterval(window.__duck);
    setTimeout(() => { let v = 0.06; window.__duck = setInterval(() => { v = Math.min(MAIN_VOL, v + 0.02); try { m.setVolume(v); } catch (e) {} if (v >= MAIN_VOL) clearInterval(window.__duck); }, 80); }, 3800);
  }
  try { snd.stopByKey('victory'); snd.play('victory', { volume: 0.5 }); } catch (e) {}
  window.DC.milestones = (window.DC.milestones || 0) + 1;
}
// curse badges: icon + countdown, hover / tap for the tooltip. Returns the created objects.
function debuffBadges(scene, tip, G, x, y, depth = 30) {
  const out = [];
  G.debuffs.forEach((d, i) => {
    const bx = x + i * 46, col = Phaser.Display.Color.HexStringToColor(DB_COL[d.id]).color;
    const sq = scene.add.rectangle(bx, y, 38, 38, 0x2a0a2a, 0.9).setStrokeStyle(2, col).setDepth(depth);
    const ic = scene.add.image(bx, y, 'icons', ICONS.cursed[['weak', 'elem', 'minroll', 'hp', 'rarity'].indexOf(d.id) % 4][0]).setScale(0.8).setDepth(depth);
    if (d.id === 'elem') ic.setTint(EL_COLOR[d.el]);
    const n = txt(scene, bx + 13, y + 13, String(d.left), 15, '#ffffff', { strokeThickness: 4 }).setDepth(depth + 1);
    tip.attach(sq, { kind: 'debuff', d, rarity: 'CURSED', element: d.el || 'Fire', name: t('db')[d.id] });
    out.push(sq, ic, n);
  });
  return out;
}

// debug / screenshot hook: jump straight to stage n with a gear set built by playing n stages of smart-ish picks
function jumpRun(n, seed) {
  // plays n stages with the 'smart' sim policy (favour gold accessories, own element, black early) until a run survives
  let x = (seed || 12345) >>> 0;
  const rng = () => { x = (x + 0x6D2B79F5) >>> 0; let t2 = x; t2 = Math.imul(t2 ^ (t2 >>> 15), t2 | 1); t2 ^= t2 + Math.imul(t2 ^ (t2 >>> 7), t2 | 61); return ((t2 ^ (t2 >>> 14)) >>> 0) / 4294967296; };
  let R = null;
  for (let tries = 0; tries < 400; tries++) {
    const force = n > 32 || tries === 399; // deep jumps: pretend every boss died (jackpot each stage) - screenshot/debug only
    R = newRun(); let dead = false;
    for (let s = 0; s < n && !dead; s++) {
      const off = rollOffer(rng), G = R.G, na = G.accessory.length;
      const cnt = { Fire: 0, Ice: 0, Thunder: 0 }; gearList(G).forEach((i) => cnt[i.element]++);
      const dom = ELEMENTS.reduce((a, b) => (cnt[b] > cnt[a] ? b : a));
      let best = null, bs = -1e9;
      for (const c of off) { const sc = (c.type === 'gold' ? (na < 3 ? 40 : 22) : c.type === 'black' ? 30 : 0) + (c.element === dom ? 18 : 0) + (c.type === 'black' && G.debuffs.length ? -25 : 0) + rng(); if (sc > bs) { bs = sc; best = c; } }
      let it = openChest(best, rng, s, false, isBig(s) ? RULES.bigTier : 0); if (hasDb(G, 'rarity')) it = demote(it);
      equip(G, nameItem(it), s);
      const d = computeDamage(G, rng, s), hp = stageHp(s, G); tickCurse(G);
      if (d.total < hp && !force) { dead = true; break; }
      R.log.push({ stage: s, dmg: d.total, hp, L: okLevel(d.total, hp) }); R.total += d.total; R.maxHit = Math.max(R.maxHit, d.total);
      const b = bonusDrop(force ? Math.max(d.total, hp * 9) : d.total, hp, rng, s); if (b) equip(G, nameItem(b.item), s);
    }
    if (!dead) { window.DC.jumpTries = tries + 1; break; }
  }
  R.s = n; R.G.debuffs = [];
  return R;
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
    this.load.spritesheet('hound_idle', I + 'hound_idle.png', { frameWidth: 64, frameHeight: 32 });
    this.load.spritesheet('beast_idle', I + 'beast_idle.png', { frameWidth: 55, frameHeight: 67 });
    NEW_BOSSES.forEach((k) => { const b = BOSSES.find((x) => x.tex === 'b_' + k); this.load.spritesheet('b_' + k, I + 'bosses/' + k + '.png', { frameWidth: b.fw, frameHeight: b.fh }); });
    this.load.spritesheet('hero_idle', I + 'hero_idle.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('hero_run', I + 'hero_run.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('hero_attack', I + 'hero_attack.png', { frameWidth: 64, frameHeight: 64 });
    ['click', 'open', 'rare', 'curse', 'swing', 'hit', 'win', 'lose', 'music', 'epic', 'legendary', 'charge', 'banner', 'tick', 'victory', 'defeat', 'smash', 'boom', 'nuke', 'shatter', 'stage'].forEach((k) => this.load.audio(k, A + k + '.mp3'));
  }
  create() {
    const a = (key, tex, rate, repeat = -1) => this.anims.create({ key, frames: this.anims.generateFrameNumbers(tex), frameRate: rate, repeat });
    a('dragon-idle', 'dragon_idle', 8); a('hound-idle', 'hound_idle', 9); a('beast-idle', 'beast_idle', 8); a('dragon-breath', 'dragon_breath', 12, 0);
    BOSSES.forEach((b) => { if (b.fps) a(b.anim, b.tex, b.fps); });
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
    const best = loadBest();
    if (best.stage) txt(this, W / 2, 222, t('titleBest', best.stage, fmt(best.hit)), 22, '#b8f0a0', { strokeThickness: 5, maxW: 760 });
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
      this.scene.start('intro', { run: newRun() });
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
  init(d) { this.run = d.run; this.s = this.run.s; this.G = this.run.G; this.locked = true; this.done = false; this.canSkip = false; this.autoNext = null; this.dim = null; this.inv = []; }
  get items() { return gearList(this.G); }
  create() {
    const s = this.s;
    window.DC.phase = 'pick'; window.DC.stage = s + 1; window.DC.reveal = null; window.DC.pickReady = false; window.DC.missed = null; window.DC.event = null;
    this.tweens.timeScale = 1; this.time.timeScale = 1;
    fadeInMain(this);
    backdrop(this, 'bg_hoard', 0.45);
    const big = isBig(s), c = bossFor(s);
    // centred top HUD: STAGE on the left, boss + HP bar on the right (hero POWER lives on the hero side, no comparison)
    panel(this, W / 2 - 300, 8, 600, 104, { border: big ? 0xff5a4a : undefined });
    const st = txt(this, W / 2 - 165, big ? 42 : 58, t('stageN', s + 1), 44, '#ffd36a', { strokeThickness: 10, stroke: '#1a0a04', maxW: 250 });
    window.DC.roundText = st.text;
    if (big) {
      const bb = txt(this, W / 2 - 165, 88, t('bigBoss'), 22, '#ff6a5a', { strokeThickness: 6, stroke: '#2a0404', maxW: 250 });
      this.tweens.add({ targets: bb, scale: 1.12, yoyo: true, repeat: -1, duration: 420 });
    }
    txt(this, W / 2 + 135, 36, bossName(s), 22, c.col, { strokeThickness: 5, maxW: 300 });
    this.add.rectangle(W / 2 + 135, 72, 280, 24, 0x220000).setStrokeStyle(3, 0xffd36a);
    this.add.rectangle(W / 2 - 3, 72, 276, 18, 0xd22a2a).setOrigin(0, 0.5);
    this.hpT = txt(this, W / 2 + 135, 72, `HP ${fmt(stageHp(s, this.G))}`, 17, '#ffffff', { strokeThickness: 4 });
    if (hasDb(this.G, 'hp')) this.add.rectangle(W / 2 + 135, 72, 280, 24).setStrokeStyle(3, 0xff5a3a);
    if (!big && isBig(s + 1)) txt(this, W / 2 + 135, 98, t('nextBig'), 15, '#ffb08a', { strokeThickness: 4, maxW: 280 });
    this.prompt = txt(this, W / 2, 142, t('pickOne'), 38, '#ffffff', { strokeThickness: 8, maxW: 600 }).setAlpha(0);
    this.tip = new Tooltip(this, () => this.items);
    this.drawPower();
    this.offer = rollOffer(Math.random); window.DC.offer = this.offer.map((o) => o.type);
    const xs = [W / 2 - 270, W / 2, W / 2 + 270], base = 390;
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
      if (c.type === 'black') { const bh = txt(this, x, base + 92, t('blackHint'), 15, '#d9a6ff', { strokeThickness: 4, maxW: 240 }); el.on('destroy', () => bh.destroy()); this.tweens.add({ targets: bh, alpha: 0.55, yoyo: true, repeat: -1, duration: 700 }); }
      const zone = this.add.zone(x, base - 80, 220, 300).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.choose(i));
      zone.on('pointerover', () => { if (this.locked) return; this.tweens.add({ targets: spr, scale: 5.4, duration: 120 }); glow.setAlpha(0.45); });
      zone.on('pointerout', () => { if (this.locked) return; this.tweens.add({ targets: spr, scale: 5, duration: 120 }); glow.setAlpha(0.2); });
      const sp = this.add.particles(x, base - 70, 'px', { x: { min: -60, max: 60 }, y: { min: -50, max: 40 }, lifespan: 900, speedY: { min: -30, max: -10 }, scale: { start: 1.5, end: 0 }, frequency: 260, tint: EL_COLOR[c.element], blendMode: 'ADD' });
      // drop in from above with a bounce; the rest of the chest UI fades in when it lands
      spr.y = -120 - i * 60; [glow, gem, label, el].forEach((o) => o.setAlpha(0)); sp.stop();
      this.tweens.add({ targets: spr, y: base + 12, duration: 460, delay: 80 + i * 80, ease: 'Bounce.out', onComplete: () => {
        sfx(this, 'open', 0.25); burst(this, x, base, 0xffe0a0, 8, 160, 'px'); sp.start();
        this.tweens.add({ targets: [gem, label, el], alpha: 1, duration: 160 }); glow.setAlpha(0.16);
      } });
      return { c, x, y: base - 80, spr, glow, gem, label, el, zone, sp };
    });
    sfx(this, 'banner', 0.3);
    this.time.delayedCall(560, () => {
      this.locked = false; window.DC.pickReady = true;
      this.prompt.setAlpha(1); popText(this, this.prompt, 1);
      this.tweens.add({ targets: this.prompt, y: 136, yoyo: true, repeat: -1, duration: 420, ease: 'Sine.inOut' });
    });
    this.input.on('pointerdown', (p, over) => { if (this.canSkip && !over.some((o) => o.getData && o.getData('item'))) this.next(); });
  }
  // hero-side POWER: expected damage of the current gear (synergies + curses included). Not a promise - rolls, crits and chains vary.
  drawPower() {
    const hx = 120;
    this.hShadow = shadow(this, hx, 616, 80);
    this.heroS = this.add.sprite(hx, 618, 'hero_idle').setScale(2.4).setOrigin(0.5, 1).play('hero-idle'); heroGlow(this.heroS);
    this.powBox = panel(this, 12, 330, 236, 80, { border: 0xffcf40 });
    this.powL = txt(this, 130, 350, t('power'), 16, '#ffe8a0', { strokeThickness: 4, maxW: 220 });
    this.powN = txt(this, 130, 384, '0', 38, '#ffd36a', { strokeThickness: 8, stroke: '#2a1404', maxW: 220 });
    this.powHint = txt(this, 130, 424, t('gearTap'), 13, '#c8b49a', { strokeThickness: 3, maxW: 236 });
    this.dbObjs = [];
    const hit = this.add.rectangle(130, 470, 250, 300, 0xffffff, 0.001).setInteractive({ useHandCursor: true }).setData('item', true);
    hit.on('pointerover', (p) => { if (!p.wasTouch) { this.hoverPow = true; this.openGear(false); } });
    hit.on('pointerout', (p) => { if (!p.wasTouch) { this.hoverPow = false; this.maybeCloseGear(); } });
    hit.on('pointerdown', () => { if (this.gearOpen && this.gearPinned) this.closeGear(); else this.openGear(true); });
    this.input.on('pointerdown', (p, over) => { if (this.gearOpen && !over.length) this.closeGear(); });
    this.input.on('pointermove', (p) => { if (this.gearOpen && !this.gearPinned && !p.wasTouch) this.maybeCloseGear(0); });
    [this.powBox, this.powL, this.powN, this.powHint, this.heroS, this.hShadow].forEach((o) => o.setDepth(12));
    this.powV = expStrike(this.G); this.setPower(this.powV, false);
    this.drawHeroDebuffs();
    this.gearOpen = false; this.inv = [];
  }
  drawHeroDebuffs() {
    this.dbObjs.forEach((o) => o.destroy());
    this.dbObjs = debuffBadges(this, this.tip, this.G, 34, 306, 20);
  }
  setPower(v, anim = true) {
    const cursed = this.G.debuffs.length > 0, col = cursed ? '#ff5a5a' : '#ffd36a', from = this.powShown || 0, up = v > from * 1.0001;
    this.powV = v; this.powN.setColor(col); window.DC.power = v;
    if (!anim) { this.powShown = v; setFit(this.powN, fmt(v)); return; }
    const c = { v: from };
    this.tweens.add({ targets: c, v, duration: 650, ease: 'Cubic.out', onUpdate: () => setFit(this.powN, fmt(c.v)), onComplete: () => {
      this.powShown = v; setFit(this.powN, fmt(v));
      this.tweens.killTweensOf(this.powN); this.powN.setScale(up ? 1.45 : 0.8);
      this.tweens.add({ targets: this.powN, scale: 1, duration: 260, ease: 'Back.out' });
      if (up) { burst(this, 130, 384, 0xffcf40, 24, 220, 'px').setDepth(30); sfx(this, 'tick', 0.6); }
      else { this.cameras.main.shake(160, 0.006); }
    } });
  }
  // gear popup (hover or tap POWER / the hero): slotted items with stars, element synergies, active curses
  openGear(pin) {
    if (pin) this.gearPinned = true;
    if (this.gearOpen) return; this.gearOpen = true; this.renderGear(); window.DC.gearOpen = true;
  }
  maybeCloseGear(ms = 160) {
    this.time.delayedCall(ms, () => {
      if (this.gearPinned || !this.gearOpen) return;
      const p = this.input.activePointer, x = p.worldX, y = p.worldY, g = this.gx0 || 270;
      const inPop = x >= g - 18 && x <= g + 316 && y >= 116 && y <= 610, inPow = x <= 260 && y >= 290;
      if (!inPop && !inPow) this.closeGear();
    });
  }
  closeGear() { this.gearOpen = false; this.gearPinned = false; this.inv.forEach((o) => o.destroy()); this.inv = []; this.rows = []; if (this.tip) this.tip.hide(true); window.DC.gearOpen = false; }
  drawInventory() {}
  updateCounters() {}
  renderGear() {
    this.inv.forEach((o) => o.destroy()); this.inv = []; this.rows = []; this.slotY = {};
    if (!this.gearOpen) return;
    const x0 = this.gx0 = 270, G = this.G, D = 600, add = (o) => { this.inv.push(o); return o; };
    const bg = add(panel(this, x0 - 18, 116, 334, 494, { border: 0xffcf40, alpha: 0.96 }));
    const hit = add(this.add.rectangle(x0 + 149, 363, 334, 494, 0xffffff, 0.001).setInteractive().setData('item', true));
    hit.on('pointerover', () => { this.hoverPop = true; }); hit.on('pointerout', () => { this.hoverPop = false; this.maybeCloseGear(); });
    add(txt(this, x0 + 149, 138, t('gearT'), 22, '#ffd36a', { strokeThickness: 5, maxW: 300 }));
    const Y = synergy(gearList(G)), off = offEls(G);
    ELEMENTS.forEach((el, k) => {
      const cx = x0 - 4 + k * 100, lv = Y.lv[el];
      add(this.add.star(cx + 6, 164, 4, 4, 9, EL_COLOR[el]).setStrokeStyle(2, 0x000000));
      const tx = add(this.add.text(cx + 16, 164, `${elName(el)} ${Y.cnt[el]}${lv ? ' Lv' + lv : ''}`, { fontFamily: FONT, fontSize: '15px', color: off.includes(el) ? '#6a5a7a' : lv ? '#ffffff' : EL_CSS[el], fontStyle: 'bold', stroke: '#140812', strokeThickness: 3 }).setOrigin(0, 0.5));
      fitText(tx, 80, 15);
      this.tip.attach(add(this.add.rectangle(cx + 46, 164, 98, 22, 0xffffff, 0.001).setData('row', true)), { kind: 'syn', element: el, rarity: 'RARE', name: t('syn')[el] });
    });
    let y = 186;
    CATS.forEach((cat) => {
      add(txt(this, x0 - 4, y, t('cat')[cat], 14, '#c8b49a', { strokeThickness: 3, maxW: 300 }).setOrigin(0, 0.5));
      y += 22; this.slotY[cat] = [];
      for (let j = 0; j < RULES.slots[cat]; j++) { this.slotY[cat][j] = y; this.addInvRow(y, G[cat][j], cat); y += this.rowH; }
      y += 2;
    });
    this.salvT = add(txt(this, x0 + 149, G.debuffs.length ? 566 : 580, t('salvLine', pct(G.salv)), 15, G.salv > 0 ? '#9ae8ff' : '#6a7a8a', { strokeThickness: 3, maxW: 310 }));
    if (G.debuffs.length) {
      add(txt(this, x0 - 4, 594, t('curseT'), 14, '#ff8a9a', { strokeThickness: 3, maxW: 90 }).setOrigin(0, 0.5));
      debuffBadges(this, this.tip, G, x0 + 110, 594, D + 2).forEach((o) => { o.setScale(o.type === 'Rectangle' ? 0.8 : o.scale * 0.8); add(o); });
    }
    this.inv.forEach((o) => { if (o.depth < D) o.setDepth(D + (o === bg ? 0 : 1)); });
    window.DC.bagRows = this.rows; window.DC.gear = gearSummary(G);
  }
  addInvRow(y, it, cat) {
    this.rowH = 37;
    const x0 = this.gx0, bx = 32, add = (o) => { this.inv.push(o); return o; };
    if (!it) {
      add(this.add.rectangle(x0 + 21, y, bx - 2, bx - 2, 0xffffff, 0.06).setStrokeStyle(1, 0x5a4a3a));
      add(this.add.text(x0 + 46, y, t('emptySlot'), { fontFamily: FONT, fontSize: '14px', color: '#6a5a4a' }).setOrigin(0, 0.5));
      return;
    }
    // the WHOLE row (icon + name + numbers) is the hover / tap target; height rowH-2 so neighbouring rows never overlap
    const row = add(this.add.rectangle(x0 + 151, y, 302, this.rowH - 2, 0xffffff, 0.001).setData('row', true));
    this.tip.attach(row, it);
    this.rows.push({ x: x0 + 151, y, w: 302, h: this.rowH - 2, cat });
    add(this.add.rectangle(x0 + 21, y, bx, bx, itemCol(it), 0.3).setStrokeStyle(2, RARITY[it.rarity].col));
    add(this.add.image(x0 + 21, y, 'icons', it.frame).setScale(0.86));
    if ((it.stars || 1) > 1) add(txt(this, x0 + 33, y + 11, '★' + it.stars, 12, '#ffe066', { strokeThickness: 3 }));
    add(clipText(this.add.text(x0 + 44, y - 15, it.name, { fontFamily: FONT, fontSize: '14px', color: RARITY[it.rarity].css, fontStyle: 'bold' }), 254));
    const rt = add(this.add.text(x0 + 44, y + 1, ruleText(it), { fontFamily: FONT, fontSize: '14px', color: it.kind === 'accessory' ? '#ffd84a' : '#b8f0a0' }));
    fitText(rt, 254, 14);
  }
  rowOf(it) { // y of the row currently holding this item
    for (const cat of CATS) { const j = this.G[cat].indexOf(it); if (j >= 0) return this.slotY[cat][j]; }
    return null;
  }
  forcedItem(ch) { // test hook: DC.force = 'EPIC' | 'LEGENDARY' | 'MYTHIC' | 'COSMIC' | 'CURSED'
    const f = window.DC.force; if (!f) return null; window.DC.force = null;
    const rng = Math.random;
    if (f === 'CURSED') { const c = mkCurse(ch.c.element, this.s, rng); if (window.DC.forceDb) { c.debuff = window.DC.forceDb; window.DC.forceDb = null; } return c; }
    for (let k = 0; k < 4000; k++) { const it = mkItem('weapon', ch.c.element, f === 'EPIC' ? 200 : 270, RULES.black.wSpread, this.s, rng, f === 'COSMIC' ? 40 : f === 'MYTHIC' ? 12 : -99); if (it.rarity === f) return it; }
    return null;
  }
  choose(i) {
    if (this.locked) return; this.locked = true;
    if (this.gearOpen) this.closeGear();
    const ch = this.chests[i];
    this.tweens.killTweensOf(this.prompt); this.tweens.add({ targets: this.prompt, alpha: 0, duration: 150 });
    window.DC.missed = [];
    this.chests.forEach((o, j) => { o.zone.disableInteractive(); o.sp.stop(); if (j !== i) this.reject(o); });
    sfx(this, 'click');
    const raw = this.forcedItem(ch) || openChest(ch.c, Math.random, this.s, false, isBig(this.s) ? RULES.bigTier : 0);
    const it = nameItem(hasDb(this.G, 'rarity') ? demote(raw) : raw);
    const tier = it.rarity, R = RARITY[tier], big = BIG_R[tier], leg = LEG_R[tier];
    window.DC.reveal = { rarity: tier, stage: 'anticipation' };
    this.tweens.killTweensOf([ch.spr, ch.glow]); ch.spr.setScale(5).setDepth(11); ch.glow.setDepth(11);
    // colour hint: the chest glow shifts to the rarity colour while it charges
    const hint = tier === 'COMMON' ? EL_COLOR[ch.c.element] : R.col;
    ch.glow.setAlpha(0);
    ch.soft = this.add.image(ch.x, ch.y + 10, 'glowdot').setTint(hint).setBlendMode(Phaser.BlendModes.ADD).setDepth(11).setScale(big ? 2.25 : 1.75).setAlpha(0.5);
    this.tweens.add({ targets: ch.soft, scale: big ? 3 : 2, alpha: big ? 0.95 : 0.7, yoyo: true, repeat: -1, duration: big ? 170 : 260 });
    const dur = { COMMON: 300, RARE: 480, EPIC: 900, LEGENDARY: 1300, MYTHIC: 1400, COSMIC: 1500, CURSED: 700 }[tier];
    if (big) { this.dimIn(leg ? 0.62 : 0.5); sfx(this, 'charge', leg ? 0.9 : 0.7); }
    // light leaking from the lid seam, growing with the charge
    const leaks = [];
    const nLeak = { COMMON: 0, RARE: 3, EPIC: 5, LEGENDARY: 7, MYTHIC: 8, COSMIC: 9, CURSED: 4 }[tier];
    for (let k = 0; k < nLeak; k++) {
      const a = -70 + (140 / Math.max(1, nLeak - 1)) * k + Phaser.Math.Between(-6, 6);
      const l = this.add.image(ch.x + Phaser.Math.Between(-40, 40), ch.y + 20, 'beam').setOrigin(0.5, 1).setAngle(a).setTint(hint)
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(12).setScale(0.25, 0).setAlpha(0.9);
      this.tweens.add({ targets: l, scaleY: { from: 0, to: big ? 1.1 : 0.6 }, duration: dur, delay: k * (dur / nLeak / 2), ease: 'Quad.in' });
      leaks.push(l);
    }
    // shake harder and harder
    const t0 = this.time.now, amp = { COMMON: 5, RARE: 6, EPIC: 9, LEGENDARY: 13, MYTHIC: 14, COSMIC: 15, CURSED: 8 }[tier];
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
    const mr = openChest(o.c, Math.random, this.s, false, isBig(this.s) ? RULES.bigTier : 0), miss = nameItem(hasDb(this.G, 'rarity') ? demote(mr) : mr);
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
    const ev = equip(this.G, it, this.s);
    const tier = it.rarity, R = RARITY[tier], big = BIG_R[tier], leg = LEG_R[tier];
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
      const coins = this.add.particles(0, -20, 'coin', { x: { min: 20, max: 1180 }, lifespan: 2200, speedY: { min: 120, max: 260 }, speedX: { min: -40, max: 40 }, gravityY: 260, rotate: { min: 0, max: 360 }, scale: { min: 1.4, max: 2.2 }, frequency: 28 / lite, quantity: 1 }).setDepth(D + 3);
      const conf = this.add.particles(0, -20, 'conf', { x: { min: 20, max: 1180 }, lifespan: 2600, speedY: { min: 80, max: 200 }, speedX: { min: -80, max: 80 }, gravityY: 140, rotate: { start: 0, end: 720 }, scale: { min: 1.5, max: 2.5 }, tint: cols, frequency: 22 / lite, quantity: 1 }).setDepth(D + 3);
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
        const label = tier === 'COSMIC' ? t('banCos') : tier === 'MYTHIC' ? t('banMyth') : leg ? t('banLeg') : t('banEpic'), size = leg ? 66 : 70;
        const bw = Math.min(820, label.length * size * (CJK_FONT[LANG] ? 1 : 0.62));
        const bx = Phaser.Math.Clamp(ch.x, bw / 2 + 12, W - 12 - bw / 2);
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
      const card = this.add.container(W / 2, 540).setDepth(20);
      const pg = panel(this, -330, -62, 660, 124, { border: R.col });
      const tag = txt(this, -250, -38, t('rar')[tier], 16, R.css, { strokeThickness: 4, maxW: 130 });
      const shown = ev.type === 'merge' ? ev.item : it;
      const t1 = txt(this, 40, -36, starStr(shown) + it.name, 28, it.kind === 'cursed' ? '#d9a6ff' : EL_CSS[it.element], { maxW: 480 });
      const t2 = txt(this, 0, 2, ruleText(shown), 32, it.kind === 'cursed' ? '#ff6a7a' : it.kind === 'accessory' ? '#ffd84a' : '#b8f0a0', { maxW: 620 });
      const t3 = txt(this, 0, 38, ev.type === 'curse' ? `${evText(ev)}  ${dbDescOf(ev.debuff)}` : evText(ev), 20, EV_CSS[ev.type], { strokeThickness: 4, maxW: 630 });
      card.add([pg, tag, t1, t2, t3]); card.setAlpha(0);
      this.tweens.add({ targets: card, alpha: 1, duration: 150 }); popText(this, card, 1);
    });
    // the item flies into the GEAR panel; merge / upgrade / salvage / curse animate there
    this.time.delayedCall(big ? 650 : 280, () => this.gearEvent(ev, icon));
    // tap anywhere to skip once the reveal has landed
    setTimeout(() => { this.canSkip = true; if (window.DC.reveal) window.DC.reveal.skippable = true; }, big ? (leg ? 1000 : 750) : 350);
    this.autoNext = this.time.delayedCall({ COMMON: 1800, RARE: 2000, CURSED: 2100, EPIC: 2300, LEGENDARY: 2600, MYTHIC: 2700, COSMIC: 2800 }[tier], () => this.next(true));
  }
  // the found item flies into the hero's POWER box; the number rolls to the new expected damage
  gearEvent(ev, icon) {
    window.DC.event = { type: ev.type, stars: ev.stars || 0, gain: ev.gain || 0, old: ev.old ? ev.old.name : null, debuff: ev.debuff ? ev.debuff.id : null };
    const it = ev.item, N = (n) => Math.max(4, Math.round(n * (this.scale.displaySize.width < 700 ? 0.6 : 1)));
    const tx = 130, ty = 384, col = EV_COL[ev.type];
    const fly = this.add.image(icon.x, icon.y, 'icons', it.frame).setScale(2).setDepth(40);
    this.tweens.add({ targets: fly, x: tx, y: ty, scale: 0.5, alpha: 0.3, duration: 420, ease: 'Quad.in', onComplete: () => {
      fly.destroy(); burst(this, tx, ty, col, N(20), 200, 'px').setDepth(40);
      const lab = txt(this, tx + 4, 300, evText(ev), 22, EV_CSS[ev.type], { strokeThickness: 6, maxW: 240 }).setDepth(41);
      if (ev.type === 'curse') lab.setY(272);
      popText(this, lab, 1); sfx(this, ev.type === 'curse' ? 'curse' : ev.type === 'equip' || ev.type === 'salvage' ? 'tick' : 'banner', 0.55);
      this.tweens.add({ targets: lab, y: lab.y - 30, alpha: 0, delay: 1100, duration: 400, onComplete: () => lab.destroy() });
      if (ev.type === 'replace') { // old -> new beside the POWER box
        const c = this.add.container(0, 0).setDepth(41), yy = 452;
        const oi = this.add.image(tx - 52, yy - 4, 'icons', ev.old.frame).setTint(0x8a8a8a);
        const ar = txt(this, tx, yy - 4, '→', 30, '#8aff9a', { strokeThickness: 6 });
        const ni = this.add.image(tx + 52, yy - 4, 'icons', it.frame);
        c.add([oi, ar, ni]); c.setAlpha(0);
        this.tweens.add({ targets: c, alpha: 1, duration: 150 });
        this.tweens.add({ targets: oi, alpha: 0.3, y: yy + 12, delay: 500, duration: 400 });
        this.tweens.add({ targets: c, alpha: 0, delay: 1500, duration: 300, onComplete: () => c.destroy() });
      }
      this.drawHeroDebuffs();
      this.hpT.setText(`HP ${fmt(stageHp(this.s, this.G))}`).setColor(hasDb(this.G, 'hp') ? '#ffb0a0' : '#ffffff');
      this.setPower(expStrike(this.G));
      if (this.gearOpen) this.renderGear();
    } });
  }
  next(fromTimer) {
    if (this.done) return;
    if (fromTimer && this.tip && this.tip.visible) { this.autoNext = this.time.delayedCall(600, () => this.next(true)); return; } // let players read
    this.done = true; if (this.tip) this.tip.hide(true);
    this.tweens.timeScale = 1; this.time.timeScale = 1; this.tweens.resumeAll(); this.anims.resumeAll();
    if (this.autoNext) this.autoNext.remove();
    this.scene.start('strike', { run: this.run });
  }
}

// Stage card for stage 1 and every BIG BOSS: who is next, how much HP, gear carried over (auto-continues fast)
class Intro extends Phaser.Scene {
  constructor() { super('intro'); }
  init(d) { this.run = d.run; this.s = this.run.s; this.gone = false; }
  create() {
    const s = this.s, big = isBig(s), c = bossFor(s), G = this.run.G;
    window.DC.phase = 'intro'; window.DC.stage = s + 1;
    this.tweens.timeScale = 1; this.time.timeScale = 1;
    fadeInMain(this);
    backdrop(this, 'bg_lava', 0.55);
    this.add.image(W / 2, H / 2, 'vig').setDisplaySize(W + 40, H + 40).setAlpha(0.9);
    const sc = Math.min(c.scale, 300 / c.fh, 520 / c.fw), bx = Math.min(1150 - c.fw * sc / 2, 870);
    shadow(this, bx + (c.body[0] - c.fw / 2) * sc, LAVA_GROUND, c.body[1] * sc * 1.05);
    const boss = this.add.sprite(bx + 260, LAVA_GROUND, c.tex).setScale(sc).setOrigin(0.5, 1).play(c.anim).setAlpha(0);
    if (c.tint) boss.setTint(c.tint);
    this.tweens.add({ targets: boss, x: bx, alpha: 1, duration: 480, ease: 'Back.out' });
    try { if (boss.preFX) boss.preFX.addGlow(Phaser.Display.Color.HexStringToColor(c.col).color, 2, 0, false, 0.1, 8); } catch (e) {}
    if (big) {
      const bb = txt(this, 330, 66, t('bigBoss'), 40, '#ff5a4a', { strokeThickness: 10, stroke: '#2a0404', maxW: 600 });
      popText(this, bb, 1); this.tweens.add({ targets: bb, scale: 1.1, yoyo: true, repeat: -1, duration: 380, delay: 400 });
    }
    const t1 = txt(this, 330, 150, t('stageN', s + 1), 72, '#ffd36a', { strokeThickness: 10, maxW: 600 });
    popText(this, t1, 1);
    try { if (t1.preFX) t1.preFX.addShine(0.8, 0.3, 4); } catch (e) {}
    const t2 = txt(this, 330, 236, bossName(s), 46, c.col, { strokeThickness: 8, maxW: 600 }); t2.setAlpha(0);
    this.tweens.add({ targets: t2, alpha: 1, x: { from: 250, to: 330 }, duration: 380, delay: 200, ease: 'Quad.out' });
    const t3 = txt(this, 330, 296, `HP ${fmt(stageHp(s, G))}`, 40, '#ff5a4a'); t3.setAlpha(0);
    this.tweens.add({ targets: t3, alpha: 1, duration: 300, delay: 420 });
    txt(this, 330, 360, t('introLine'), 26, '#ffffff', { maxW: 600 });
    const n = gearList(G).length;
    txt(this, 330, 398, n ? t('gearLine', n) : t('gear0'), 22, '#b8f0a0', { strokeThickness: 4, maxW: 600 });
    const tap = txt(this, 330, 520, t('tapCont'), 30, '#fff2c0', { maxW: 600 });
    this.tweens.add({ targets: tap, alpha: 0.35, yoyo: true, repeat: -1, duration: 600 });
    sfx(this, 'stage', 0.7); if (big) sfx(this, 'charge', 0.5);
    this.cameras.main.fadeIn(250, 0, 0, 0);
    this.time.delayedCall(400, () => this.input.once('pointerdown', () => this.go()));
    this.time.delayedCall(s ? 2600 : 3600, () => this.go());
  }
  go() {
    if (this.gone) return; this.gone = true;
    this.scene.start('pick', { run: this.run });
  }
}

class Strike extends Phaser.Scene {
  constructor() { super('strike'); }
  init(d) {
    this.run = d.run; this.s = this.run.s; this.G = this.run.G; this.log = this.run.log; this.struck = false; this.leaving = false;
    this.cfg = bossFor(this.s); this.hpMax = stageHp(this.s, this.G);
  }
  get items() { return gearList(this.G); }
  untint() { if (!this.boss) return; if (this.cfg.tint) this.boss.setTint(this.cfg.tint); else this.boss.clearTint(); }
  create() {
    const s = this.s;
    window.DC.phase = 'strike'; window.DC.stage = s + 1; window.DC.overkill = 0; window.DC.popped = 0; window.DC.bonus = null; window.DC.bonusShown = false;
    this.tweens.timeScale = 1; this.time.timeScale = 1;
    fadeInMain(this);
    backdrop(this, 'bg_lava', 0.12);
    const res = this.res = computeDamage(this.G, Math.random, s); // each item rolls inside its ATK range
    res.ratio = res.total / this.hpMax; res.L = okLevel(res.total, this.hpMax); res.hp = this.hpMax;
    window.DC.result = { total: res.total, hp: this.hpMax, L: res.L, ratio: res.ratio, flat: res.flat, mult: res.mult, glob: res.glob, weak: res.weak, vuln: res.vuln, crit: res.crit, chain: res.chain, chainX: res.chainX, burn: res.burn, off: res.off, power: expStrike(this.G) };
    this.tip = new Tooltip(this, () => this.items);
    const c = this.cfg;
    this.bShadow = shadow(this, c.x, LAVA_GROUND, c.body[1] * c.scale * 1.05);
    this.hShadow = shadow(this, 230, LAVA_GROUND, 90);
    this.boss = this.add.sprite(c.x, LAVA_GROUND, c.tex).setScale(c.scale).setOrigin(0.5, 1).play(c.anim);
    this.untint();
    this.hero = this.add.sprite(230, LAVA_GROUND, 'hero_idle').setScale(3).setOrigin(0.5, 1).play('hero-idle');
    heroGlow(this.hero);
    panel(this, 640, 14, 440, 140, { border: c.big ? 0xff5a4a : undefined });
    txt(this, 860, 40, c.big ? `${t('stageN', s + 1)}  ·  ${t('bigBoss')}` : t('stageN', s + 1), 20, c.big ? '#ff8a6a' : '#ffd36a', { strokeThickness: 4, maxW: 400 });
    txt(this, 860, 76, bossName(s), 30, c.col, { maxW: 410 });
    this.add.rectangle(860, 120, 400, 28, 0x220000).setStrokeStyle(3, 0xffd36a);
    this.hp = this.add.rectangle(662, 120, 396, 22, 0xd22a2a).setOrigin(0, 0.5);
    this.hpText = txt(this, 860, 120, `${fmt(this.hpMax)} / ${fmt(this.hpMax)}`, 20);
    this.drawGearBar();
    this.dbObjs = debuffBadges(this, this.tip, this.G, 230 - (this.G.debuffs.length - 1) * 23, 296, 20);
    this.ready = txt(this, 250, 190, t('ready', this.items.length), 28, '#ffffff', { maxW: 460 });
    this.btn = button(this, 250, 262, t('strike'), () => this.strike(), 240);
    window.DC.phase = 'strike-ready';
  }
  drawGearBar() {
    (this.gearObjs || []).forEach((o) => o.destroy()); const o = this.gearObjs = [];
    const list = this.items, n = list.length, off = offEls(this.G);
    o.push(panel(this, 8, 560, Math.max(1, n) * 50 + 16 + (this.G.salv > 0 ? 90 : 0), 60));
    list.forEach((it, i) => {
      o.push(this.add.rectangle(40 + i * 50, 590, 42, 42, itemCol(it), 0.3).setStrokeStyle(2, RARITY[it.rarity].col));
      o.push(this.tip.attach(this.add.image(40 + i * 50, 590, 'icons', it.frame).setAlpha(off.includes(it.element) ? 0.3 : 1), it));
      if ((it.stars || 1) > 1) o.push(txt(this, 52 + i * 50, 603, '★' + it.stars, 12, '#ffe066', { strokeThickness: 3 }));
    });
    if (this.G.salv > 0) o.push(txt(this, 24 + n * 50 + 60, 590, `+${pct(this.G.salv)}%`, 16, '#9ae8ff', { strokeThickness: 4 }));
  }
  update() { // shadows stay glued to the feet
    if (this.hero) { this.hShadow.x = this.hero.x; this.hShadow.setVisible(this.hero.visible && this.hero.alpha > 0.2); this.hShadow.scaleX = this.hero.scaleX / 3; }
    if (this.boss && this.boss.active) { const c = this.cfg, k = this.boss.scaleX; this.bShadow.x = this.boss.x + (c.body[0] - c.fw / 2) * k; this.bShadow.scaleX = k / c.scale; }
  }
  pt(p) { const c = this.cfg; return { x: c.x + (p[0] - c.fw / 2) * c.scale, y: LAVA_GROUND - (c.fh - p[1]) * c.scale }; }
  head() { return this.pt(this.cfg.head); }
  strike() {
    if (this.struck) return; this.struck = true; window.DC.phase = 'striking';
    (this.dbObjs || []).forEach((o) => this.tweens.add({ targets: o, alpha: 0, duration: 200 }));
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
    this.boss.setTintFill(0xffffff); this.time.delayedCall(110, () => this.untint());
    this.slash(hd.x, hd.y);
    burst(this, hd.x, hd.y, 0xffd36a, N(40), 380).setDepth(41);
    burst(this, hd.x, hd.y, 0xff5a2a, N(20), 280, 'px').setDepth(41);
    this.hitStop(90);
    // live damage counter (nothing is revealed before the blade lands)
    const TX = this.TX = 420, TY = this.TY = 206;
    this.rays = this.add.image(TX, TY, 'rays').setTint(0xffd36a).setBlendMode(Phaser.BlendModes.ADD).setDepth(43).setScale(0).setAlpha(0);
    this.tweens.add({ targets: this.rays, angle: 360, duration: 6000, repeat: -1 });
    this.dmgLabel = txt(this, TX, TY - 66, t('damage'), 22, '#ffe8b0', { strokeThickness: 5 }).setDepth(46);
    this.dmg = txt(this, TX, TY, '0', 84, '#ffffff', { strokeThickness: 12 }).setDepth(46);
    popText(this, this.dmg, 1);
    this.br = txt(this, TX, TY + 88, '', 20, '#ffffff', { strokeThickness: 4, maxW: 560 }).setDepth(45);
    this.dmgScale = 1; this.shown = 0;
    // damage steps: curses first (sealed elements), the hero's swing, every flat roll, multipliers, salvage, WEAKNESS,
    // then the element synergies: ICE frostbite x, a crit, a THUNDER chain - and FIRE burn ticks after the hit
    const steps = [];
    r.off.forEach((el) => steps.push({ kind: 'seal', el }));
    steps.push({ kind: 'base', v: RULES.baseAtk });
    r.flatItems.forEach((it, i) => steps.push({ kind: 'flat', it, v: r.rolls[i] }));
    this.items.forEach((it) => { if (it.kind === 'accessory' && !r.off.includes(it.element)) steps.push({ kind: 'mult', it, v: eMult(it) }); });
    if (r.glob > 1) steps.push({ kind: 'salv', v: r.glob - 1 });
    if (r.weak < 1) steps.push({ kind: 'weak', v: r.weak });
    if (r.vuln > 1) steps.push({ kind: 'vuln', v: r.vuln });
    if (r.crit) steps.push({ kind: 'crit', v: r.critX });
    if (r.chain) steps.push({ kind: 'chain', v: r.chainX });
    r.ticks.forEach((v) => steps.push({ kind: 'burn', v }));
    window.DC.result.nsteps = steps.length;
    let flat = 0, mult = 1, glob = 1, weak = 1, vuln = 1, cx = 1, ch = 1, burn = 0, shown = 0, next = 1;
    const value = () => capN(Math.max(0, flat) * mult * glob * weak * vuln * cx * ch + burn);
    const show = (v) => {
      this.dmg.setText(fmt(v));
      const lim = Math.min(1.9, 440 / Math.max(1, this.dmg.width)); if (this.dmg.scaleX > lim) { this.dmg.setScale(lim); this.dmgScale = Math.min(this.dmgScale, lim); }
      const left = Math.max(0, this.hpMax - v);
      this.hp.width = 396 * left / this.hpMax; this.hpText.setText(`${fmt(left)} / ${fmt(this.hpMax)}`);
      while (next <= L && v >= OK_TIERS[next].at * this.hpMax) { this.pulse(next, v); next++; }
    };
    window.DC.popped = 0; this.burnI = 0;
    const runStep = (k) => {
      if (k >= steps.length) return this.afterCount(r, show, () => next);
      const s = steps[k];
      const K = s.kind;
      if (K === 'base' || K === 'flat') flat += s.v; else if (K === 'mult') mult *= 1 + s.v; else if (K === 'salv') glob = 1 + s.v;
      else if (K === 'weak') weak = s.v; else if (K === 'vuln') vuln = s.v; else if (K === 'crit') cx = s.v; else if (K === 'chain') ch = s.v; else if (K === 'burn') burn += s.v;
      const target = k === steps.length - 1 ? r.total : value();
      this.popNumber(s, k);
      window.DC.popped = k + 1;
      const c = { v: shown }, gap = s.kind === 'burn' ? 330 : s.kind === 'chain' || s.kind === 'crit' ? 420 : Math.max(120, 280 - k * 22);
      this.tweens.add({ targets: c, v: target, duration: gap * 0.8, ease: 'Cubic.out', onUpdate: () => show(c.v),
        onComplete: () => { shown = target; show(target); } });
      this.time.delayedCall(gap, () => runStep(k + 1));
    };
    this.time.delayedCall(260, () => runStep(0));
    this.tweens.add({ targets: this.hero, x: hd.x - 300, duration: 500, delay: 300, ease: 'Quad.out' });
  }
  // one floating number bursting out of the boss
  popNumber(s, k) {
    const hd = this.head();
    let x = hd.x + ((k % 3) - 1) * 85 + Phaser.Math.Between(-15, 15), y = hd.y - 30 - (k % 2) * 55 + Phaser.Math.Between(-10, 10);
    // burn ticks stack in a tidy column so their labels never overlap
    if (s.kind === 'burn') { const bi = this.burnI = (this.burnI || 0) + 1; x = hd.x + 30; y = hd.y + 30 - (bi - 1) * 46; }
    let label, col, size;
    if (s.kind === 'base') { label = `+${s.v}`; col = '#ffffff'; size = 30; }
    else if (s.kind === 'flat') {
      const neg = s.v < 0; label = (neg ? '' : '+') + fmt(s.v);
      col = neg ? '#c890ff' : EL_CSS[s.it.element]; size = Math.round(28 + Math.min(30, 40 * Math.abs(s.v) / this.hpMax));
    } else if (s.kind === 'mult') { label = fmtX(1 + s.v); col = '#ffd84a'; size = Math.round(40 + Math.min(16, s.v * 2)); }
    else if (s.kind === 'salv') { label = t('salvPop', pct(s.v)); col = '#9ae8ff'; size = 34; }
    else if (s.kind === 'seal') { label = t('sealPop', elName(s.el)); col = '#c8a0ff'; size = 30; }
    else if (s.kind === 'weak') { label = t('weakPop'); col = '#ff7a9a'; size = 34; }
    else if (s.kind === 'vuln') { label = t('vulnPop', fmtX(s.v)); col = '#9ae8ff'; size = 44; }
    else if (s.kind === 'crit') { label = t('critPop'); col = '#ffffff'; size = 58; }
    else if (s.kind === 'chain') { label = t('chainPop', s.v); col = '#ffe866'; size = 64; }
    else { label = t('burnPop', fmt(s.v)); col = '#ff9a4a'; size = 34; }
    this.elemFx(s);
    const fl = txt(this, x, y, label, size, col, { strokeThickness: Math.max(6, size / 6) }).setDepth(44);
    fl.setScale(0.2);
    this.tweens.add({ targets: fl, scale: 1, duration: 140, ease: 'Back.out' });
    this.tweens.add({ targets: fl, y: y - (s.kind === 'burn' ? 40 : 90 + Phaser.Math.Between(0, 40)), x: x + (s.kind === 'burn' ? 0 : Phaser.Math.Between(-30, 30)), alpha: { from: 1, to: 0 }, delay: 260, duration: 700, ease: 'Quad.in', onComplete: () => fl.destroy() });
    // the boss flinches with every number
    const neg = (s.kind === 'flat' && s.v < 0) || s.kind === 'weak' || s.kind === 'seal';
    this.boss.setTint(neg ? 0xc090ff : 0xffd0b0); this.time.delayedCall(70, () => this.untint());
    this.tweens.add({ targets: this.boss, x: this.cfg.x + (neg ? -4 : 6), yoyo: true, duration: 45 });
    const BC = { mult: 0xffd84a, vuln: 0x6ad8ff, crit: 0xffffff, chain: 0xffe04a, burn: 0xff7a2a, salv: 0x6af0ff };
    burst(this, x, y, neg ? CURSE_COL : BC[s.kind] || (s.it ? EL_COLOR[s.it.element] : 0xffffff), Math.max(4, Math.round((s.kind === 'chain' || s.kind === 'crit' ? 30 : 12) * this.lite())), 240, 'px').setDepth(43);
    sfx(this, neg ? 'curse' : s.kind === 'chain' ? 'boom' : s.kind === 'crit' ? 'hit' : s.kind === 'mult' || s.kind === 'vuln' ? 'banner' : 'tick', neg ? 0.35 : s.kind === 'chain' ? 0.7 : 0.55);
    if (!neg && s.kind === 'flat' && s.v >= 0.3 * this.hpMax) { sfx(this, 'hit', 0.45); this.cameras.main.shake(120, 0.008); }
  }
  // element-specific VFX: ICE frost ring + shards, crit slash, THUNDER chain lightning, FIRE flames rising off the boss
  elemFx(s) {
    const hd = this.head(), N = (n) => Math.max(4, Math.round(n * this.lite())), cam = this.cameras.main;
    if (s.kind === 'vuln') { this.ring(hd.x, hd.y, 0x8ae2ff, 8, 6); burst(this, hd.x, hd.y, 0x8ae2ff, N(30), 300, 'spark').setDepth(42); this.boss.setTint(0x9ae8ff); this.time.delayedCall(160, () => this.untint()); }
    else if (s.kind === 'crit') { this.slash(hd.x, hd.y, 1.5, 0xffffff); cam.shake(200, 0.014); this.hitStop(80); }
    else if (s.kind === 'chain') {
      cam.shake(320, 0.02); this.hitStop(120);
      for (let k = 0; k < 6; k++) {
        const bx = hd.x + Phaser.Math.Between(-200, 200), b = this.add.image(bx, LAVA_GROUND + 30, 'beam').setOrigin(0.5, 1).setTint(k % 2 ? 0xffffff : 0xffe04a)
          .setBlendMode(Phaser.BlendModes.ADD).setDepth(42).setScale(0.35, 1.3).setAlpha(0).setAngle(Phaser.Math.Between(-12, 12));
        this.tweens.add({ targets: b, alpha: { from: 0.9, to: 0 }, scaleX: 0.08, duration: 380, delay: k * 50, onComplete: () => b.destroy() });
      }
      this.ring(hd.x, hd.y, 0xffe04a, 10, 9);
    } else if (s.kind === 'burn') {
      const f = this.add.particles(hd.x, hd.y + 40, 'spark', { x: { min: -70, max: 70 }, speedY: { min: -220, max: -90 }, lifespan: 600, scale: { start: 1.3, end: 0 }, tint: [0xff5a1a, 0xffb02a, 0xffe08a], blendMode: 'ADD', emitting: false }).setDepth(42);
      f.explode(N(26)); this.time.delayedCall(800, () => f.destroy());
      this.boss.setTint(0xff9a6a); this.time.delayedCall(120, () => this.untint());
    } else if (s.kind === 'seal' || s.kind === 'weak') { this.ring(hd.x, hd.y, CURSE_COL, 6, 4); }
  }
  afterCount(r, show, getNext) {
    show(r.total); this.dmg.setText(fmt(r.total));
    const parts = [`${t('atk')} ${fmt(r.flat)}`]; if (r.mult > 1) parts.push(fmtX(r.mult)); if (r.glob > 1) parts.push(fmtX(r.glob)); if (r.weak < 1) parts.push('×' + r.weak);
    if (r.vuln > 1) parts.push(fmtX(r.vuln)); if (r.crit) parts.push(t('critPop').replace(/[!！¡]/g, '')); if (r.chain) parts.push('×' + r.chainX); if (r.burn > 0) parts.push('+' + fmt(r.burn));
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
    this.dmgScale = Math.min(T.font / 84, 1.9, 440 / Math.max(1, this.dmg.width));
    this.dmg.setColor(T.css);
    this.tweens.killTweensOf(this.dmg);
    this.dmg.setScale(this.dmgScale * 1.25);
    this.tweens.add({ targets: this.dmg, scale: this.dmgScale, duration: 220, ease: 'Back.out' });
    this.tweens.add({ targets: this.dmg, angle: { from: L % 2 ? -6 : 6, to: 0 }, duration: 260 });
    if (L === 1) { // HP hits zero
      sfx(this, 'hit', 1); sfx(this, 'banner', 0.5);
      cam.shake(260, T.shake);
      this.hp.setFillStyle(0xffffff); this.time.delayedCall(90, () => this.hp.setFillStyle(0xd22a2a));
      this.boss.setTint(0xff6a5a); this.time.delayedCall(120, () => this.untint());
      burst(this, hd.x, hd.y, T.col, N(40), 380).setDepth(41);
      return;
    }
    // L >= 2: overkill tiers
    sfx(this, T.snd, 0.75 + 0.08 * L); if (L >= 3) sfx(this, 'hit', 1);
    this.hitStop(T.stop);
    cam.shake(380 + L * 140, T.shake);
    if (L >= 4) softFlash(this, T.col, 0.28, 240); // the only strike flash: soft, tinted, top tiers, rate-limited
    cam.zoomTo(1.06 + 0.04 * L, 90, 'Quad.out', true);
    this.time.delayedCall(200, () => cam.zoomTo(1.06, 260, 'Sine.easeOut', true));
    this.boss.setTint(0xffc0a0); this.time.delayedCall(80 + L * 30, () => this.untint());
    this.tweens.add({ targets: this.boss, x: this.boss.x + 10 * L, yoyo: true, duration: 70, repeat: 1 });
    this.slash(hd.x, hd.y, 1 + 0.3 * (L - 1), T.col);
    for (let k = 0; k < L - 1; k++) this.ring(hd.x, hd.y, T.col, 8 - k * 2, 5 + k * 3 + L * 2, k * 120, 600);
    burst(this, hd.x, hd.y, T.col, N(40 * T.n), 300 + 120 * L).setDepth(41);
    burst(this, hd.x, hd.y, 0xffffff, N(20 * T.n), 500 + 80 * L, 'px').setDepth(41);
    this.rays.setTint(T.col); this.tweens.add({ targets: this.rays, scale: 1.2 + 0.5 * L, alpha: 0.25 + 0.08 * L, duration: 260, ease: 'Back.out' });
    // overkill label for this tier
    if (this.okT) this.okT.destroy();
    const ratio = Math.max(OK_TIERS[L].at, v / this.hpMax);
    this.okT = txt(this, this.TX, this.TY + 130, okLabel(L, ratio), 30 + 8 * L, T.css, { strokeThickness: 8, stroke: '#1a0410', maxW: 600 }).setDepth(47);
    try { if (this.okT.preFX) { this.okT.preFX.addGlow(T.col, 3, 0, false, 0.1, 10); if (L >= 3) this.okT.preFX.addShine(0.9, 0.35, 4); } } catch (e) {}
    popText(this, this.okT, 1);
    this.tweens.add({ targets: this.okT, angle: { from: -3, to: 3 }, yoyo: true, repeat: -1, duration: 300 });
    if (L >= 4) { // GODLIKE / ANNIHILATION: screen-wide lightning-ish white beams
      for (let k = 0; k < 5 + (L - 4) * 4; k++) {
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
      const lbl = txt(this, this.TX, this.TY + 130, L === 1 ? t('kill') : t('notEnough', fmt(r.total), fmt(this.hpMax)), L === 1 ? 46 : 30, OK_TIERS[L].css, { strokeThickness: 8, maxW: 600 }).setDepth(47);
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
    const L = r.L, cam = this.cameras.main, hd = this.head(), N = (n) => Math.max(4, Math.round(n * this.lite()));
    this.boss.stop();
    if (L >= 3) { // blown apart
      sfx(this, 'shatter', 0.9); sfx(this, L >= 4 ? 'nuke' : 'boom', 0.8);
      cam.shake(700, 0.03);
      this.ring(hd.x, hd.y - 20, OK_TIERS[L].col, 14, 14, 0, 800);
      this.shatter(L >= 4 ? 9 : 6, L >= 4 ? 7 : 5, L >= 5 ? 640 : L === 4 ? 520 : 360);
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
    this.record(r, false);
    tickCurse(this.G); // every curse counts down one stage per strike
    this.time.delayedCall(L >= 3 ? 1250 : 1000, () => this.stageClear());
  }
  record(r, failed) {
    const R = this.run;
    this.log.push({ stage: this.s, dmg: r.total, hp: this.hpMax, L: failed ? 0 : r.L, ratio: r.ratio, failed });
    R.total = capN(R.total + r.total); R.maxHit = Math.max(R.maxHit, r.total);
    window.DC.log = this.log.slice(-20); window.DC.run = { stage: this.s + 1, total: R.total, maxHit: R.maxHit };
  }
  stageClear() {
    window.DC.phase = 'stage-clear';
    this.tweens.add({ targets: [this.dmg, this.br, this.okT, this.rays, this.dmgLabel].filter(Boolean), alpha: 0, duration: 250 });
    const N = (n) => Math.max(4, Math.round(n * this.lite()));
    sfx(this, 'banner', 0.8); sfx(this, 'rare', 0.5);
    this.tweens.add({ targets: this.hero, x: 520, duration: 400 });
    const big = isBig(this.s);
    const ban = txt(this, W / 2, 220, big ? t('milestone', this.s + 1) : t('stageClear', this.s + 1), 76, '#ffd36a', { strokeThickness: 12, stroke: '#4a2400', maxW: 1100 }).setDepth(60);
    if (big) milestoneJingle(this);
    try { if (ban.preFX) { ban.preFX.addShine(0.9, 0.35, 4); ban.preFX.addGlow(0xffcf40, 4, 0, false, 0.1, 10); } } catch (e) {}
    popText(this, ban, 1);
    const nxs = this.s + 1, nxb = isBig(nxs);
    const sub = txt(this, W / 2, 300, (nxb ? t('bigBoss') + '!  ' : '') + t('next', bossName(nxs), fmt(stageHp(nxs, this.G))), 30, nxb ? '#ff9a7a' : '#ffffff', { maxW: 1000 }).setDepth(60); sub.setAlpha(0);
    this.tweens.add({ targets: sub, alpha: 1, duration: 300, delay: 300 });
    const coins = this.add.particles(0, -20, 'coin', { x: { min: 100, max: 1100 }, lifespan: 2000, speedY: { min: 120, max: 260 }, gravityY: 260, rotate: { min: 0, max: 360 }, scale: { min: 1.4, max: 2.2 }, frequency: 30 / this.lite() }).setDepth(59);
    this.time.delayedCall(1200, () => coins.stop());
    burst(this, W / 2, 220, 0xffcf40, N(60), 420).setDepth(61);
    this.time.delayedCall(big ? 900 : 600, () => this.bonusMoment());
  }
  // OVERKILL BONUS: reward scaled by damage / boss HP, auto-opened, added to the gear
  bonusMoment() {
    const r = this.res, b = bonusDrop(r.total, this.hpMax, Math.random, this.s), N = (n) => Math.max(4, Math.round(n * this.lite()));
    const it = nameItem(b.item); it.bonus = b.tier;
    const R = RARITY[it.rarity], leg = LEG_R[it.rarity], jack = b.tier === 'jackpot';
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
        else if (BIG_R[it.rarity]) { sfx(this, 'epic', 0.7); this.cameras.main.shake(250, 0.008); }
        else sfx(this, it.rarity === 'COMMON' ? 'open' : 'rare', 0.6);
        const icon = this.add.image(CX, LAVA_GROUND - 40, 'icons', it.frame).setDepth(64).setScale(1);
        try { if (icon.preFX && it.rarity !== 'COMMON') icon.preFX.addGlow(R.col, 4, 0, false, 0.1, 10); } catch (e) {}
        this.tweens.add({ targets: icon, x: IX, y: iy, scale: 3, duration: 420, ease: 'Back.out' });
        const nm = txt(this, X, 560, it.name, 24, EL_CSS[it.element], { strokeThickness: 5, maxW: 600 }).setDepth(64).setAlpha(0);
        const ev = equip(this.G, it, this.s), shown = ev.type === 'merge' ? ev.item : it;
        const rl = txt(this, X, 592, `${t('rar')[it.rarity]} · ${ruleText(shown)}`, 22, it.kind === 'accessory' ? '#ffd84a' : '#b8f0a0', { strokeThickness: 5, maxW: 600 }).setDepth(64).setAlpha(0);
        nm.setText(starStr(shown) + it.name);
        this.tweens.add({ targets: [nm, rl], alpha: 1, duration: 200, delay: 200 });
        window.DC.event = { type: ev.type, stars: ev.stars || 0, gain: ev.gain || 0, old: ev.old ? ev.old.name : null };
        // equip it: the event label pops above the item, the gear bar redraws
        this.time.delayedCall(600, () => {
          const el = txt(this, IX, iy + 66, evText(ev), 22, EV_CSS[ev.type], { strokeThickness: 6, maxW: 330 }).setDepth(65);
          popText(this, el, 1); sfx(this, ev.type === 'equip' ? 'tick' : 'banner', 0.55);
          this.drawGearBar(); this.gearObjs.forEach((o, i) => o.setDepth(i ? 64 : 63));
          burst(this, 40, 590, EV_COL[ev.type], N(16), 160, 'px').setDepth(64);
          window.DC.bonusShown = true;
        });
        this.time.delayedCall(leg ? 2200 : 1800, () => this.toNextStage());
      } });
    } });
  }
  toNextStage() {
    if (this.leaving) return; this.leaving = true;
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.run.s++;
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(isBig(this.run.s) ? 'intro' : 'pick', { run: this.run }));
  }
  loseSeq() {
    // the boss lunges and EATS the hero
    window.DC.phase = 'eating';
    this.tweens.add({ targets: [this.dmg, this.br, this.okT, this.rays, this.dmgLabel].filter(Boolean), alpha: 0, duration: 250 });
    const cam = this.cameras.main, c = this.cfg, s0 = c.scale, b = this.boss;
    this.record(this.res, true);
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
  end() {
    window.DC.phase = 'end'; window.DC.win = false;
    endMusic(this, false);
    const R = this.run, reached = this.s + 1, prev = loadBest(), rec = reached > prev.stage || R.maxHit > prev.hit;
    saveBest(Math.max(prev.stage, reached), Math.max(prev.hit, R.maxHit));
    const best = loadBest();
    window.DC.summary = { reached, cleared: this.s, total: R.total, best: R.maxHit, record: rec, bestStage: best.stage, bestHit: best.hit };
    this.add.rectangle(-100, -100, W + 200, H + 200, 0x000000, 0.68).setOrigin(0).setDepth(70);
    const D = 71, g = panel(this, W / 2 - 390, 20, 780, 500, { border: rec ? 0xffcf40 : 0xd04a3a }); g.setDepth(D);
    const tt = txt(this, W / 2, 72, t('ateBy', bossName(this.s)), 50, '#ff5a4a', { strokeThickness: 10, maxW: 740 }).setDepth(D);
    popText(this, tt, 1);
    const st = txt(this, W / 2, 148, t('reached', reached), 52, '#ffd36a', { strokeThickness: 10, stroke: '#2a1404', maxW: 740 }).setDepth(D);
    try { if (st.preFX) st.preFX.addShine(0.8, 0.3, 4); } catch (e) {}
    txt(this, W / 2, 210, t('maxHit', fmt(R.maxHit)), 32, '#ffffff', { strokeThickness: 6, maxW: 740 }).setDepth(D);
    txt(this, W / 2, 250, t('totalDmg', fmt(R.total)), 24, '#ffd36a', { strokeThickness: 5, maxW: 740 }).setDepth(D);
    if (rec) {
      const nr = txt(this, W / 2 + 270, 112, t('newRec'), 28, '#8aff7a', { strokeThickness: 7, maxW: 260 }).setDepth(D + 1).setAngle(8);
      popText(this, nr, 1); this.tweens.add({ targets: nr, scale: 1.12, yoyo: true, repeat: -1, duration: 420 });
      this.time.delayedCall(400, () => burst(this, W / 2 + 270, 112, 0x8aff7a, 40, 320).setDepth(D + 1));
    }
    txt(this, W / 2, 286, t('bestRec', best.stage, fmt(best.hit)), 20, '#b8f0a0', { strokeThickness: 4, maxW: 740 }).setDepth(D);
    txt(this, W / 2, 318, t('loseLine'), 20, '#e8dcff', { strokeThickness: 4, maxW: 740 }).setDepth(D);
    const list = this.items, n = list.length, sp = 66;
    list.forEach((it, i) => {
      const x = W / 2 - (n - 1) * sp / 2 + i * sp;
      this.add.rectangle(x, 380, 56, 56, itemCol(it), 0.3).setStrokeStyle(2, RARITY[it.rarity].col).setDepth(D);
      this.tip.attach(this.add.image(x, 380, 'icons', it.frame).setScale(1.5).setDepth(D), it);
      if ((it.stars || 1) > 1) txt(this, x + 14, 398, '★' + it.stars, 14, '#ffe066', { strokeThickness: 3 }).setDepth(D);
    });
    if (n) txt(this, W / 2, 428, t('tapItem'), 16, '#bba8d0', { strokeThickness: 3, maxW: 740 }).setDepth(D);
    button(this, W / 2, 560, t('playAgain'), () => { restoreMusic(this); this.scene.start('intro', { run: newRun() }); }, 300).setDepth(D);
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
