// ===== GAME LOGIC (pure, no Phaser) =====
// ENDLESS: every stage = pick ONE of 3 chests (one per element: Fire / Ice / Thunder; sometimes one is a DARK chest),
// then ONE strike. Kill -> next stage, forever. Every 5th stage is a BIG BOSS (more HP, better loot, bonus chest).
// Gear STACKS FOREVER. Every weapon hits on its own with its own crit chance; armour & accessories never crit, they add
// order-independent effects (element %, crit damage, combo, execute line, echo, greed, overkill conversion).
const RULES = {
  hp0: 28, hpGrowth: 3.05, hpStart: 2.9, hpRamp: 3, hpCurve: 0.003, // boss HP at stage s (0-based) = hp0 * hpGrowth^s * e^(hpCurve*s^2): gentle start, steeper later
  bigEvery: 5, bigHp: 1.4, bigRank: 1.6, // BIG BOSS: x1.4 HP; its chests roll rarity as if stage were x1.6 further
  lootGrowth: 1.3,                 // weapon damage of loot found at stage s is x lootGrowth^s
  // rarity: White, Green, Blue, Purple, Gold, Legendary - power multiplier and base weights; higher ranks get likelier with stage
  rank: { pow: [1, 1.5, 2.2, 3.3, 5, 8], w: [52, 27, 13, 6, 1.7, 0.3], perStage: 0.09 },
  kindW: { weapon: 0.55, armor: 0.2, accessory: 0.25 },
  weapon: { base: 60, spread: 0.3, crit: [0.05, 0.07, 0.09, 0.12, 0.15, 0.2] },
  // one effect per armour / accessory piece, value by rarity rank 0..5
  armor: { stats: ['elemB', 'critX', 'combo', 'execute'],
    elemB: [0.15, 0.22, 0.32, 0.45, 0.65, 1.0], critX: [0.1, 0.15, 0.22, 0.3, 0.42, 0.6],
    combo: [0.005, 0.008, 0.012, 0.016, 0.022, 0.03], execute: [0.02, 0.025, 0.03, 0.04, 0.05, 0.07] },
  accessory: { stats: ['glob', 'echo', 'greed', 'okConv'],
    glob: [0.1, 0.15, 0.22, 0.3, 0.42, 0.6], echo: [0.04, 0.05, 0.07, 0.09, 0.12, 0.16], greed: [0.1, 0.14, 0.2, 0.26, 0.33, 0.45], okConv: [0.01, 0.015, 0.02, 0.03, 0.04, 0.06] },
  caps: { execute: 0.2, echo: 0.6, greed: 0.8 },
  // DARK chest: replaces one of the 3 sometimes; random element, rarity shifted up, may hold a CURSED item
  dark: { chance: 0.25, from: 2, shift: 1.6, curse: 0.35 },
  curse: { kinds: { weapon: ['drain'], armor: ['critDown', 'seal'], accessory: ['weak', 'hpUp'] }, kindW: [0.4, 0.3, 0.3],
    drain: [120, 200], critDown: 0.6, weak: 0.6, hpUp: 1.4 },
  gem: 0.08,                       // PURIFY GEM chance from a normal chest (auto-removes the worst cursed item, else stored)
  hero: { atk: 40, crit: 0.05 },   // the hero's own swing grows like loot: atk * lootGrowth^stage
  critX: 2,
  // ELEMENTS: every 3 same-element items = +1 Lv (no cap); Lv1-3 add qualitative upgrades, every Lv adds MASTERY
  elem: {
    // FIRE: your Fire hits keep burning (x% of the Fire hits per tick). Lv3 INFERNO: +1 tick per 3 extra Fire items
    Fire: { burn: [0, 0.3, 0.7, 1.5], ticks: [0, 3, 4, 6] },
    // ICE: frostbite amplifies EVERY hit; Ice weapons crit more. Lv3 SHATTER: +1x crit damage for everything
    Ice: { vuln: [1, 1.3, 1.8, 3.0], crit: [0, 0.1, 0.2, 0.35], shatter: 1 },
    // THUNDER: each Thunder hit may fork into chain bolts. Lv3 STORM: chain bolts can crit
    Thunder: { chance: [0, 0.4, 0.6, 0.8], chains: [0, 2, 4, 7], bolt: 0.8 },
    // MASTERY: weapons of an element hit x2 harder per Lv of that element (compounding: what you STACK is the build)
    step: 3, mastery: 2 },
  // DUAL COMBOS when two elements are both Lv1+: MELT (Fire+Ice) burn x3, SUPERCONDUCT (Ice+Thunder) crit damage x2,
  // OVERLOAD (Fire+Thunder) an explosion of 35% of all hits
  // each combo's power grows with the LOWER level of its two elements: base x per^(lv-1)
  combos: { res: 3, melt: { base: 4, per: 1.6 }, superconduct: { base: 2.5, per: 1.4 }, overload: { base: 1, per: 1.5 } },
  // HIGH QUALITY chests: some normal chests shimmer - better rarity odds (not a guarantee)
  hq: { chance: 0.25, shift: 1.6 },
  // TYPE TAG: in ~20% of rounds ONE normal chest promises its item type (weapon rarer than armour / accessory); rarity still
  // random. It rarely also shimmers HIGH QUALITY (a jackpot chest). Never before the first-weapons stages.
  kindTag: { chance: 0.2, w: { weapon: 0.2, armor: 0.4, accessory: 0.4 }, hqBoth: 0.1 },
  // boss drop after an overkill (q = damage / HP >= chestAt): rarity shift grows with log2(q) -> bigger overkill, better odds
  bonus: { minor: false, chestAt: 3, jackpotAt: 8, okBase: 0.8, okPer: 0.3, okMax: 2.4 },
  milestone: 5,
  firstWeapons: 2,
  smart: { hq: 7, logCap: 0, tight: 1.5, w: 50, dark: 3 },   // sim-only weights of the 'smart' pick policy
  variants: { weapon: 5, armor: 2, accessory: 2, cursed: 4 },
  cap: 1e300,
};
const ELEMENTS = ['Fire', 'Ice', 'Thunder'];
const CATS = ['weapon', 'armor', 'accessory'];
const RANKS = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'];
const ri = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const capN = (x) => (x > RULES.cap ? RULES.cap : x < -RULES.cap ? -RULES.cap : x);
const isBig = (s) => (s + 1) % RULES.bigEvery === 0;
// per-stage HP growth ramps from hpStart to hpGrowth over the first hpRamp stages (a gentle start, no early wall)
const hpPow = (s) => { const R = RULES; let l = 0; for (let k = 0; k < s; k++) l += Math.log(R.hpStart + (R.hpGrowth - R.hpStart) * Math.min(1, k / R.hpRamp)); return Math.exp(l); };
const bossHp = (s) => capN(RULES.hp0 * hpPow(s) * Math.exp(RULES.hpCurve * s * s) * (isBig(s) ? 1 + (RULES.bigHp - 1) * Math.min(1, s / 14) : 1))   // big bosses ramp in (no wall at the first one);
const lootScale = (s) => capN(Math.pow(RULES.lootGrowth, s));
// bosses have NO elements: element choice is purely about your BUILD (levels, combos), HIGH QUALITY odds and dark chests
const BOSS_N = 15;
const bossEl = () => null;
// 3 chests, one per element (shuffled); from stage `dark.from` one may be swapped for a DARK chest of a random element
function rollOffer(rng, s = 0) {
  const els = [...ELEMENTS]; for (let i = 2; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [els[i], els[j]] = [els[j], els[i]]; }
  const off = els.map((e) => ({ type: 'normal', element: e, hq: rng() < RULES.hq.chance }));
  if (s >= RULES.dark.from && rng() < RULES.dark.chance) off[Math.floor(rng() * 3)] = { type: 'dark', element: pick(rng, ELEMENTS) };
  const K = RULES.kindTag;
  if (s >= RULES.firstWeapons && rng() < K.chance) {
    const norm = off.filter((c) => c.type === 'normal'), c = norm[Math.floor(rng() * norm.length)];
    if (c) { const x = rng(); c.kind = x < K.w.weapon ? 'weapon' : x < K.w.weapon + K.w.armor ? 'armor' : 'accessory'; c.hq = rng() < K.hqBoth; }
  }
  return off;
}
const eAvg = (it) => (it.lo + it.hi) / 2;
const heroAtk = (s) => capN(RULES.hero.atk * lootScale(s));
let UID = 1;
// rarity rank: base weights, each rank's weight x (1 + perStage*s)^rank; shift > 1 favours high ranks more
function rollRank(s, rng, shift = 1) {
  const R = RULES.rank, g = (1 + R.perStage * s) * shift, w = R.w.map((x, r) => x * Math.pow(g, r));
  let x = rng() * w.reduce((a, b) => a + b, 0); for (let r = 0; r < w.length; r++) { x -= w[r]; if (x < 0) return r; } return w.length - 1;
}
function mkWeapon(el, rank, s, rng) {
  const W = RULES.weapon, k = lootScale(s) * RULES.rank.pow[rank] * W.base * (0.85 + rng() * 0.3);
  return { id: UID++, kind: 'weapon', element: el, v: ri(rng, 0, RULES.variants.weapon - 1), stage: s, rank, rarity: RANKS[rank],
    lo: capN(k * (1 - W.spread)), hi: capN(k * (1 + W.spread)), crit: Math.round((W.crit[rank] + (rng() - 0.5) * 0.02) * 100) / 100 };
}
function mkGear(kind, el, rank, s, rng) {
  const P = RULES[kind], stat = pick(rng, P.stats);
  return { id: UID++, kind, element: el, v: ri(rng, 0, RULES.variants[kind] - 1), stage: s, rank, rarity: RANKS[rank], stat, val: P[stat][rank] };
}
function mkCurse(el, s, rng) {
  const C = RULES.curse, x = rng(), kind = x < C.kindW[0] ? 'weapon' : x < C.kindW[0] + C.kindW[1] ? 'armor' : 'accessory';
  const curse = pick(rng, C.kinds[kind]);
  const it = { id: UID++, kind, cursed: true, curse, element: el, v: ri(rng, 0, RULES.variants.cursed - 1), stage: s, rank: 0, rarity: 'CURSED', lo: 0, hi: 0, crit: 0 };
  if (curse === 'drain') { const k = lootScale(s), c = ri(rng, C.drain[0], C.drain[1]); it.lo = -capN(c * 1.2 * k); it.hi = -capN(c * 0.8 * k); }
  return it;
}
function rollKind(rng) { const x = rng(), K = RULES.kindW; return x < K.weapon ? 'weapon' : x < K.weapon + K.armor ? 'armor' : 'accessory'; }
function mkRandom(el, rank, s, rng, kind = null) { const k = kind || rollKind(rng); return k === 'weapon' ? mkWeapon(el, rank, s, rng) : mkGear(k, el, rank, s, rng); }
// open a chest: random kind + rarity. G (optional) supplies GREED (+1 rarity chance). noCurse: bonus chests never curse.
function openChest(chest, rng, s = 0, G = null, noCurse = false, shift = 1) {
  const R = RULES, el = chest.element, dark = chest.type === 'dark';
  if (dark && !noCurse && rng() < R.dark.curse) return mkCurse(el, s, rng);
  let rank = rollRank(s, rng, shift * (dark ? R.dark.shift : 1) * (chest.hq ? R.hq.shift : 1) * (isBig(s) ? R.bigRank : 1));
  let greedy = false;
  if (G && rank < 5 && rng() < stats(G.items).greed) { rank++; greedy = true; }
  // the first chests of a run are always weapons (no run dies at stage 2 to three accessories)
  const it = s < R.firstWeapons ? mkWeapon(el, rank, s, rng) : mkRandom(el, rank, s, rng, dark ? null : chest.kind); if (greedy) it.greedy = true;
  if (!dark && rng() < R.gem) it.gem = 1;
  return it;
}
// reward for overkilling a boss (q = damage / HP); a BIG BOSS always gives at least a bonus chest
// rarity shift of a boss drop for overkill ratio q (>= chestAt): okBase + okPer * log2(q), capped
const okShift = (q) => { const B = RULES.bonus; return Math.min(B.okMax, B.okBase + B.okPer * Math.log2(Math.max(1, q))); };
// chance that a chest rolled with this shift at stage s comes out RARE or better (shown on the drop card)
function rarePlus(s, shift) { const R = RULES.rank, g = (1 + R.perStage * s) * shift * (isBig(s) ? RULES.bigRank : 1), w = R.w.map((x, r) => x * Math.pow(g, r)), t = w.reduce((a, b) => a + b, 0); return (t - w[0] - w[1]) / t; }
function bonusDrop(dmg, hp, rng, s = 0, executed = false) {
  const B = RULES.bonus, el = pick(rng, ELEMENTS), q0 = dmg / hp; let q = q0; if (!(q >= 1) && !executed) return null;
  if (isBig(s)) q = Math.max(q, B.chestAt);
  if (q < B.chestAt) return B.minor ? { tier: 'minor', item: openChest({ type: 'normal', element: el }, rng, s, null, true, 0.8) } : null;
  const shift = okShift(q), tier = q < B.jackpotAt ? 'chest' : 'jackpot';
  return { tier, q: q0, shift, rare: rarePlus(s, shift), base: rarePlus(s, 1), item: openChest({ type: 'normal', element: el }, rng, s, null, true, shift) };
}
// ---- gear: one list (newest last); everything stacks forever ----
function newGear() { return { items: [], gems: 0, purified: 0, perm: 0 }; }
const curses = (G) => G.items.filter((it) => it.cursed);
const hasCurse = (G, c) => G.items.some((it) => it.curse === c);
const weakMult = (G) => G.items.reduce((a, it) => (it.curse === 'weak' ? a * RULES.curse.weak : a), 1);
const hpMult = (G) => G.items.reduce((a, it) => (it.curse === 'hpUp' ? a * RULES.curse.hpUp : a), 1);
const offEls = (G) => [...new Set(G.items.filter((it) => it.curse === 'seal').map((it) => it.element))];
const stageHp = (s, G) => capN(bossHp(s) * hpMult(G));
const gearList = (G) => G.items;
const ofKind = (G, k) => G.items.filter((it) => it.kind === k);
function elemLv(list) {
  const cnt = { Fire: 0, Ice: 0, Thunder: 0 }; list.forEach((it) => { if (!it.cursed && cnt[it.element] !== undefined) cnt[it.element]++; });   // curses never count
  const lv = {}; ELEMENTS.forEach((e) => { lv[e] = Math.floor(cnt[e] / RULES.elem.step); });   // a new level every `step` items, no cap
  return { cnt, lv };
}
// every number a strike uses, from the active (non-sealed) gear list. Pure sums / products -> order-independent.
function stats(list) {
  const E = RULES.elem, C = RULES.combos, { cnt, lv } = elemLv(list);
  const S = { cnt, lv, glob: 1, elemB: { Fire: 0, Ice: 0, Thunder: 0 }, critX: RULES.critX, combo: 0, execute: 0, echo: 0, greed: 0, okConv: 0 };
  list.forEach((it) => {
    if (it.cursed) { if (it.curse === 'critDown') S.critX -= RULES.curse.critDown; return; }
    if (it.kind === 'weapon') return;
    if (it.stat === 'elemB') S.elemB[it.element] += it.val; else if (it.stat === 'glob') S.glob += it.val; else S[it.stat] += it.val;
  });
  S.execute = Math.min(RULES.caps.execute, S.execute); S.echo = Math.min(RULES.caps.echo, S.echo); S.greed = Math.min(RULES.caps.greed, S.greed);
  const L3 = (x) => Math.min(3, x);
  S.burn = E.Fire.burn[L3(lv.Fire)]; S.burnT = E.Fire.ticks[L3(lv.Fire)] + Math.max(0, lv.Fire - 3);
  S.vuln = E.Ice.vuln[L3(lv.Ice)] * (lv.Ice > 3 ? 1 + 0.25 * (lv.Ice - 3) : 1); S.critUp = E.Ice.crit[L3(lv.Ice)]; if (lv.Ice >= 3) S.critX += E.Ice.shatter;
  S.chance = E.Thunder.chance[L3(lv.Thunder)]; S.chains = E.Thunder.chains[L3(lv.Thunder)] + Math.max(0, lv.Thunder - 3); S.bolt = E.Thunder.bolt; S.storm = lv.Thunder >= 3;
  // combo level = the lower of its two element levels (0 = off)
  S.melt = Math.min(lv.Fire, lv.Ice); S.superconduct = Math.min(lv.Ice, lv.Thunder); S.overload = Math.min(lv.Fire, lv.Thunder);
  const M = (l) => Math.pow(E.mastery, l);   // MASTERY: x per level of that element, compounding -> stacking one element snowballs
  S.mastery = { Fire: M(lv.Fire), Ice: M(lv.Ice), Thunder: M(lv.Thunder) };
  // combos grow with the lower level of their two elements
  S.burn *= S.melt ? C.melt.base * Math.pow(C.melt.per, S.melt - 1) : 1;
  S.critX *= S.superconduct ? C.superconduct.base * Math.pow(C.superconduct.per, S.superconduct - 1) : 1;
  S.boom = S.overload ? C.overload.base * Math.pow(C.overload.per, S.overload - 1) : 0;
  // RESONANCE: hits of a combo's two elements are x res^(combo Lv); a hit takes only its BEST combo (pairs, not spreading, win)
  S.comboMul = { Fire: 1, Ice: 1, Thunder: 1 };
  [['melt', 'Fire', 'Ice'], ['superconduct', 'Ice', 'Thunder'], ['overload', 'Fire', 'Thunder']].forEach(([k, a, b]) => {
    const v = S[k] ? Math.pow(C.res, S[k]) : 1; S.comboMul[a] = Math.max(S.comboMul[a], v); S.comboMul[b] = Math.max(S.comboMul[b], v); });
  S.critX = Math.max(1, S.critX);
  return S;
}
const critOf = (it, S) => it && it.cursed ? 0 : Math.min(0.95, (it ? it.crit : RULES.hero.crit) + (it && it.element === 'Ice' ? S.critUp : 0));
const isEl = (it, e) => !!it && !it.cursed && it.element === e;
function hitters(G) {
  const off = offEls(G), list = G.items.filter((it) => it.cursed || !off.includes(it.element));
  return { list, S: stats(list), weapons: list.filter((it) => it.kind === 'weapon') };
}
const hitMul = (it, S, G, B) => (S.glob + G.perm) * (it && !it.cursed ? (1 + S.elemB[it.element]) * S.mastery[it.element] * S.comboMul[it.element] : 1) * S.vuln * weakMult(G);
// hero POWER: expected total damage of a strike vs boss B (curses included) - an expectation, not a guarantee
function expStrike(G, B = null, s = 0) {
  const { S, weapons } = hitters(G), good = weapons.filter((w) => !w.cursed);
  const nH = 1 + good.length * (1 + S.echo) + (weapons.length - good.length), cm = 1 + S.combo * (nH - 1);
  const chainK = 1 + S.chance * S.chains * S.bolt;
  let sum = 0, fire = 0;
  [null, ...weapons].forEach((it) => {
    const base = it ? eAvg(it) : heroAtk(s), p = critOf(it, S);
    let v = base * hitMul(it, S, G, B) * cm * (1 + p * (S.critX - 1)) * (it && !it.cursed ? 1 + S.echo : 1);
    if (isEl(it, 'Thunder')) v *= chainK;
    sum += v; if (isEl(it, 'Fire')) fire += v;
  });
  sum = Math.max(0, sum);
  return capN(sum * (1 + S.boom) + Math.max(0, fire) * S.burn * S.burnT);
}
// the cursed item whose removal helps most
function worstCurse(G) {
  let best = null, bv = -1;
  curses(G).forEach((c) => { const g = { ...G, items: G.items.filter((x) => x !== c) }; const v = expStrike(g) / hpMult(g); if (v > bv) { bv = v; best = c; } });
  return best;
}
function purify(G) { if (G.gems <= 0) return null; const c = worstCurse(G); if (!c) return null; G.items = G.items.filter((x) => x !== c); G.gems--; G.purified++; return c; }
// returns what happened, for the UI: { type: 'add' | 'curse', item, gem, purified: [items] }
function equip(G, it) {
  G.items.push(it);
  const ev = { type: it.cursed ? 'curse' : 'add', item: it, n: G.items.length, gem: !!it.gem, purified: [] };
  if (it.gem) G.gems++;
  let p; while ((p = purify(G))) ev.purified.push(p);
  return ev;
}
function rollItem(it, rng) { return it.lo === it.hi ? it.lo : rng ? it.lo + rng() * (it.hi - it.lo) : (it.lo + it.hi) / 2; }
// the strike vs boss B at stage s: hero + every weapon (+ echoes) hit on their own; chains, overload, burn; execute line
function computeDamage(G, rng, s = 0) {
  const B = bossEl(s), { list, S, weapons } = hitters(G), off = offEls(G), hp = stageHp(s, G);
  const seq = [null]; weapons.forEach((w) => { seq.push(w); if (!w.cursed && S.echo > 0 && rng && rng() < S.echo) seq.push({ echo: true, src: w }); });
  const nH = seq.length, cm = 1 + S.combo * (nH - 1);
  const hits = []; let sum = 0, fire = 0, crits = 0, chained = 0, echoes = 0;
  seq.forEach((h0) => {
    const it = h0 && h0.echo ? h0.src : h0; if (h0 && h0.echo) echoes++;
    const roll = it ? rollItem(it, rng) : heroAtk(s);
    const crit = !!rng && rng() < critOf(it, S);
    const v = capN(roll * hitMul(it, S, G, B) * cm * (crit ? S.critX : 1));
    const ch = rng && isEl(it, 'Thunder') && S.chance > 0 && rng() < S.chance ? S.chains : 0;
    const bc = S.storm && rng && rng() < critOf(it, S) ? S.critX : 1, cv = capN(v / (crit ? S.critX : 1) * S.bolt * ch * bc);
    hits.push({ it, echo: !!(h0 && h0.echo), v, crit, chain: ch, cv }); sum = capN(Math.max(0, sum + v + cv)); if (isEl(it, 'Fire')) fire = capN(fire + v); if (crit) crits++; if (ch) chained++;
  });
  const boom = S.boom ? capN(sum * S.boom) : 0;
  const tick = capN(fire * S.burn), ticks = S.burn > 0 ? Array.from({ length: S.burnT }, () => tick) : [];
  const burn = capN(tick * ticks.length), total = capN(sum + boom + burn);
  const executed = total < hp && S.execute > 0 && hp - total <= S.execute * hp;
  return { list, S, B, off, weak: weakMult(G), hits, nH, combo: cm, crits, chained, echoes, hit: sum, boom, burn, ticks, total, hp, executed, kill: total >= hp || executed };
}
// after a kill: OVERKILL CONVERSION turns part of the overkill into a permanent damage bonus (capped per kill)
function afterKill(G, r) { const S = r.S, q = r.total / r.hp; if (!(S.okConv > 0) || !(q > 1)) return 0; const g = S.okConv * Math.min(3, q - 1); G.perm += g; return g; }
const nextAt = (lv) => (lv + 1) * RULES.elem.step;
// ---- pick policies (balance sim + the debug jump) ----
// build focus: a PAIR of elements (most items) -> its combo RESONANCE + both masteries; ties -> fixed order
function focusEls(S) { return [...ELEMENTS].sort((a, b) => S.cnt[b] - S.cnt[a] || ELEMENTS.indexOf(a) - ELEMENTS.indexOf(b)).slice(0, 2); }
// value of adding one item of element el: the lagging half of the pair >> the leading half >> the third element
function buildValue(S, el) {
  const n = S.cnt[el], nxt = nextAt(S.lv[el]), F = focusEls(S), tot = ELEMENTS.reduce((a, e) => a + S.cnt[e], 0);
  if (tot < 2) return 0;
  const o = F[0] === el ? F[1] : F[0];
  let v = F.includes(el) ? (n <= S.cnt[o] ? 16 : 10) : -8;
  v += Math.max(0, 6 - (nxt - n) * 2);
  return v;
}
// smart: weighs survival this stage (expected damage with that chest's infusion + an average item) against build value,
// HIGH QUALITY odds and dark-chest risk
function smartPick(off, G, s, rng = Math.random) {
  const S = stats(G.items), B = bossEl(s), hp = stageHp(s, G);
  let best = null, bs = -1e9;
  for (const c of off) {
    const probe = mkWeapon(c.element, Math.min(5, rollRank(s, () => 0.5, (c.hq ? RULES.hq.shift : 1) * (c.type === 'dark' ? RULES.dark.shift : 1))), s, () => 0.5);
    const g2 = { ...G, items: [...G.items, probe] }, q = expStrike(g2, B, s) / hp;
    const P = RULES.smart;
    let sc = buildValue(S, c.element) + (c.hq ? P.hq : 0) + Math.min(P.logCap, 2 * Math.log2(Math.max(0.01, q)));
    if (q < P.tight) sc += P.w * (q - P.tight);   // survival first when it is tight
    if (c.type === 'dark') sc += curses(G).length && !G.gems ? -25 : P.dark;
    sc += rng() * 0.5; if (sc > bs) { bs = sc; best = c; }
  }
  return best;
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
// the variant (it.v, rolled by the logic) picks the icon + noun
function nameItem(it) {
  const r = (n) => Math.floor(Math.random() * n);
  // cursed armour / accessories use the dark relic icons; a cursed weapon keeps its weapon shape (drawn purple)
  const pool = it.cursed && it.kind !== 'weapon' ? ICONS.cursed : ICONS[it.kind][it.element];
  const c = it.cursed && it.kind !== 'weapon' ? ICONS.cursed[CURSE_ICON[it.curse] || 0] : pool[(it.v || 0) % pool.length];
  it.frame = c[0];
  it.np = it.cursed ? { cur: r(4), pre: r(5), noun: NOUN_KEYS.indexOf(c[1]) } : { pre: r(5), mid: r(8), noun: NOUN_KEYS.indexOf(c[1]) };
  Object.defineProperty(it, 'name', { get() { return itemName(this); }, configurable: true, enumerable: false }); // localized on every read
  return it;
}
function itemName(it) {
  const N = t('names'), pre = N.pre[it.element][it.np.pre], noun = N.noun[it.np.noun];
  return it.cursed ? N.fmtCur(N.cur[it.np.cur], pre, noun) : N.fmt(pre, N.mid[it.np.mid], noun);
}
const elName = (e) => t('el')[e];
// Every item states its own damage rule.
const fmtX = (x) => '×' + (x >= 1e4 ? fmt(x) : x >= 100 ? Math.round(x) : x >= 10 ? x.toFixed(1) : x.toFixed(2).replace(/0$/, ''));
const CURSE_ICON = { critDown: 1, seal: 0, weak: 2, hpUp: 3 };
const P100 = (x) => Math.round(x * 100);
const vfmt = (v) => Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
function ruleText(it) {
  if (it.cursed) {
    const C = RULES.curse;
    if (it.curse === 'drain') return t('cur').drain(fmt(-it.hi), fmt(-it.lo));
    if (it.curse === 'critDown') return t('cur').critDown(vfmt(C.critDown));
    if (it.curse === 'seal') return t('cur').seal(elName(it.element));
    if (it.curse === 'weak') return t('cur').weak(P100(1 - C.weak));
    return t('cur').hpUp(P100(C.hpUp - 1));
  }
  if (it.kind === 'weapon') return t('ruleW', fmt(it.lo), fmt(it.hi), P100(it.crit));
  const v = it.stat === 'critX' ? vfmt(it.val) : String(Math.round(it.val * 1000) / 10);
  return t('eff')[it.stat](v, elName(it.element));
}
const ruleCol = (it) => it.cursed ? '#ff6a9a' : it.kind === 'accessory' ? '#ffd84a' : it.kind === 'armor' ? '#9ae8ff' : '#b8f0a0';
const starStr = () => '';
const elemCount = (items, el) => items.filter((i) => i.element === el).length;
// element synergy text: [name + level line, effect line]
function synLines(el, items) {
  const Y = stats(items.filter((i) => !i.cursed || i.curse !== 'seal')), n = Y.cnt[el], lv = Y.lv[el], nx = nextAt(lv);
  const P = (x) => Math.round(x * 100);
  const fx = !lv ? t('synOff') : el === 'Fire' ? t('synFx').Fire(P(Y.burn), Y.burnT) : el === 'Ice' ? t('synFx').Ice(P(Y.vuln - 1), P(Y.critUp)) : t('synFx').Thunder(P(Y.chance), Y.chains);
  return [`${elName(el)} ${t('syn')[el]} · ${t('synLv', n, lv, nx)}`, (lv ? `${elName(el)} ×${Y.mastery[el].toFixed(2)} · ` : '') + fx + (lv >= 3 ? ' · ' + t('lv3')[el] : '')];
}
const itemCol = (it) => it.cursed ? CURSE_COL : EL_COLOR[it.element];
const RARITY = {
  COMMON: { css: '#e8e8e8', col: 0xe8e8e8, n: 8, shake: 0 },       // white
  UNCOMMON: { css: '#7aff8a', col: 0x5aff6a, n: 14, shake: 0 },    // green
  RARE: { css: '#6ab8ff', col: 0x4a9aff, n: 22, shake: 0 },        // blue
  EPIC: { css: '#d58cff', col: 0xc06aff, n: 36, shake: 0.006 },    // purple
  LEGENDARY: { css: '#ffcf40', col: 0xffcf40, n: 60, shake: 0.012 }, // gold
  MYTHIC: { css: '#ff7a4a', col: 0xff5a2a, n: 90, shake: 0.016 },  // legendary orange-red
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
  const scale = Math.min(b.scale * k, 270 / b.fw, 330 / b.fh), w = b.fw * scale;
  const x = Math.round(W - 10 - w / 2);   // portrait: the boss stands on the right, the hero on the left
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
// PORTRAIT canvas (X player cards open full-screen portrait on phones). FIT keeps it whole; wide viewports letterbox it.
// 432 wide: on a 390-px phone 1 logical px = 0.9 CSS px, so the smallest text (16) stays >= 14 CSS px.
const W = 432, H = 864;
let FONT = fontFor(LANG);
// FIXED LAYOUT: top HUD (hero, POWER, element + combo chips) 6..132, boss box 138..214, play area, bottom gear bar BAR_Y..H
const BOSS_Y = 138, BAR_Y = 798, HPX = 22, HPW = W - 44, PLAY_R = W;
const LAVA_GROUND = 700;   // floor line on the strike / intro / title screens
const PICK_GROUND = 790;   // hoard floor on the pick screen (hero + waiting boss stand on it)
const HERO_X = 86, TOPY_POP = 250, LOG_Y = 704, LOG_N = 5, LOG_RH = 23;
const CHEST_X = [76, 216, 356], CHEST_BASE = 500, CHEST_SC = 4, CARD_Y = 668;
window.DC = { phase: 'boot', round: 0 };
// test hook: DC.jump(20) starts stage 21 with gear built by 20 stages of picks
window.DC.jump = (n, seed, scene, bare) => {
  const g = window.game, R = jumpRun(n, seed); if (bare) R.G = newGear(R.G.seed);
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
  let sz = size; while (o.width > maxW && sz > 12) { sz -= 1; o.setFontSize(sz + 'px'); }
  return o;
}
function setFit(o, s) { o.setFontSize(o.__size + 'px'); o.setText(s); if (o.__maxW) fitText(o, o.__maxW, o.__size); return o; }
// cut a single-line text with an ellipsis until it fits
function clipText(o, maxW) { const full = o.text; let n = full.length; while (o.width > maxW && n > 1) { n--; o.setText(full.slice(0, n) + '…'); } return o; }
function sfx(scene, key, vol = 0.8) { try { scene.sound.play(key, { volume: vol }); } catch (e) {} }
// tiny procedural WebAudio hits (no files): only after the audio context is unlocked by a tap, honours mute / master volume.
// 'hit' = a blip whose pitch rises one semitone per hit in the volley; 'crit' = a heavy low thump + bright ping; 'windup' = a rising whoosh
let NOISE = null;
function synth(scene, kind, i = 0) {
  try {
    const snd = scene.sound, ctx = snd.context; if (!ctx || snd.locked || snd.mute || ctx.state !== 'running') return;
    const now = ctx.currentTime, mv = (snd.volume === undefined ? 1 : snd.volume), out = ctx.createGain(); out.gain.value = 0.9 * mv; out.connect(ctx.destination);
    if (!NOISE) { NOISE = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.3), ctx.sampleRate); const d = NOISE.getChannelData(0); for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1; }
    const tone = (type, f0, f1, dur, vol, t0 = 0) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, now + t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), now + t0 + dur);
      g.gain.setValueAtTime(0.0001, now + t0); g.gain.exponentialRampToValueAtTime(vol, now + t0 + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, now + t0 + dur); o.connect(g); g.connect(out); o.start(now + t0); o.stop(now + t0 + dur + 0.02); };
    const noise = (dur, vol, freq, q = 0.8, t0 = 0, sweep = 0) => { const b = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); b.buffer = NOISE; f.type = 'bandpass'; f.frequency.setValueAtTime(freq, now + t0); if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, now + t0 + dur); f.Q.value = q;
      g.gain.setValueAtTime(0.0001, now + t0); g.gain.exponentialRampToValueAtTime(vol, now + t0 + (sweep ? dur * 0.8 : 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, now + t0 + dur); b.connect(f); f.connect(g); g.connect(out); b.start(now + t0); b.stop(now + t0 + dur + 0.02); };
    if (kind === 'hit') { const f = 330 * Math.pow(2, Math.min(i, 24) / 12); tone('square', f, f * 0.6, 0.07, 0.05); noise(0.05, 0.12, 2400); }
    else if (kind === 'crit') { const f = 520 * Math.pow(2, Math.min(i, 24) / 24); tone('sine', 140, 42, 0.22, 0.32); noise(0.12, 0.25, 900, 0.6); tone('triangle', f * 2, f * 1.5, 0.16, 0.07, 0.01); }
    else if (kind === 'windup') { noise(0.16, 0.12, 300, 1.2, 0, 2600); tone('sawtooth', 90, 260, 0.16, 0.03); }
    else if (kind === 'kill') { tone('sine', 90, 30, 0.5, 0.35); noise(0.35, 0.22, 600, 0.5); }
  } catch (e) {}
}
// pixel backdrop (432x240 art) zoomed x4 around its floor line, centred; dark fill below the art
function backdrop(scene, key, dim, gy = key === 'bg_hoard' ? PICK_GROUND : LAVA_GROUND) {
  const gi = key === 'bg_hoard' ? 196 : 186, s = Math.max(4, gy / gi);
  scene.add.rectangle(-200, -200, W + 400, H + 400, 0x120a10).setOrigin(0);
  scene.add.image(W / 2, gy, key).setOrigin(0.5, gi / 240).setScale(s);
  const bot = gy + (240 - gi) * s; if (bot < H) scene.add.rectangle(-200, bot, W + 400, H - bot + 200, 0x1a0c0c).setOrigin(0);
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
// Item tooltip: hover (mouse) or tap to toggle (touch). Drawn by the UI camera, always clamped inside the portrait canvas.
class Tooltip {
  constructor(scene, getItems) {
    this.scene = scene; this.getItems = getItems; this.pinned = false; this.cur = null;
    this.c = scene.add.container(0, 0).setDepth(1000).setVisible(false); ensureHud(scene); hudAdd(scene, this.c);
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
    const w = W - 24; let lines;
    if (it.kind === 'gem') lines = [[t('gemT'), 26, '#e0b8ff'], [t('gemHeld', this.scene.G ? this.scene.G.gems : 0), 22, '#ffffff'], [t('gemDesc'), 18, '#d8ccff']];
    else if (it.kind === 'combo') lines = [[t('comboN')[it.combo], 26, it.on ? '#ffd84a' : '#a89ab8'], [t('comboD')[it.combo], 20, '#ffffff'], [it.on ? t('comboOn') : t('comboOff'), 17, it.on ? '#7aff8a' : '#c8b49a']];
    else if (it.kind === 'stat') { const T2 = t('stTip'); lines = [[it.name, 24, it.css], [it.stat === 'curse' ? T2.curse : it.stat === 'perm' ? T2.perm(it.v, it.c) : T2[it.stat](it.v), 18, '#ffffff'], [it.atCap ? T2.cap(it.val) : T2.now(it.val), 20, '#ffd84a']]; }
    else if (it.kind === 'syn') { const [a, b] = synLines(it.element, items); lines = [[a, 22, EL_CSS[it.element]], [t('synDesc')[it.element], 18, '#ffffff'], [b, 24, '#ffd84a']]; }
    else {
      lines = [
        [it.name, 26, it.cursed ? '#d9a6ff' : EL_CSS[it.element]],
        [`${t('rar')[it.rarity]} · ${t('kind')[it.kind]} · ${elName(it.element)}`, 19, R.css],
        [ruleText(it), 28, ruleCol(it)],
      ];
      if (it.cursed) lines.push([t('curseNote'), 18, '#ffb0d0']);
      else {
        lines.push([it.kind === 'weapon' ? t('wNote') : t('effNote')[it.stat] || t('noCrit'), 16, '#c8b49a']);
        const [a, b] = synLines(it.element, items); lines.push([a, 18, EL_CSS[it.element]], [b, 17, '#ffe8a0']);
      }
    }
    let y = 18; const texts = [];
    lines.forEach(([str, size, col]) => {
      const tx = hudAdd(sc, sc.add.text(w / 2, y, str, { fontFamily: FONT, fontSize: size + 'px', color: col, fontStyle: 'bold', stroke: '#140812', strokeThickness: 4, align: 'center', wordWrap: { width: w - 30, useAdvancedWrap: true } }).setOrigin(0.5, 0));
      texts.push(tx); y += tx.height + 8;
    });
    const h = y + 14; // measured, so wrapped lines (long translations) stay inside the frame
    const g = hudAdd(sc, panel(sc, 0, 0, w, h, { border: R.col, alpha: 0.98 }));
    this.c.add(g); this.c.add(texts);
    // place beside the icon, flip to the other side / clamp so it never leaves the canvas
    // bigger on small screens (mobile / tiny iframe) so it stays readable
    const k = 1, sw = w * k, sh = h * k;
    const b = obj.getBounds();
    const x = 12;   // full-width card under (or above) the tapped thing
    let ty = b.bottom + 8; if (ty + sh > H - 8) ty = b.top - 8 - sh;
    ty = Phaser.Math.Clamp(ty, 8, H - sh - 8);
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
  // element emblems, 12x12 pixel art: flame, snowflake, bolt
  const pix = (rows, pal) => (c) => rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) { c.fillStyle = pal[ch]; c.fillRect(x, y, 1, 1); } }));
  mk('el_Fire', 12, 12, pix(['.....k......', '....kok.....', '....kook....', '...koyok.k..', '..koyyok.ok.', '.koyyyyookok', '.koyywyyyook', 'koyywwyyyyok', 'koyywwwyyyok', '.koyywwyyok.', '..kooyyook..', '...kkkkkk...'], { k: '#2a0804', o: '#e8401a', y: '#ffb030', w: '#fff2b0' }));
  mk('el_Ice', 12, 12, pix(['.....kk.....', '..k..bk..k..', '.kbk.bw.kbk.', '..kbkwbkbk..', '.kkkbwwbkkk.', 'kbbbwwwwbbbk', 'kbbbwwwwbbbk', '.kkkbwwbkkk.', '..kbkbwkbk..', '.kbk.wb.kbk.', '..k..kb..k..', '.....kk.....'], { k: '#06203a', b: '#5ad2ff', w: '#e8fbff' }));
  mk('el_Thunder', 12, 12, pix(['......kkkk..', '.....kyyyk..', '....kyyyk...', '...kyywk....', '..kyywkkkk..', '.kyyyyyyyk..', '.kkkkwyyk...', '....kyyk....', '...kywk.....', '..kyyk......', '..kyk.......', '..kk........'], { k: '#2a2004', y: '#ffe04a', w: '#ffffe0' }));
  mk('gem', 12, 12, (c) => { // PURIFY GEM: a small faceted violet-white diamond (pixel art)
    const px = (x, y, col) => { c.fillStyle = col; c.fillRect(x, y, 1, 1); };
    const rows = ['....kkkk....', '...kwwppk...', '..kwwppppk..', '.kwppppppdk.', 'kkkkkkkkkkkk', 'kwwppppppddk', '.kwpppppddk.', '..kwpppddk..', '...kwppdk...', '....kpdk....', '.....kk.....', '............'];
    const C = { k: '#1a0630', w: '#ffffff', p: '#c88aff', d: '#7a3ad0' };
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (C[ch]) px(x, y, C[ch]); }));
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
// after a pick the item card + gear peek stay up this much longer (tap anywhere to continue sooner)
const READ_MS = 3200, PEEK_MS = 600000;
// hero POWER: a fixed HUD chip in the top-left corner on every screen (pick, reveal, pre-strike, strike, stage clear, stage card)
// It is drawn by its own fixed UI camera, so camera zoom / pan / shake never move it off screen.
function hudCamera(scene) {
  const ui = scene.uiCam = scene.cameras.add(0, 0, W, H);
  ui.ignore(scene.children.list);
  const ev = Phaser.Scenes.Events.ADDED_TO_SCENE, f = (o) => { if (!o.__hud) ui.ignore(o); };
  scene.sys.events.on(ev, f); scene.sys.events.once('shutdown', () => scene.sys.events.off(ev, f));
}
function toHud(scene, objs) { objs.forEach((o) => { o.__hud = true; o.cameraFilter &= ~scene.uiCam.id; scene.cameras.main.ignore(o); }); }
const BIG_R = { EPIC: 1, LEGENDARY: 1, MYTHIC: 1 }, LEG_R = { LEGENDARY: 1, MYTHIC: 1 };
const pct = (x) => { const p = x * 100; return p >= 100 ? fmt(p) : p >= 10 ? Math.round(p) : p.toFixed(1).replace(/\.0$/, ''); };
function newRun() { return { s: 0, G: newGear(), log: [], total: 0, maxHit: 0 }; }
function loadBest() {
  let st = 0, hit = 0;
  try { st = +localStorage.getItem('dc_best_stage') || 0; hit = +localStorage.getItem('dc_best_hit') || 0; } catch (e) {}
  return { stage: st, hit: isFinite(hit) ? hit : 0 };
}
function saveBest(st, hit) { try { localStorage.setItem('dc_best_stage', String(st)); localStorage.setItem('dc_best_hit', String(hit)); } catch (e) {} }
const EV_COL = { add: 0x8aff7a, curse: CURSE_COL, purify: 0xb8f4ff, gem: 0xd08aff };
const EV_CSS = { add: '#b8f0a0', curse: '#ff8acb', purify: '#c8f8ff', gem: '#e0b8ff' };
function evText(ev) { return ev.type === 'curse' ? t('evCursed') : t('evAdd', ev.n); }
function gearSummary(G) {
  return { n: G.items.length, weapon: ofKind(G, 'weapon').length, armor: ofKind(G, 'armor').length, accessory: ofKind(G, 'accessory').length,
    cursed: curses(G).map((c) => c.curse), gems: G.gems, purified: G.purified };
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
// PURIFY GEM counter (held gems), hover / tap for the tooltip. Returns the created objects.
function gemBadge(scene, tip, G, x, y, depth = 30) {
  if (!G.gems) return [];
  const sq = scene.add.rectangle(x, y, 64, 34, 0x1a0a2a, 0.9).setStrokeStyle(2, 0xd08aff).setDepth(depth);
  const ic = scene.add.image(x - 14, y, 'gem').setScale(1.6).setDepth(depth);
  const n = txt(scene, x + 14, y, '×' + G.gems, 17, '#ffffff', { strokeThickness: 4 }).setDepth(depth + 1);
  tip.attach(sq, { kind: 'gem', rarity: 'EPIC', element: 'Ice', name: t('gemT') });
  return [sq, ic, n];
}
// PURIFY: the cleansed cursed item bursts into white-violet light and dissolves
function purifyFx(scene, it, x, y, depth = 60) {
  const ic = scene.add.image(x, y, 'icons', it.frame).setScale(2.2).setDepth(depth).setTint(0xb070ff);
  const g = scene.add.image(x, y, 'glowdot').setTint(0xe8d8ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth - 1).setScale(0.5).setAlpha(0.9);
  scene.tweens.add({ targets: g, scale: 2.6, alpha: 0, duration: 700, ease: 'Quad.out', onComplete: () => g.destroy() });
  scene.time.delayedCall(180, () => { ic.clearTint().setTintFill(0xffffff); });
  scene.tweens.add({ targets: ic, scale: 3.2, alpha: 0, y: y - 30, delay: 260, duration: 520, ease: 'Quad.in', onComplete: () => ic.destroy() });
  burst(scene, x, y, 0xe0c8ff, 26, 260, 'spark').setDepth(depth + 1);
  burst(scene, x, y, 0xffffff, 12, 180, 'px').setDepth(depth + 1);
  const lab = txt(scene, x, y - 54, t('evPurify'), 26, '#e8f8ff', { strokeThickness: 7, stroke: '#2a0a4a' }).setDepth(depth + 2);
  popText(scene, lab, 1); scene.tweens.add({ targets: lab, y: lab.y - 26, alpha: 0, delay: 1000, duration: 400, onComplete: () => lab.destroy() });
  sfx(scene, 'rare', 0.7); window.DC.purifyFx = (window.DC.purifyFx || 0) + 1;
}

const executeLine = (G) => hitters(G).S.execute;
// debug / screenshot: scale the strike so it ends just inside the execute line (adds an execute item if there is none)
function forceExecute(r) {
  if (!(r.S.execute > 0)) r.S.execute = 0.1;
  const f = r.hp * (1 - r.S.execute * 0.6) / Math.max(1e-9, r.total);
  r.hits.forEach((h) => { h.v *= f; h.cv *= f; }); r.hit *= f; r.boom *= f; r.burn *= f; r.ticks = r.ticks.map((x) => x * f); r.total = capN(r.total * f);
  r.executed = true; r.kill = true;
}
const chestKey = (c) => c.type === 'dark' ? 'black' : c.element;
// NEXT boss preview (one stage ahead): name + BIG tag (bosses have no elements)
function nextBossLine(scene, x, y, s, size = 14, depth = 0) {
  const n = s + 1, big = isBig(n);
  const lab = txt(scene, x, y, `${t('nextBoss')}: ${bossName(n)}${big ? ' · ' + t('bigBoss') : ''}`, size, big ? '#ffb08a' : '#c8b49a', { strokeThickness: 4, maxW: W - 60 });
  if (depth) lab.setDepth(depth);
  window.DC.nextBoss = { name: bossName(n), big };
  return [lab];
}

// ---- build readability: what the next element level gives, combo pairs, chest hints, level-up banners ----
const COMBO_ELS = [['melt', 'Fire', 'Ice'], ['superconduct', 'Ice', 'Thunder'], ['overload', 'Fire', 'Thunder']];
function elemLvFx(el, lv) {   // compact effect of element level lv (>= 1)
  const E = RULES.elem, L3 = Math.min(3, lv), P = (x) => Math.round(x * 100);
  if (el === 'Fire') return t('rw').Fire(P(E.Fire.burn[L3]), E.Fire.ticks[L3] + Math.max(0, lv - 3));
  if (el === 'Ice') return t('rw').Ice(P(E.Ice.vuln[L3] * (lv > 3 ? 1 + 0.25 * (lv - 3) : 1) - 1), P(E.Ice.crit[L3]));
  return t('rw').Thunder(P(E.Thunder.chance[L3]), E.Thunder.chains[L3] + Math.max(0, lv - 3));
}
const lvW = () => (LANG === 'pt' || LANG === 'es' ? 'Nv' : 'Lv');
const lv3Name = (el) => String(t('lv3')[el]).split(/[:：]/)[0];
const nextReward = (el, lv) => `${t('rwMast', RULES.elem.mastery)} · ${elemLvFx(el, lv + 1)}` + (lv + 1 === 3 ? ' · ' + lv3Name(el) : '');
// what taking ONE more item of element el would do right now (chest hint): unlock / level a combo, or reach the next level
function chestHint(G, el) {
  const S = stats(G.items), n = S.cnt[el] + 1, lv2 = Math.floor(n / RULES.elem.step);
  for (const [k, a, b] of COMBO_ELS) {
    if (a !== el && b !== el) continue;
    const o = a === el ? b : a, c2 = Math.min(lv2, S.lv[o]);
    if (c2 > S[k]) return { text: S[k] ? t('comboUp', t('comboN')[k], c2) : t('hintCombo', t('comboN')[k]), combo: true };
  }
  if (lv2 > S.lv[el]) return { text: t('lvUp', elName(el), lv2), lv: true };
  if (nextAt(S.lv[el]) - S.cnt[el] === 1) return { text: t('hintLv', S.lv[el] + 1) };
  return null;
}
// level-ups / combo changes between two stats() snapshots -> banner lines [title, sub, colour]
function buildUps(A, B) {
  const out = [];
  COMBO_ELS.forEach(([k]) => { if (B[k] > A[k]) out.push([A[k] ? t('comboUp', t('comboN')[k], B[k]) : t('comboUnl', t('comboN')[k]), `${t('rwMast', +Math.pow(RULES.combos.res, B[k]).toPrecision(3))} · ${t('cfx')[k](k === 'overload' ? Math.round(B.boom * 100) : k === 'melt' ? +(RULES.combos.melt.base * Math.pow(RULES.combos.melt.per, B[k] - 1)).toPrecision(3) : +(RULES.combos.superconduct.base * Math.pow(RULES.combos.superconduct.per, B[k] - 1)).toPrecision(3))}`, '#7aff8a']); });
  ELEMENTS.forEach((el) => { if (B.lv[el] > A.lv[el]) out.push([t('lvUp', elName(el).toUpperCase(), B.lv[el]), `${t('rwMast', RULES.elem.mastery)} · ${elemLvFx(el, B.lv[el])}` + (B.lv[el] === 3 ? ' · ' + t('lv3')[el] : ''), EL_CSS[el]]); });
  return out;
}
// big centred banner (over everything, readable on mobile), queued so two level-ups never overlap
function buildBanner(scene, lines) {
  if (!lines.length) return;
  window.DC.buildBanner = (window.DC.buildBanner || []).concat(lines.map((l) => l[0]));
  lines.forEach(([title, sub, col], i) => scene.time.delayedCall(i * 1500, () => {
    const X = W / 2, Y = 300, D = 700;
    const t1 = txt(scene, X, Y, title, 34, col, { strokeThickness: 8, stroke: '#1a0a04', maxW: W - 40 }).setDepth(D + 1);
    const t2 = txtW(scene, X, Y + 26, sub, 18, '#fff4d0', W - 60, { stroke: '#1a0a04' }).setDepth(D + 1);
    const bw = W - 20, bg = scene.add.rectangle(X, Y + (t2.height + 26) / 2, bw, t2.height + 70, 0x0a0410, 0.88).setStrokeStyle(3, Phaser.Display.Color.HexStringToColor(col).color).setDepth(D);
    const all = [bg, t1, t2]; if (scene.uiCam) all.forEach((q) => scene.uiCam.ignore(q));
    popText(scene, t1, 1); sfx(scene, 'banner', 0.45); burst(scene, X, Y, Phaser.Display.Color.HexStringToColor(col).color, 24, 260, 'px').setDepth(D + 2);
    scene.tweens.add({ targets: all, alpha: 0, delay: 1350, duration: 350, onComplete: () => all.forEach((q) => q.destroy()) });
  }));
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
      const off = rollOffer(rng, s), G = R.G, best = smartPick(off, G, s, rng);
      const it = openChest(best, rng, s, G);
      equip(G, nameItem(it));
      const d = computeDamage(G, rng, s);
      if (!d.kill && !force) { dead = true; break; }
      R.log.push({ stage: s, dmg: d.total, hp: d.hp, L: d.executed ? 1 : okLevel(d.total, d.hp) }); R.total += d.total; R.maxHit = Math.max(R.maxHit, d.total);
      afterKill(G, d);
      const b = bonusDrop(force ? Math.max(d.total, d.hp * 9) : d.total, d.hp, rng, s, d.executed); if (b) equip(G, nameItem(b.item));
    }
    if (!dead) { window.DC.jumpTries = tries + 1; break; }
  }
  R.s = n; R.G.seenN = R.G.items.length; 
  return R;
}

// ===== PORTRAIT UI (v8): top HUD (hero + POWER + element / combo chips), bottom gear bar, full-screen STATS + GEAR page =====
// Everything here is drawn by the fixed UI camera (never zoomed / shaken). Tap the HUD -> page; tap a bar slot -> page filtered.
function ensureHud(sc) { if (!sc.uiCam || !sc.cameras.cameras.includes(sc.uiCam)) hudCamera(sc); }
function hudAdd(sc, o) { o.__hud = true; o.cameraFilter &= ~sc.uiCam.id; sc.cameras.main.ignore(o); return o; }
// wrapped, centred text (origin top-centre) for lines that must stay >= FS px instead of shrinking
// wrapped, centred text (origin top). Own greedy wrap: CJK breaks between characters (punctuation stays on its line), Latin between words
const WRAP_RE = /[\u3000-\u9fff\uac00-\ud7af\uff00-\uffef][、。，！？：；）」』…·!?,.:;)%]*|[^\s\u3000-\u9fff\uac00-\ud7af\uff00-\uffef]+|\s+/g;
function wrapTo(o, s, w) {
  const out = [];
  String(s).split('\n').forEach((para) => {
    let cur = '';
    (para.match(WRAP_RE) || ['']).forEach((tk) => {
      if (/^\s+$/.test(tk)) { if (cur) cur += ' '; return; }
      const cand = cur + tk; o.setText(cand);
      if (o.width > w && cur.trim()) { out.push(cur.trim()); cur = tk; } else cur = cand;
    });
    out.push(cur.trim());
  });
  o.setText(out.join('\n')); return o;
}
function txtW(sc, x, y, s, size, color, w, extra = {}) {
  const o = sc.add.text(x, y, '', Object.assign({ fontFamily: FONT, fontSize: size + 'px', color, fontStyle: 'bold', stroke: '#140812', strokeThickness: Math.max(4, Math.round(size / 6)), align: 'center' }, extra)).setOrigin(0.5, 0);
  return wrapTo(o, s, w);
}
function bump(sc, o, k = 1.45) { if (!o || !o.active) return; const s0 = o.__s || (o.__s = o.scaleX); sc.tweens.killTweensOf(o); o.setScale(s0 * k); sc.tweens.add({ targets: o, scale: s0, duration: 300, ease: 'Back.out' }); }
function drawHud(sc) {
  ensureHud(sc);
  const D = 70, G = sc.G, S = stats(G.items);
  if (!sc.hud || !sc.hud.pn.active) {
    const h = sc.hud = { dyn: [] }, add = (o) => hudAdd(sc, o);
    add(panel(sc, 6, 6, W - 12, 126, { border: 0xffcf40, alpha: 0.93 }).setDepth(D));
    add(sc.add.rectangle(44, 44, 62, 62, 0x2a1a30).setStrokeStyle(2, 0xffcf40).setDepth(D));
    const hi = add(sc.add.image(44, 54, 'hero_idle', 0).setScale(1.6).setDepth(D + 1)); hi.setCrop(14, 8, 36, 36);
    add(txt(sc, 86, 24, t('power'), 16, '#ffe8a0', { strokeThickness: 4 }).setOrigin(0, 0.5).setDepth(D + 1));
    const pn = h.pn = sc.powN = add(txt(sc, 86, 55, fmt(sc.powShown !== undefined ? sc.powShown : sc.powV || 0), 34, '#ffd36a', { strokeThickness: 7, stroke: '#2a1404' }).setOrigin(0, 0.5).setDepth(D + 1));
    pn.__maxW = 196; pn.__size = 34; fitText(pn, 196, 34);
    const s = sc.s, k0 = Math.floor(s / RULES.bigEvery) * RULES.bigEvery;
    add(txt(sc, W - 70, 27, t('stageN', s + 1), 22, '#ffd36a', { strokeThickness: 6, stroke: '#1a0a04', maxW: 118 }).setDepth(D + 1));
    for (let k = 0; k < RULES.bigEvery; k++) {   // pips toward the next BIG BOSS
      const st = k0 + k, x = W - 114 + k * 22, bg = isBig(st), col = st === s ? 0xffd36a : st < s ? 0x9a7a3a : 0x2a1a24;
      add(sc.add.rectangle(x, 56, bg ? 13 : 10, bg ? 13 : 10, col).setStrokeStyle(2, bg ? 0xff5a4a : 0xc89a4a).setAngle(45).setDepth(D + 1));
    }
    const hit = add(sc.add.rectangle(W / 2, 69, W - 12, 126, 0xffffff, 0.001).setDepth(D + 0.5).setInteractive({ useHandCursor: true }).setData('item', true));
    hit.on('pointerdown', () => { if (!sc.statsLocked) sc.openGear(null); });
    sc.powPos = { x: 150, y: 55 };
  }
  sc.hud.dyn.forEach((o) => o.destroy()); const dyn = sc.hud.dyn = [], add = (o) => { dyn.push(hudAdd(sc, o)); return o; };
  const prev = G.hudPrev || {}, cur = {}, step = RULES.elem.step;
  ELEMENTS.forEach((el, i) => {
    const x0 = 12 + i * 98, y = 105, lv = S.lv[el], n = S.cnt[el], nx = nextAt(lv), frac = Math.max(0, Math.min(1, (n - lv * step) / step));
    add(sc.add.rectangle(x0 + 46, y, 92, 42, 0x1a0e1e, 0.95).setStrokeStyle(2, EL_COLOR[el], lv ? 1 : 0.45).setDepth(D + 1));
    const ic = add(sc.add.image(x0 + 15, y - 4, 'el_' + el).setScale(2).setDepth(D + 2));
    const lt = add(txt(sc, x0 + 30, y - 5, `${lvW()}${lv}`, 18, lv ? '#ffffff' : EL_CSS[el], { strokeThickness: 4 }).setOrigin(0, 0.5).setDepth(D + 2));
    add(txt(sc, x0 + 88, y - 5, `${n}/${nx}`, 16, EL_CSS[el], { strokeThickness: 4 }).setOrigin(1, 0.5).setDepth(D + 2));
    add(sc.add.rectangle(x0 + 6, y + 14, 80, 5, 0x3a2a34).setOrigin(0, 0.5).setDepth(D + 2));
    if (frac > 0) add(sc.add.rectangle(x0 + 6, y + 14, 80 * frac, 5, EL_COLOR[el]).setOrigin(0, 0.5).setDepth(D + 2));
    cur['el' + el] = n; if (prev['el' + el] !== undefined && prev['el' + el] !== n) { bump(sc, ic, 1.6); bump(sc, lt, 1.4); }
  });
  COMBO_ELS.forEach(([k, a, b], j) => {
    const x = 316 + j * 37, y = 105, lv = S[k];
    add(sc.add.rectangle(x + 17, y, 33, 42, lv ? 0x103a18 : 0x1a0e1e, 0.95).setStrokeStyle(2, lv ? 0x7aff8a : 0x5a4a50).setDepth(D + 1));
    const ia = add(sc.add.image(x + 10, y - 8, 'el_' + a).setScale(1.25).setAlpha(lv ? 1 : 0.35).setDepth(D + 2));
    add(sc.add.image(x + 24, y - 8, 'el_' + b).setScale(1.25).setAlpha(lv ? 1 : 0.35).setDepth(D + 2));
    add(txt(sc, x + 17, y + 11, lv ? String(lv) : '–', 16, lv ? '#7aff8a' : '#7a6a7a', { strokeThickness: 3 }).setDepth(D + 2));
    cur['c' + k] = lv; if (prev['c' + k] !== undefined && prev['c' + k] !== lv) bump(sc, ia, 1.8);
  });
  G.hudPrev = cur;
  window.DC.hud = { el: ELEMENTS.map((e) => [S.lv[e], S.cnt[e]]), combos: COMBO_ELS.map(([k]) => S[k]) };
}
const BAR = [['weapon', 0], ['armor', 15], ['accessory', 21], ['cursed', 27], ['gem', -1]];
function barCounts(G) { const ok = (k) => G.items.filter((x) => x.kind === k && !x.cursed).length; return { weapon: ok('weapon'), armor: ok('armor'), accessory: ok('accessory'), cursed: curses(G).length, gem: G.gems }; }
function drawBar(sc) {
  ensureHud(sc);
  (sc.barObjs || []).forEach((o) => o.destroy()); const objs = sc.barObjs = [], add = (o) => { objs.push(hudAdd(sc, o)); return o; };
  const D = 70, y = BAR_Y + 31, sw = (W - 12) / 5, cnt = barCounts(sc.G);
  add(panel(sc, 6, BAR_Y, W - 12, 60, { border: 0xffcf40, alpha: 0.93 }).setDepth(D));
  sc.barPos = {}; sc.barIcons = {};
  BAR.forEach(([k, fr], i) => {
    const cx = 6 + sw * (i + 0.5), n = cnt[k], on = n > 0;
    if (i) add(sc.add.rectangle(6 + sw * i, y, 1, 36, 0xffcf40, 0.25).setDepth(D + 1));
    const ic = add((fr < 0 ? sc.add.image(cx - 15, y, 'gem').setScale(2.6) : sc.add.image(cx - 15, y, 'icons', fr).setScale(1.05)).setDepth(D + 1).setAlpha(on ? 1 : 0.4));
    if (k === 'cursed') ic.setTint(0xc080ff);
    const ct = add(txt(sc, cx + 6, y, String(n), 22, on ? (k === 'cursed' ? '#ff8acb' : '#ffffff') : '#7a6a7a', { strokeThickness: 5 }).setOrigin(0, 0.5).setDepth(D + 1));
    const hit = add(sc.add.rectangle(cx, y, sw - 2, 58, 0xffffff, 0.001).setDepth(D + 2).setInteractive({ useHandCursor: true }).setData('item', true));
    hit.on('pointerdown', () => { if (!sc.statsLocked) sc.openGear(k); });
    sc.barPos[k] = { x: cx - 15, y }; sc.barIcons[k] = [ic, ct];
  });
  window.DC.bar = cnt; window.DC.barPos = sc.barPos;
}
function bumpBar(sc, k) { (sc.barIcons && sc.barIcons[k] || []).forEach((o) => bump(sc, o, 1.7)); }
const barKey = (it) => it.cursed ? 'cursed' : it.kind;
// ---- the merged STATS + GEAR page ----
function closeStats(sc) { sc.pageClosedAt = sc.time.now;
  (sc.pageObjs || []).forEach((o) => o.destroy()); sc.pageObjs = []; sc.pageC = null; sc.gearOpen = false; sc.pageDrag = null;
  if (sc.tip) sc.tip.hide(true); window.DC.gearOpen = false; window.DC.page = null;
}
function openStats(sc, filter = null, keepScroll = false) {
  if (sc.statsLocked) return;
  const oldY = sc.pageScroll || 0;
  closeStats(sc); ensureHud(sc); if (sc.tip) sc.tip.hide(true);
  sc.gearOpen = true; sc.pageFilter = filter; window.DC.gearOpen = true;
  const D = 900, objs = sc.pageObjs = [], add = (o) => { objs.push(hudAdd(sc, o)); return o; };
  const G = sc.G, Y = stats(G.items), TOP = 70;
  const bg = add(sc.add.rectangle(0, 0, W, H, 0x07040c, 1).setOrigin(0).setDepth(D).setInteractive());
  bg.on('pointerdown', (p) => { sc.pageDrag = { y: p.y, s0: sc.pageScroll, moved: false }; });
  // content (scrolls): stats on top, gear list below
  const c = sc.pageC = add(sc.add.container(0, TOP).setDepth(D + 1));
  const mg = sc.make.graphics({ add: false }); mg.fillStyle(0xffffff).fillRect(0, TOP - 4, W, H - TOP + 4); objs.push(mg); c.setMask(mg.createGeometryMask());
  const put = (o) => { hudAdd(sc, o); c.add(o); return o; };
  const T = (x, y, s, size, col, ox = 0) => put(sc.add.text(x, y, s, { fontFamily: FONT, fontSize: size + 'px', color: col, fontStyle: 'bold', stroke: '#140812', strokeThickness: 4 }).setOrigin(ox, 0.5));
  const drag = (o) => { o.on('pointerdown', (p) => { sc.pageDrag = { y: p.y, s0: sc.pageScroll, moved: false }; }); return o; };
  let y = 6;
  const sect = (label) => { put(sc.add.rectangle(W / 2, y + 12, W - 24, 26, 0x2a1a10, 0.9).setStrokeStyle(1, 0xffcf40, 0.6)); T(W / 2, y + 12, label, 18, '#ffd36a', 0.5); y += 34; };
  // power
  T(20, y + 16, t('power'), 18, '#ffe8a0'); T(W - 20, y + 16, fmt(sc.powV || expStrike(G, null, sc.s)), 28, '#ffd36a', 1); y += 40;
  sect(t('elemT'));
  ELEMENTS.forEach((el) => {
    const lv = Y.lv[el], n = Y.cnt[el], nx = nextAt(lv), st = RULES.elem.step, frac = Math.max(0, Math.min(1, (n - lv * st) / st));
    put(sc.add.image(30, y + 12, 'el_' + el).setScale(2.2));
    T(50, y + 12, `${elName(el)} ${lvW()}${lv}`, 20, lv ? '#ffffff' : EL_CSS[el]); T(W - 20, y + 12, `${n}/${nx}`, 20, EL_CSS[el], 1);
    put(sc.add.rectangle(20, y + 32, W - 40, 7, 0x3a2a34).setOrigin(0, 0.5)); if (frac > 0) put(sc.add.rectangle(20, y + 32, (W - 40) * frac, 7, EL_COLOR[el]).setOrigin(0, 0.5));
    const nr = put(txtW(sc, W / 2, y + 40, `→ ${lvW()}${lv + 1}: ${nextReward(el, lv)}`, 16, '#ffe8a0', W - 40));
    const row = drag(sc.tip.attach(put(sc.add.rectangle(W / 2, y + 24, W - 24, 48, 0xffffff, 0.001).setData('row', true)), { kind: 'syn', element: el, rarity: 'RARE', name: t('syn')[el] }));
    y += 46 + nr.height + 8;
  });
  sect(t('comboT'));
  COMBO_ELS.forEach(([k, a, b]) => {
    const lv = Y[k], L = Math.max(1, lv), need = RULES.elem.step * L, miss = lv ? 0 : Math.max(0, need - Y.cnt[a]) + Math.max(0, need - Y.cnt[b]), on = lv > 0;
    T(20, y + 12, t('comboN')[k], 20, on ? '#7aff8a' : '#a89ab8');
    T(W - 20, y + 12, on ? lvW() + lv : t('comboNeed', miss), 18, on ? '#7aff8a' : '#ffb070', 1);
    let cx = 20; const yy = y + 36, al = on ? 1 : 0.5;
    put(sc.add.image(cx + 9, yy, 'el_' + a).setScale(1.6).setAlpha(al)); cx += 22; const ta = T(cx, yy, `${need}+`, 16, on ? '#d8ffd8' : '#a89ab8'); cx += ta.width + 4;
    put(sc.add.image(cx + 9, yy, 'el_' + b).setScale(1.6).setAlpha(al)); cx += 22;
    T(cx, yy, `${need}: ${t('rwMast', +Math.pow(RULES.combos.res, L).toPrecision(3))}`, 16, on ? '#d8ffd8' : '#a89ab8');
    drag(sc.tip.attach(put(sc.add.rectangle(W / 2, y + 24, W - 24, 48, 0xffffff, 0.001).setData('row', true)), { kind: 'combo', combo: k, on: lv, rarity: on ? 'LEGENDARY' : 'COMMON', element: 'Fire', name: t('comboN')[k] }));
    y += 54;
  });
  sect(t('statsT'));
  // execute / echo / greed / permanent: only shown once non-zero (dim hint while all four are 0); curses + gems always
  const U = [['exec', t('stExec'), pct(Y.execute) + '%', '#ff8ab0', Y.execute], ['echo', t('stEcho'), pct(Y.echo) + '%', '#ffffff', Y.echo], ['greed', t('stGreed'), pct(Y.greed) + '%', '#ffd84a', Y.greed], ['perm', t('stPerm'), '+' + pct(G.perm) + '%', '#ffb0e0', G.perm]].filter((r) => r[4]);
  // tap / hover a stat -> what it really does (numbers from the same stats() the strike uses)
  const CAP = { exec: RULES.caps.execute, echo: RULES.caps.echo, greed: RULES.caps.greed }, RAW = { exec: Y.execute, echo: Y.echo, greed: Y.greed };
  const tipFor = (key, label, val, col) => key === 'gems' ? { kind: 'gem', rarity: 'RARE', name: label }
    : { kind: 'stat', stat: key, rarity: key === 'curse' ? 'CURSED' : 'RARE', element: 'Fire', name: label, css: col === '#8a7a8a' ? '#e8dcc8' : col, val,
        v: key === 'perm' ? pct(G.perm) : key === 'curse' ? 0 : pct(RAW[key]), c: pct(Y.okConv || 0), atCap: CAP[key] !== undefined && RAW[key] >= CAP[key] - 1e-9 };
  const rows = U.concat([['curse', t('stCurses'), String(curses(G).length), curses(G).length ? '#ff6a9a' : '#8a7a8a'], ['gems', t('stGems'), String(G.gems), G.gems ? '#e0b8ff' : '#8a7a8a']]);
  if (!U.length) { const h = put(txtW(sc, W / 2, y, t('statHint'), 16, '#9a8a9a', W - 40)); y += h.height + 8; }
  window.DC.statRows = U.map((r) => r[0]);
  rows.forEach(([key, label, val, col], i) => {
    const x = i % 2 ? W / 2 + 6 : 20, wd = W / 2 - 26;
    const lt = T(x, y + 13, label, 18, '#e8dcc8'), vt = T(x + wd, y + 13, val, 18, col, 1); fitText(lt, wd - vt.width - 8, 18);
    if (key === 'gems') put(sc.add.image(x + wd - vt.width - 14, y + 13, 'gem').setScale(1.5));
    drag(sc.tip.attach(put(sc.add.rectangle(x + wd / 2, y + 13, wd + 8, 30, 0xffffff, 0.001).setData('row', true)), tipFor(key, label, val, col)));
    if (i % 2 || i === rows.length - 1) y += 32;
  });
  // GEAR: filter tabs + rows (newest first)
  y += 8; const gearTop = y; sect(t('gearT') + `  ${G.items.length}`);
  const tabs = [[null, t('allT')], ['weapon', t('kind').weapon], ['armor', t('kind').armor], ['accessory', t('kind').accessory], ['cursed', t('cursedT')]];
  const tw = (W - 24) / 5;
  tabs.forEach(([k, lab], i) => {
    const x = 12 + tw * (i + 0.5), sel = (filter || null) === k;
    const r = put(sc.add.rectangle(x, y + 16, tw - 4, 32, sel ? 0x6a4a10 : 0x1a0e1e, 0.95).setStrokeStyle(2, sel ? 0xffd36a : 0x5a4a50).setInteractive({ useHandCursor: true }));
    if (k) {   // kind tabs: the same icon as the bottom bar + its count (no long words to squeeze)
      const fr = BAR.find((q) => q[0] === k)[1], ic = put(sc.add.image(x - 14, y + 16, 'icons', fr).setScale(0.75));
      if (!sel) ic.setAlpha(0.75);
      T(x + 16, y + 16, String(barCounts(G)[k]), 18, sel ? '#ffe8a0' : '#c8b49a', 0.5);
    } else { const tl = T(x, y + 16, lab, 16, sel ? '#ffe8a0' : '#c8b49a', 0.5); fitText(tl, tw - 8, 16); }
    r.on('pointerup', () => { if (sc.pageDrag && sc.pageDrag.moved) return; openStats(sc, k, true); });
    drag(r);
  });
  y += 42;
  const items = [...G.items].reverse().filter((it) => !filter || barKey(it) === filter), rowH = 54;
  if (!items.length) { T(W / 2, y + 20, t('noneT'), 18, '#8a7a8a', 0.5); y += 44; }
  items.forEach((it) => {
    const boss = it.src === 'boss', yy = y + rowH / 2;
    const row = drag(sc.tip.attach(put(sc.add.rectangle(W / 2, yy, W - 24, rowH - 4, 0xffffff, 0.001).setData('row', true)), it));
    if (it.cursed) put(sc.add.rectangle(W / 2, yy, W - 24, rowH - 6, 0x3a0a4a, 0.55));
    put(sc.add.rectangle(36, yy, 40, 40, itemCol(it), 0.3).setStrokeStyle(2, RARITY[it.rarity].col));
    const ic = put(sc.add.image(36, yy, 'icons', it.frame).setScale(1.05)); if (it.cursed && it.kind === 'weapon') ic.setTint(0xb070ff);
    const nm = T(64, yy - 12, it.name, 18, it.cursed ? '#d9a6ff' : RARITY[it.rarity].css); clipText(nm, boss ? W - 136 : W - 84);
    const rt = T(64, yy + 12, ruleText(it), 16, ruleCol(it)); fitText(rt, W - 84, 16);
    if (boss) { const b = T(W - 18, yy - 12, t('bossBadge'), 15, '#ffffff', 1); b.setBackgroundColor('#a8281e').setPadding(4, 1, 4, 1).setStroke('#000', 0); }
    y += rowH;
  });
  y += 12; sc.pageH = y;
  // header (on top of the scrolling content) + close button
  add(sc.add.rectangle(0, 0, W, TOP - 4, 0x07040c, 1).setOrigin(0).setDepth(D + 2).setInteractive());
  add(panel(sc, 6, 6, W - 12, TOP - 14, { border: 0xffcf40, alpha: 0.95 }).setDepth(D + 2));
  add(txt(sc, W / 2 - 22, TOP / 2 - 3, t('pageT'), 22, '#ffd36a', { strokeThickness: 5, maxW: W - 120 }).setDepth(D + 3));
  const cb = add(sc.add.circle(W - 36, TOP / 2 - 3, 22, 0x8a1c10).setStrokeStyle(3, 0xffd36a).setDepth(D + 3).setInteractive({ useHandCursor: true }));
  const xg = add(sc.add.graphics().setDepth(D + 4)); xg.lineStyle(5, 0xfff4c8); xg.lineBetween(W - 46, TOP / 2 - 13, W - 26, TOP / 2 + 7); xg.lineBetween(W - 26, TOP / 2 - 13, W - 46, TOP / 2 + 7);
  cb.on('pointerdown', () => { sfx(sc, 'click'); closeStats(sc); });
  sc.pageView = H - TOP - 6; sc.pageTop = TOP; sc.pageScroll = 0;
  pageScrollTo(sc, keepScroll ? oldY : filter ? gearTop : 0);
  window.DC.page = { filter, rows: items.length, gearTop, h: y, close: { x: W - 36, y: TOP / 2 - 3 } };
}
function pageScrollTo(sc, v) {
  if (!sc.pageC) return; const max = Math.max(0, sc.pageH - sc.pageView);
  sc.pageScroll = Phaser.Math.Clamp(v, 0, max); sc.pageC.y = sc.pageTop - sc.pageScroll;
  if (window.DC.page) window.DC.page.scroll = sc.pageScroll;
}
const UI = {
  drawPower() { this.setupGearInput(); this.powV = this.pw(); this.drawStats(); this.setPower(this.powV, false); },
  drawStats() { drawHud(this); drawBar(this); },
  drawGems() { this.drawStats(); },
  setPower(v, anim = true) {
    if (!this.powN || !this.powN.active) this.drawStats();
    const cursed = curses(this.G).length > 0, col = cursed ? '#ff5a5a' : '#ffd36a', from = this.powShown || 0, up = v > from * 1.0001;
    this.powV = v; this.powN.setColor(col); window.DC.power = v; window.DC.powerHud = { text: this.powN.text };
    if (!anim) { this.powShown = v; setFit(this.powN, fmt(v)); return; }
    const c = { v: from };
    this.tweens.add({ targets: c, v, duration: 650, ease: 'Cubic.out', onUpdate: () => { if (this.powN.active) setFit(this.powN, fmt(c.v)); }, onComplete: () => {
      this.powShown = v; if (!this.powN.active) return; setFit(this.powN, fmt(v)); window.DC.powerHud = { text: this.powN.text };
      bump(this, this.powN, up ? 1.3 : 0.85);
      if (up) { const b = burst(this, this.powPos.x, this.powPos.y, 0xffcf40, 18, 200, 'px').setDepth(75); hudAdd(this, b); sfx(this, 'tick', 0.6); }
    } });
  },
  openGear(filter = null) { openStats(this, filter); },
  closeGear() { closeStats(this); },
  setupGearInput() {
    this.input.on('pointermove', (p) => { const d = this.pageDrag; if (!d || !p.isDown || !this.pageC) return; const dy = p.y - d.y; if (Math.abs(dy) > 6) d.moved = true; if (d.moved) { if (this.tip && this.tip.visible) this.tip.hide(true); pageScrollTo(this, d.s0 - dy); } });
    this.input.on('pointerup', () => { this.time.delayedCall(0, () => { this.pageDrag = null; }); });
    this.input.on('wheel', (p, over, dx, dy) => { if (this.gearOpen) pageScrollTo(this, this.pageScroll + dy * 0.6); });
  },
};
// fly an item icon into its bottom-bar slot (optional label above it), bump the slot
function flyToBar(sc, it, from, label, labelCss, done) {
  const k = barKey(it), to = (sc.barPos || {})[k] || { x: W / 2, y: BAR_Y + 30 };
  const fly = hudAdd(sc, sc.add.image(from.x, from.y, 'icons', it.frame).setScale(from.s || 2.4).setDepth(76)); if (it.cursed) fly.setTint(0xb070ff);
  if (label) { const lab = hudAdd(sc, txt(sc, from.x, from.y - 52, label, 22, labelCss || '#ff9a8a', { strokeThickness: 6, stroke: '#2a0404', maxW: W - 40 }).setDepth(77)); popText(sc, lab, 1);
    sc.tweens.add({ targets: lab, x: Phaser.Math.Clamp(to.x, 90, W - 90), y: to.y - 50, delay: 250, duration: 520, ease: 'Quad.in', onComplete: () => sc.tweens.add({ targets: lab, alpha: 0, delay: 500, duration: 300, onComplete: () => lab.destroy() }) }); }
  sc.tweens.add({ targets: fly, x: to.x, y: to.y, scale: 1.05, duration: 560, delay: label ? 250 : 0, ease: 'Quad.in', onComplete: () => {
    fly.destroy(); hudAdd(sc, burst(sc, to.x, to.y, it.src === 'boss' ? 0xff6a5a : 0xffe08a, 16, 170, 'px').setDepth(77)); sfx(sc, 'tick', 0.6);
    sc.drawStats(); bumpBar(sc, k); window.DC.barBump = (window.DC.barBump || []).concat(k); if (done) done();
  } });
}
// boss info box under the HUD: name (+ BIG BOSS), HP bar with number (+ trailing ghost), next boss
function bossBox(sc, s, hp, opts = {}) {
  ensureHud(sc);
  const c = bossFor(s), big = isBig(s), y = BOSS_Y, D = 60, o = [], add = (q) => { o.push(hudAdd(sc, q).setDepth(D)); return q; };
  add(panel(sc, 6, y, W - 12, 76, { border: big ? 0xff5a4a : undefined, alpha: 0.9 }));
  if (big) { const bb = add(txt(sc, 62, y + 18, t('bigBoss'), 16, '#ff6a5a', { strokeThickness: 5, stroke: '#2a0404', maxW: 100 })); sc.tweens.add({ targets: bb, scale: 1.1, yoyo: true, repeat: -1, duration: 420 }); }
  add(txt(sc, W / 2 + (big ? 30 : 0), y + 18, bossName(s), 20, c.col, { strokeThickness: 5, maxW: big ? W - 150 : W - 40 }));
  add(sc.add.rectangle(W / 2, y + 44, HPW + 6, 26, 0x220000).setStrokeStyle(3, hasCurse(sc.G, 'hpUp') ? 0xff5a3a : 0xffd36a));
  const ghost = add(sc.add.rectangle(HPX, y + 44, HPW, 20, 0xffd8a0).setOrigin(0, 0.5));
  const bar = add(sc.add.rectangle(HPX, y + 44, HPW, 20, 0xd22a2a).setOrigin(0, 0.5));
  const ht = add(txt(sc, W / 2, y + 44, opts.text || `HP ${fmt(hp)}`, 18, '#ffffff', { strokeThickness: 4, maxW: HPW - 10 }));
  o.push(...nextBossLine(sc, W / 2, y + 66, s, 16, D).map((q) => hudAdd(sc, q)));
  return { objs: o, bar, ghost, ht };
}

class Boot extends Phaser.Scene {
  constructor() { super('boot'); }
  preload() {
    const bar = this.add.rectangle(W / 2 - 200, H / 2, 4, 20, 0xffd36a).setOrigin(0, 0.5);
    this.load.on('progress', (p) => bar.width = 400 * p);
    const I = 'assets/img/', A = 'assets/audio/';
    ['chest_Fire', 'chest_Ice', 'chest_Thunder', 'chest_black', 'open_Fire', 'open_Ice', 'open_Thunder', 'open_black', 'bg_hoard', 'bg_lava'].forEach((k) => this.load.image(k, I + k + '.png'));
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
    backdrop(this, 'bg_lava', 0.2, 700);
    shadow(this, W / 2 + 70, 700, 220); shadow(this, 70, 700, 70);
    this.add.sprite(W / 2 + 40, 700, 'dragon_idle').setScale(2.4).setOrigin(0.5, 1).play('dragon-idle');
    heroGlow(this.add.sprite(70, 700, 'hero_idle').setScale(2.6).setOrigin(0.5, 1).play('hero-idle'));
    // title + the rules (wrapped, never shrunk below readable size)
    const t0 = txt(this, W / 2, 128, t('title'), 54, '#ffd36a', { strokeThickness: 10, maxW: W - 40 });
    const r1 = txtW(this, W / 2, 0, t('sub1'), 22, '#ffffff', W - 70), r2 = txtW(this, W / 2, 0, t('sub2'), 18, '#ff9a7a', W - 70);
    const r3 = txtW(this, W / 2, 0, t('sub3'), 18, '#ffe27a', W - 70);   // how a strike works: hero first, then every weapon once
    const r4 = txtW(this, W / 2, 0, t('sub4'), 18, '#9affd8', W - 70);   // overkill rewards: bonus chest at x3+, rarer with more, accessories -> permanent
    r1.y = 172; r3.y = r1.y + r1.height + 8; r4.y = r3.y + r3.height + 8; r2.y = r4.y + r4.height + 8;
    const bot = r2.y + r2.height + 16; const pg = panel(this, 16, 82, W - 32, bot - 82); pg.setDepth(-1); [t0, r1, r2, r3, r4].forEach((o) => o.setDepth(1));
    window.DC.titleOk = r4.text; window.DC.titleBot = bot;
    window.DC.titleRules = r3.text;
    const best = loadBest();
    if (best.stage) txt(this, W / 2, bot + 26, t('titleBest', best.stage, fmt(best.hit)), 18, '#b8f0a0', { strokeThickness: 5, maxW: W - 30 });
    const tap = txt(this, W / 2, 770, t('tapStart'), 30, '#fff2c0', { maxW: W - 40 });
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
    const c = this.add.container(W - 88, 38).setDepth(100);
    const g = this.add.graphics();
    g.fillStyle(0x140a18, 0.9); g.fillRoundedRect(-78, -22, 156, 44, 10); g.lineStyle(2, 0xd9a441, 1); g.strokeRoundedRect(-78, -22, 156, 44, 10);
    const label = txt(this, 0, 0, `◀ ${LANG_NAME[LANG]} ▶`, 18, '#fff2c0', { strokeThickness: 4, maxW: 146 });
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
  init(d) { this.run = d.run; this.s = this.run.s; this.G = this.run.G; this.locked = true; this.done = false; this.canSkip = false; this.autoNext = null; this.dim = null; this.inv = [];
    this.statsHidden = false; this.statsLocked = false; this.gearOpen = false; this.gearPinned = false; this.peekT = null; this.drag = null; this.hoverPow = false; this.hoverPop = false; this.uiCam = null; }
  get items() { return gearList(this.G); }
  pw() { return expStrike(this.G, bossEl(this.s), this.s); }
  create() {
    const s = this.s;
    window.DC.phase = 'pick'; window.DC.stage = s + 1; window.DC.gearPeek = false; window.DC.reveal = null; window.DC.pickReady = false; window.DC.missed = null; window.DC.event = null;
    this.tweens.timeScale = 1; this.time.timeScale = 1;
    fadeInMain(this);
    backdrop(this, 'bg_hoard', 0.45);
    const big = isBig(s), c = bossFor(s);
    this.B = bossEl(s);
    window.DC.roundText = t('stageN', s + 1);
    this.tip = new Tooltip(this, () => this.items);
    const bx = bossBox(this, s, stageHp(s, this.G)); this.hpT = bx.ht;
    // the boss waits at the bottom right, the hero bottom left (the arena below the chests)
    const sc0 = Math.min(c.scale, 170 / c.fw, 150 / c.fh), bxp = W - 24 - c.fw * sc0 / 2;
    shadow(this, bxp, PICK_GROUND, Math.max(60, c.body[1] * sc0)); const bs = this.add.sprite(bxp, PICK_GROUND, c.tex).setScale(sc0).setOrigin(0.5, 1).play(c.anim); if (c.tint) bs.setTint(c.tint);
    this.prompt = txt(this, W / 2, 246, t('pickOne'), 30, '#ffffff', { strokeThickness: 7, maxW: W - 40 }).setAlpha(0);
    this.drawPower();
    this.offer = rollOffer(Math.random, s);
    if (window.DC.forceHq) this.offer.forEach((o, i) => { if (o.type === 'normal') o.hq = window.DC.forceHq.includes(i); });   // test hook
    if (window.DC.forceKind0 !== undefined) { const fk = window.DC.forceKind0; window.DC.forceKind0 = undefined; this.offer.forEach((o, i) => { delete o.kind; if (fk && i === fk.i) { o.type = 'normal'; o.kind = fk.kind; if (fk.hq !== undefined) o.hq = fk.hq; } }); }   // test hook
    window.DC.offer = this.offer.map((o) => (o.type === 'dark' ? 'dark:' + o.element : o.element) + (o.hq ? '+hq' : '') + (o.kind ? '+' + o.kind : ''));
    window.DC.hints = () => this.offer.map((o) => o.hint || null);
    const xs = CHEST_X, base = CHEST_BASE, CW = 138;
    window.DC.chestXY = xs.map((x) => [x, base - 70]);
    this.chests = this.offer.map((c, i) => {
      const x = xs[i];
      shadow(this, x, base, 120);
      const glow = this.add.circle(x, base - 66, 74, EL_COLOR[c.element], 0.16).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: glow, scale: 1.1, alpha: 0.26, yoyo: true, repeat: -1, duration: 900 + i * 120 });
      const dark = c.type === 'dark';
      const spr = this.add.image(x, base + 10, 'chest_' + chestKey(c)).setScale(CHEST_SC).setOrigin(0.5, 1);
      const gem = this.add.image(x, base - 196, 'el_' + c.element).setScale(3);
      this.tweens.add({ targets: gem, y: base - 202, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.inOut' });
      const label = txt(this, x, base + 26, dark ? t('darkChest') : t('chestEl', elName(c.element)), 20, dark ? '#c9a6ff' : EL_CSS[c.element], { maxW: CW });
      // build hint ("Unlocks Melt!", "Ice Lv2!") wrapped under the name; a DARK chest also names its element + warns
      const hint = chestHint(this.G, c.element);
      const el = txtW(this, x, base + 40, (dark ? elName(c.element) + (hint ? ' · ' : '') : '') + (hint ? hint.text : ''), 16, hint ? (hint.combo ? '#7aff8a' : '#ffe27a') : EL_CSS[c.element], CW);
      if (hint) this.tweens.add({ targets: el, alpha: 0.6, yoyo: true, repeat: -1, duration: 520, ease: 'Sine.inOut' });
      c.hint = hint && hint.text;
      if (dark) { const bh = txtW(this, x, base + 44 + el.height, t('darkHint'), 16, '#d9a6ff', CW); el.on('destroy', () => bh.destroy()); this.tweens.add({ targets: bh, alpha: 0.55, yoyo: true, repeat: -1, duration: 700 }); }
      const zone = this.add.zone(x, base - 90, CW, 270).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.choose(i));
      zone.on('pointerover', () => { if (this.locked) return; this.tweens.add({ targets: spr, scale: CHEST_SC * 1.08, duration: 120 }); glow.setAlpha(0.45); });
      zone.on('pointerout', () => { if (this.locked) return; this.tweens.add({ targets: spr, scale: CHEST_SC, duration: 120 }); glow.setAlpha(0.2); });
      // HIGH QUALITY: better rarity odds (not a guarantee) -> golden shimmer + a gold tag above the chest
      let hqO = [];
      if (c.hq) {
        const rays = this.add.graphics().setPosition(x, base - 60).setBlendMode(Phaser.BlendModes.ADD);
        for (let k = 0; k < 10; k++) { const a0 = k * Math.PI / 5; rays.fillStyle(0xffe27a, 0.13); rays.slice(0, 0, 105, a0 - 0.13, a0 + 0.13); rays.fillPath(); }
        rays.setDepth(0.2); this.tweens.add({ targets: rays, angle: 360, repeat: -1, duration: 9000 });
        this.tweens.add({ targets: rays, alpha: 0.55, yoyo: true, repeat: -1, duration: 800, ease: 'Sine.inOut' });
        const halo = this.add.circle(x, base - 60, 66, 0xffd84a, 0.18).setBlendMode(Phaser.BlendModes.ADD).setDepth(0.2);
        this.tweens.add({ targets: halo, scale: 1.18, alpha: 0.3, yoyo: true, repeat: -1, duration: 650, ease: 'Sine.inOut' });
        const shine = this.add.image(x, base + 10, 'chest_' + chestKey(c)).setScale(CHEST_SC).setOrigin(0.5, 1).setTintFill(0xfff4c0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
        this.tweens.add({ targets: shine, alpha: 0.28, yoyo: true, repeat: -1, duration: 520, repeatDelay: 900, ease: 'Sine.inOut' });
        const gs = this.add.particles(x, base - 60, 'px', { x: { min: -66, max: 66 }, y: { min: -70, max: 50 }, lifespan: 700, speedY: { min: -40, max: -12 }, scale: { start: 2.2, end: 0 }, frequency: 70, tint: [0xffe27a, 0xffffff, 0xffc040], blendMode: 'ADD' });
        let tag = txt(this, x, base - 160, t('hqTag'), 16, '#ffe27a', { strokeThickness: 5, stroke: '#4a2a00', maxW: CW - 14 });
        if (parseFloat(tag.style.fontSize) < 16) { tag.destroy(); tag = txtW(this, x, 0, t('hqTag'), 16, '#ffe27a', CW - 14, { strokeThickness: 5, stroke: '#4a2a00' }); tag.setOrigin(0.5); tag.y = base - 156; }
        const pill = this.add.rectangle(x, tag.y, Math.min(CW, tag.displayWidth + 20), Math.max(28, tag.height + 6), 0x3a2200, 0.9).setStrokeStyle(2, 0xffd84a);
        window.DC.hqTag = { size: parseFloat(tag.style.fontSize), lines: tag.text.split('\n').length };
        tag.setDepth(2); pill.setDepth(1.9);
        this.tweens.add({ targets: [tag, pill], scale: 1.07, yoyo: true, repeat: -1, duration: 600, ease: 'Sine.inOut' });
        spr.setDepth(0.5); shine.setDepth(0.6);
        hqO = [rays, halo, shine, gs, tag, pill];
      }
      // TYPE TAG: a teal sticker on the chest front with the promised item type (+ its icon); rarity stays random
      if (c.kind) {
        const fr = ICONS[c.kind][c.element][0][0], ky = base - 40;
        const kt = txtW(this, x + 10, 0, t('kindTag')[c.kind], 16, '#b8fff0', CW - 34, { stroke: '#022a24' }); kt.y = ky - kt.height / 2;
        const kh = Math.max(34, kt.height + 8), kp = this.add.rectangle(x, ky, CW - 4, kh, 0x063a34, 0.94).setStrokeStyle(3, 0x5affd8);
        const kg = this.add.rectangle(x, ky, CW + 4, kh + 8, 0x5affd8, 0).setStrokeStyle(2, 0x5affd8, 0.6);
        const ki = this.add.image(x - CW / 2 + 16, ky, 'icons', fr).setScale(0.75);
        kg.setDepth(2.4); kp.setDepth(2.5); ki.setDepth(2.6); kt.setDepth(2.6);
        this.tweens.add({ targets: kg, scaleX: 1.08, scaleY: 1.3, alpha: { from: 0.9, to: 0 }, repeat: -1, duration: 1100, ease: 'Quad.out' });
        this.tweens.add({ targets: ki, angle: { from: -10, to: 10 }, yoyo: true, repeat: -1, duration: 500, ease: 'Sine.inOut' });
        hqO = hqO.concat([kg, kp, ki, kt]);
        window.DC.kindTagPos = { x, y: ky, kind: c.kind, i };
      }
      const sp = this.add.particles(x, base - 70, 'px', { x: { min: -46, max: 46 }, y: { min: -40, max: 30 }, lifespan: 900, speedY: { min: -30, max: -10 }, scale: { start: 1.5, end: 0 }, frequency: 260, tint: EL_COLOR[c.element], blendMode: 'ADD' });
      // drop in from above with a bounce; the rest of the chest UI fades in when it lands
      spr.y = -120 - i * 60; [glow, gem, label, el].forEach((o) => o.setAlpha(0)); sp.stop(); hqO.forEach((o) => o.setVisible(false));
      this.tweens.add({ targets: spr, y: base + 10, duration: 460, delay: 80 + i * 80, ease: 'Bounce.out', onComplete: () => {
        sfx(this, 'open', 0.25); burst(this, x, base, 0xffe0a0, 8, 160, 'px'); sp.start();
        this.tweens.add({ targets: [gem, label, el], alpha: 1, duration: 160 }); glow.setAlpha(0.16);
        hqO.forEach((o) => o.setVisible(true));
        if (hqO.length) sfx(this, 'open', 0.18);
      } });
      return { c, x, y: base - 80, spr, glow, gem, label, el, zone, sp, hqO };
    });
    sfx(this, 'banner', 0.3);
    this.time.delayedCall(560, () => {
      this.locked = false; window.DC.pickReady = true;
      this.prompt.setAlpha(1); popText(this, this.prompt, 1);
      this.tweens.add({ targets: this.prompt, y: 240, yoyo: true, repeat: -1, duration: 420, ease: 'Sine.inOut' });
    });
    this.input.on('pointerdown', (p, over) => { if (this.canSkip && !this.gearOpen && this.time.now - (this.pageClosedAt || -1e9) > 350 && !over.some((o) => o.getData && o.getData('item'))) this.next(); });
  }
  // the hero waits bottom-left; HUD (POWER, elements, combos) on top, gear counts at the bottom
  drawPower() {
    this.hShadow = shadow(this, 64, PICK_GROUND - 2, 70);
    this.heroS = this.add.sprite(64, PICK_GROUND, 'hero_idle').setScale(2.2).setOrigin(0.5, 1).play('hero-idle'); heroGlow(this.heroS);
    UI.drawPower.call(this);
  }
  forcedItem(ch) { // test hook: DC.force = a rarity name (+ DC.forceKind) | 'CURSED' | 'GEM'
    const f = window.DC.force; if (!f) return null; window.DC.force = null;
    const rng = Math.random;
    if (f === 'CURSED') { // DC.forceCurse = 'drain' | 'critDown' | 'seal' | 'weak' | 'hpUp'
      const want = window.DC.forceCurse; window.DC.forceCurse = null;
      for (let k = 0; k < 400; k++) { const c = mkCurse(ch.c.element, this.s, rng); if (!want || c.curse === want) return c; }
    }
    if (f === 'GEM') { const it = openChest({ type: 'normal', element: ch.c.element }, rng, this.s); it.gem = 1; return it; }
    const r = RANKS.indexOf(f); if (r < 0) return null;
    const kind = window.DC.forceKind; window.DC.forceKind = null;
    return kind && kind !== 'weapon' ? mkGear(kind, ch.c.element, r, this.s, rng) : mkWeapon(ch.c.element, r, this.s, rng);
  }
  choose(i) {
    if (this.locked) return; this.locked = true;
    if (this.gearOpen) this.closeGear();
    const ch = this.chests[i];
    this.tweens.killTweensOf(this.prompt); this.tweens.add({ targets: this.prompt, alpha: 0, duration: 150 });
    window.DC.missed = [];
    this.chests.forEach((o, j) => { o.zone.disableInteractive(); o.sp.stop(); (o.hqO || []).forEach((q) => { this.tweens.killTweensOf(q); if (q.type === 'ParticleEmitter') q.stop(); this.tweens.add({ targets: q, alpha: 0, duration: 200 }); }); if (j !== i) this.reject(o); });
    window.DC.pickedHq = !!ch.c.hq;
    sfx(this, 'click');
    const raw = this.forcedItem(ch) || openChest(ch.c, Math.random, this.s, this.G);
    const it = nameItem(raw); window.DC.pickedKind = { tag: ch.c.kind || null, got: it.kind };
    const tier = it.rarity, R = RARITY[tier], big = BIG_R[tier], leg = LEG_R[tier];
    window.DC.reveal = { rarity: tier, stage: 'anticipation' };
    this.tweens.killTweensOf([ch.spr, ch.glow]); ch.spr.setScale(CHEST_SC).setDepth(11); ch.glow.setDepth(11);
    // colour hint: the chest glow shifts to the rarity colour while it charges
    const hint = tier === 'COMMON' ? EL_COLOR[ch.c.element] : R.col;
    ch.glow.setAlpha(0);
    ch.soft = this.add.image(ch.x, ch.y + 10, 'glowdot').setTint(hint).setBlendMode(Phaser.BlendModes.ADD).setDepth(11).setScale(big ? 2.25 : 1.75).setAlpha(0.5);
    this.tweens.add({ targets: ch.soft, scale: big ? 3 : 2, alpha: big ? 0.95 : 0.7, yoyo: true, repeat: -1, duration: big ? 170 : 260 });
    const dur = { COMMON: 300, UNCOMMON: 380, RARE: 480, EPIC: 900, LEGENDARY: 1300, MYTHIC: 1450, CURSED: 700 }[tier];
    if (big) { this.dimIn(leg ? 0.62 : 0.5); sfx(this, 'charge', leg ? 0.9 : 0.7); }
    // light leaking from the lid seam, growing with the charge
    const leaks = [];
    const nLeak = { COMMON: 0, UNCOMMON: 2, RARE: 3, EPIC: 5, LEGENDARY: 7, MYTHIC: 9, CURSED: 4 }[tier];
    for (let k = 0; k < nLeak; k++) {
      const a = -70 + (140 / Math.max(1, nLeak - 1)) * k + Phaser.Math.Between(-6, 6);
      const l = this.add.image(ch.x + Phaser.Math.Between(-40, 40), ch.y + 20, 'beam').setOrigin(0.5, 1).setAngle(a).setTint(hint)
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(12).setScale(0.25, 0).setAlpha(0.9);
      this.tweens.add({ targets: l, scaleY: { from: 0, to: big ? 1.1 : 0.6 }, duration: dur, delay: k * (dur / nLeak / 2), ease: 'Quad.in' });
      leaks.push(l);
    }
    // shake harder and harder
    const t0 = this.time.now, amp = { COMMON: 5, UNCOMMON: 5, RARE: 6, EPIC: 9, LEGENDARY: 13, MYTHIC: 15, CURSED: 8 }[tier];
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
    const mr = openChest(o.c, Math.random, this.s), miss = nameItem(mr);
    window.DC.missed.push({ name: miss.name, rule: ruleText(miss), rarity: miss.rarity });
    this.tweens.killTweensOf([o.spr, o.glow, o.gem]);
    this.tweens.add({ targets: [o.glow, o.gem], alpha: 0, duration: 150 });
    this.time.delayedCall(110, () => {
      o.spr.setTexture('open_' + chestKey(o.c)).setTint(0x6a6a6a);
      this.tweens.add({ targets: o.spr, angle: { from: -6, to: 0 }, duration: 160 });
      const ic = this.add.image(o.x, o.y + 10, 'icons', miss.frame).setScale(1.2).setTint(0x8a8a8a).setAlpha(0.9).setDepth(5);
      this.tweens.add({ targets: [o.label, o.el], alpha: 0, duration: 120 });
      const ms = txt(this, o.x, CHEST_BASE + 26, t('missed'), 16, '#a89ab8', { strokeThickness: 4, maxW: 136 }).setDepth(5).setAlpha(0);
      const rt = txtW(this, o.x, CHEST_BASE + 40, ruleText(miss), 16, '#b8b0c0', 136).setDepth(5).setAlpha(0);
      this.tweens.add({ targets: ic, y: o.y - 60, scale: 2, duration: 260, ease: 'Back.out' });
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
    const pre = stats(this.G.items), ev = equip(this.G, it, this.s);
    this.ups = buildUps(pre, stats(this.G.items));   // level-ups / combo unlocks -> big banner once the item lands
    const tier = it.rarity, R = RARITY[tier], big = BIG_R[tier], leg = LEG_R[tier];
    const lite = this.scale.displaySize.width < 700 ? 0.6 : 1; // fewer particles on small screens
    const N = (n) => Math.max(4, Math.round(n * lite));
    const cam = this.cameras.main;
    window.DC.reveal = { rarity: tier, stage: 'pop' };
    ch.spr.setTexture('open_' + chestKey(ch.c));
    this.tweens.killTweensOf(ch.soft); ch.soft.setScale(big ? 4 : 2.5).setAlpha(1); this.tweens.add({ targets: ch.soft, scale: big ? 2.75 : 2, alpha: 0.55, duration: 900, ease: 'Quad.out' });
    const iy = ch.y - (big ? 130 : 120), D = 13;
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
      const coins = this.add.particles(0, -20, 'coin', { x: { min: 10, max: W - 10 }, lifespan: 2200, speedY: { min: 120, max: 260 }, speedX: { min: -40, max: 40 }, gravityY: 260, rotate: { min: 0, max: 360 }, scale: { min: 1.4, max: 2.2 }, frequency: 28 / lite, quantity: 1 }).setDepth(D + 3);
      const conf = this.add.particles(0, -20, 'conf', { x: { min: 10, max: W - 10 }, lifespan: 2600, speedY: { min: 80, max: 200 }, speedX: { min: -80, max: 80 }, gravityY: 140, rotate: { start: 0, end: 720 }, scale: { min: 1.5, max: 2.5 }, tint: cols, frequency: 22 / lite, quantity: 1 }).setDepth(D + 3);
      this.time.delayedCall(1700, () => { coins.stop(); conf.stop(); });
      this.time.delayedCall(4600, () => { coins.destroy(); conf.destroy(); });
    }
    // sound
    sfx(this, 'open');
    if (leg) { sfx(this, 'legendary', 0.95); sfx(this, 'rare', 0.6); }
    else if (tier === 'EPIC') { sfx(this, 'epic', 0.85); sfx(this, 'rare', 0.45); }
    else sfx(this, it.cursed ? 'curse' : tier === 'COMMON' ? 'open' : 'rare', tier === 'COMMON' ? 0.4 : 0.7);
    // item rises with glow and a bounce
    const icon = this.tip.attach(this.add.image(ch.x, ch.y, 'icons', it.frame).setScale(1).setDepth(D + 4), it);
    if (it.cursed && it.kind === 'weapon') icon.setTint(0xb070ff);
    if (tier !== 'COMMON') { try { if (icon.preFX) icon.preFX.addGlow(R.col, big ? 6 : 3, 0, false, 0.1, 12); } catch (e) {} }
    const sc = leg ? 4 : big ? 3.6 : 3;
    this.tweens.add({ targets: icon, y: iy, scale: sc, duration: big ? 520 : 450, ease: 'Back.out', onComplete: () => {
      if (big) this.tweens.add({ targets: icon, y: iy - 8, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.inOut' });
    } });
    // rarity banner with a shine sweep
    if (big) {
      this.time.delayedCall(leg ? 260 : 200, () => {
        const label = tier === 'MYTHIC' ? t('banMyth') : leg ? t('banLeg') : t('banEpic'), size = 46;
        const ban = txt(this, W / 2, ch.y + 70, label, size, R.css, { strokeThickness: 10, stroke: leg ? '#4a2400' : '#2a0a40', maxW: W - 24 }).setDepth(D + 5);
        try { if (ban.preFX) { ban.preFX.addShine(leg ? 0.9 : 0.7, 0.35, 4); ban.preFX.addGlow(R.col, 4, 0, false, 0.1, 10); } } catch (e) {}
        popText(this, ban, 1); sfx(this, 'banner', 0.7);
        this.tweens.add({ targets: ban, angle: { from: -4, to: 4 }, yoyo: true, repeat: -1, duration: 500, ease: 'Sine.inOut' });
        window.DC.reveal = { rarity: tier, stage: 'banner' };
      });
      this.dimOut(leg ? 1900 : 1400);
    }
    // item card with the item's own damage rule
    this.time.delayedCall(big ? (leg ? 700 : 560) : 0, () => {
      // item card (portrait: full width, below the chests; wraps instead of shrinking)
      const CWd = W - 20, card = this.add.container(W / 2, CARD_Y).setDepth(20);
      const tag = txt(this, -CWd / 2 + 60, 0, t('rar')[tier], 16, R.css, { strokeThickness: 4, maxW: 108 });
      const t1 = txt(this, 54, 0, it.name, 22, it.cursed ? '#d9a6ff' : EL_CSS[it.element], { maxW: CWd - 140 });
      const t2 = txtW(this, 0, 0, ruleText(it), 22, ruleCol(it), CWd - 24);
      const t3 = txtW(this, 0, 0, ev.type === 'curse' ? `${evText(ev)}  ${t('curseNote')}` : it.kind === 'weapon' ? `${evText(ev)} · ${t('wNote')}` : `${evText(ev)} · ${t('noCrit')}`, 16, EV_CSS[ev.type], CWd - 24);
      const h = 14 + 26 + 6 + t2.height + 6 + t3.height + 12;
      tag.y = t1.y = -h / 2 + 14 + 13; t2.y = -h / 2 + 46; t3.y = t2.y + t2.height + 6;
      const pg = panel(this, -CWd / 2, -h / 2, CWd, h, { border: R.col });
      card.add([pg, tag, t1, t2, t3]); card.setAlpha(0); window.DC.cardBox = { y: CARD_Y - h / 2, h };
      if (it.greedy) { const gt = txt(this, 0, -h / 2 - 10, t('greedPop'), 16, '#ffd84a', { strokeThickness: 4, maxW: CWd - 40 }); gt.x = CWd / 2 - 12 - gt.width / 2; card.add(gt); window.DC.greedy = (window.DC.greedy || 0) + 1; }
      this.tweens.add({ targets: card, alpha: 1, duration: 150 }); popText(this, card, 1);
    });
    // the item flies into the GEAR panel; merge / upgrade / salvage / curse animate there
    this.time.delayedCall(big ? 650 : 280, () => this.gearEvent(ev, icon));
    // tap anywhere to skip once the reveal has landed
    setTimeout(() => { this.canSkip = true; if (window.DC.reveal) window.DC.reveal.skippable = true; }, big ? (leg ? 1000 : 750) : 350);
    this.autoNext = this.time.delayedCall(READ_MS + { COMMON: 1800, UNCOMMON: 1900, RARE: 2000, CURSED: 2100, EPIC: 2300, LEGENDARY: 2600, MYTHIC: 2800 }[tier] + (ev.purified.length ? 900 + 500 * ev.purified.length : 0) + (ev.gem ? 300 : 0), () => this.next(true));
  }
  // the found item flies into the hero's POWER box; the number rolls to the new expected damage, the gear list peeks open
  // with the new item sliding in at the top; a PURIFY GEM flies to its counter and cleanses the worst cursed item
  gearEvent(ev, icon) {
    window.DC.event = { type: ev.type, n: ev.n, gem: ev.gem, purified: ev.purified.map((p) => p.curse), curse: ev.item.curse || null };
    const it = ev.item, N = (n) => Math.max(4, Math.round(n * (this.scale.displaySize.width < 700 ? 0.6 : 1)));
    const col = EV_COL[ev.type];
    // the item flies down into its bottom-bar slot (count bumps); POWER rolls to the new expected damage
    const after = () => {
      this.hpT.setText(`HP ${fmt(stageHp(this.s, this.G))}`).setColor(hasCurse(this.G, 'hpUp') ? '#ffb0a0' : '#ffffff');
      this.setPower(this.pw()); this.drawStats();
    };
    flyToBar(this, it, { x: icon.x, y: icon.y, s: icon.scaleX * 0.8 }, null, null, () => {
      window.DC.gearPeek = true;
      const lab = hudAdd(this, txt(this, W / 2, BAR_Y - 30, evText(ev), 22, EV_CSS[ev.type], { strokeThickness: 6, maxW: W - 30 }).setDepth(41));
      popText(this, lab, 1); sfx(this, ev.type === 'curse' ? 'curse' : 'tick', 0.55);
      this.tweens.add({ targets: lab, y: lab.y - 30, alpha: 0, delay: 1100, duration: 400, onComplete: () => lab.destroy() });
      after();
      if (this.ups && this.ups.length) { buildBanner(this, this.ups); this.ups = null; }
      if (ev.gem) { // the gem pops out and flies to its bar counter
        const gp = (this.barPos || {}).gem || { x: W - 40, y: BAR_Y + 30 };
        const g = hudAdd(this, this.add.image(W / 2, CARD_Y - 120, 'gem').setScale(3).setDepth(42));
        const gl = hudAdd(this, txt(this, W / 2, CARD_Y - 170, t('evGem'), 22, EV_CSS.gem, { strokeThickness: 6, maxW: W - 30 }).setDepth(42));
        popText(this, gl, 1); sfx(this, 'rare', 0.6);
        this.tweens.add({ targets: gl, alpha: 0, y: gl.y - 24, delay: 1100, duration: 400, onComplete: () => gl.destroy() });
        this.tweens.add({ targets: g, x: gp.x, y: gp.y, scale: 1.4, duration: 520, delay: 200, ease: 'Quad.in', onComplete: () => { g.destroy(); hudAdd(this, burst(this, gp.x, gp.y, 0xd08aff, N(16), 160, 'px').setDepth(42)); bumpBar(this, 'gem'); } });
      }
      const cp = (this.barPos || {}).cursed || { x: W / 2, y: BAR_Y };
      ev.purified.forEach((p, k) => this.time.delayedCall((ev.gem ? 760 : 380) + k * 500, () => { purifyFx(this, p, Phaser.Math.Clamp(cp.x, 80, W - 80), cp.y - 70, 60); after(); bumpBar(this, 'cursed'); }));
    });
  }
  next(fromTimer) {
    if (this.done) return;
    if (fromTimer && ((this.tip && this.tip.visible) || this.gearOpen)) { this.autoNext = this.time.delayedCall(600, () => this.next(true)); return; } // let players read
    this.done = true; if (this.tip) this.tip.hide(true);
    this.tweens.timeScale = 1; this.time.timeScale = 1; this.tweens.resumeAll(); this.anims.resumeAll();
    if (this.autoNext) this.autoNext.remove();
    this.scene.start('strike', { run: this.run });
  }
}

// Stage card for stage 1 and every BIG BOSS: who is next, how much HP, gear carried over (auto-continues fast)
class Intro extends Phaser.Scene {
  constructor() { super('intro'); }
  init(d) { this.run = d.run; this.s = this.run.s; this.gone = false; this.uiCam = null; this.gearOpen = false; this.gearPinned = false; this.peekT = null; this.drag = null; this.statsHidden = false; this.statsLocked = false; }
  create() {
    const s = this.s, big = isBig(s), c = bossFor(s), G = this.run.G;
    window.DC.phase = 'intro'; window.DC.stage = s + 1;
    this.tweens.timeScale = 1; this.time.timeScale = 1;
    fadeInMain(this);
    backdrop(this, 'bg_lava', 0.55, 730);
    this.add.image(W / 2, H / 2, 'vig').setDisplaySize(W + 40, H + 40).setAlpha(0.9);
    const sc = Math.min(c.scale, 250 / c.fh, 360 / c.fw), bx = W / 2 + 40;
    shadow(this, bx + (c.body[0] - c.fw / 2) * sc, 730, c.body[1] * sc * 1.05);
    const boss = this.add.sprite(bx + 200, 730, c.tex).setScale(sc).setOrigin(0.5, 1).play(c.anim).setAlpha(0);
    if (c.tint) boss.setTint(c.tint);
    this.tweens.add({ targets: boss, x: bx, alpha: 1, duration: 480, ease: 'Back.out' });
    try { if (boss.preFX) boss.preFX.addGlow(Phaser.Display.Color.HexStringToColor(c.col).color, 2, 0, false, 0.1, 8); } catch (e) {}
    if (big) {
      const bb = txt(this, W / 2, 176, t('bigBoss'), 32, '#ff5a4a', { strokeThickness: 8, stroke: '#2a0404', maxW: W - 40 });
      popText(this, bb, 1); this.tweens.add({ targets: bb, scale: 1.1, yoyo: true, repeat: -1, duration: 380, delay: 400 });
    }
    const t1 = txt(this, W / 2, 232, t('stageN', s + 1), 56, '#ffd36a', { strokeThickness: 10, maxW: W - 40 });
    popText(this, t1, 1);
    try { if (t1.preFX) t1.preFX.addShine(0.8, 0.3, 4); } catch (e) {}
    const t2 = txt(this, W / 2, 294, bossName(s), 32, c.col, { strokeThickness: 7, maxW: W - 30 }); t2.setAlpha(0);
    this.tweens.add({ targets: t2, alpha: 1, x: { from: W / 2 - 60, to: W / 2 }, duration: 380, delay: 200, ease: 'Quad.out' });
    const t3 = txt(this, W / 2, 342, `HP ${fmt(stageHp(s, G))}`, 32, '#ff5a4a', { maxW: W - 40 }); t3.setAlpha(0);
    this.tweens.add({ targets: t3, alpha: 1, duration: 300, delay: 420 });
    const il = txtW(this, W / 2, 374, t('introLine'), 20, '#ffffff', W - 50);
    // same HUD as every other screen: hero + POWER + element chips on top (tap = STATS + GEAR page), gear counts at the bottom
    this.G = G; this.tip = new Tooltip(this, () => gearList(G)); this.seenN = G.seenN = G.items.length;
    this.drawPower();
    const n = gearList(G).length;
    txtW(this, W / 2, il.y + il.height + 10, n ? t('gearLine', n) : t('gear0'), 18, '#b8f0a0', W - 50);
    const tap = txt(this, W / 2, 762, t('tapCont'), 28, '#fff2c0', { maxW: W - 40 });
    this.tweens.add({ targets: tap, alpha: 0.35, yoyo: true, repeat: -1, duration: 600 });
    sfx(this, 'stage', 0.7); if (big) sfx(this, 'charge', 0.5);
    this.cameras.main.fadeIn(250, 0, 0, 0);
    this.time.delayedCall(400, () => this.input.on('pointerdown', (p, over) => { if (!this.gearOpen && this.time.now - (this.pageClosedAt || -1e9) > 350 && !over.some((o) => o.getData && o.getData('item') || o.__hud)) this.go(); }));
    this.time.delayedCall(s ? 2600 : 3600, () => this.go(true));
  }
  pw() { return expStrike(this.G, bossEl(this.s), this.s); }
  go(auto) {
    if (this.gone) return;
    if (auto && (this.gearOpen || (this.tip && this.tip.visible))) { this.time.delayedCall(800, () => this.go(true)); return; }   // reading the gear: wait
    this.gone = true;
    this.scene.start('pick', { run: this.run });
  }
}

class Strike extends Phaser.Scene {
  pw() { return expStrike(this.G, bossEl(this.s), this.s); }
  constructor() { super('strike'); }
  init(d) {
    this.statsHidden = false; this.statsLocked = false; this.gearOpen = false; this.gearPinned = false; this.peekT = null; this.drag = null; this.hoverPow = false; this.hoverPop = false; this.uiCam = null; this.execd = false; this.scShown = false; this.comboN = 0; this.rc = 0; this.recoilOn = false;
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
    if (window.DC.forceExec) { window.DC.forceExec = false; forceExecute(res); } // screenshot / debug only
    if (window.DC.forceOk) { const k = window.DC.forceOk * stageHp(s, this.G) / Math.max(1e-9, res.total); window.DC.forceOk = null;   // test only: scale the strike to an overkill ratio
      res.hits.forEach((h) => { h.v *= k; h.cv *= k; }); res.hit *= k; res.boom *= k; res.burn *= k; res.ticks = res.ticks.map((x) => x * k); res.total *= k; res.kill = true; res.executed = false; }
    res.ratio = res.total / this.hpMax; res.L = res.executed ? 1 : okLevel(res.total, this.hpMax); res.hp = this.hpMax;
    window.DC.result = { total: res.total, hp: this.hpMax, L: res.L, ratio: res.ratio, hits: res.hits.length, crits: res.crits, chained: res.chained, drains: res.hits.filter((h) => h.v < 0).length, weak: res.weak, vuln: res.S.vuln, burn: res.burn, ticks: res.ticks.length, off: res.off, power: expStrike(this.G, res.B, s), weaponCrits: res.hits.map((h) => (h.it ? h.it.crit : RULES.hero.crit)),
      combo: res.combo, echoes: res.echoes, boom: res.boom, executed: res.executed, kill: res.kill, melt: res.S.melt, superconduct: res.S.superconduct, overload: res.S.overload, execLine: res.S.execute };
    this.tip = new Tooltip(this, () => this.items);
    const c = this.cfg;
    this.bShadow = shadow(this, c.x, LAVA_GROUND, c.body[1] * c.scale * 1.05);
    this.hShadow = shadow(this, HERO_X, LAVA_GROUND, 90);
    this.boss = this.add.sprite(c.x, LAVA_GROUND, c.tex).setScale(c.scale).setOrigin(0.5, 1).play(c.anim);
    this.untint();
    this.hero = this.add.sprite(HERO_X, LAVA_GROUND, 'hero_idle').setScale(3).setOrigin(0.5, 1).play('hero-idle');
    heroGlow(this.hero);
    // boss info box (UI camera: same spot while the main camera zooms / shakes)
    const bx = bossBox(this, s, this.hpMax, { text: `${fmt(this.hpMax)} / ${fmt(this.hpMax)}` });
    this.hp = bx.bar; this.hpGhost = bx.ghost; this.ghostHold = 0; this.hpText = bx.ht; this.bossHud = bx.objs;
    if (this.execL0 = executeLine(this.G)) { const ex = HPX + HPW * this.execL0; this.bossHud.push(hudAdd(this, this.add.rectangle(ex, BOSS_Y + 44, 3, 30, 0xff4a8a).setDepth(61))); }   // EXECUTE line marker
    this.dbObjs = [];
    // the HUD + bottom gear bar stay usable until STRIKE is pressed (tap = STATS + GEAR page)
    this.seenN = this.G.seenN = this.G.items.length;
    this.drawPower();
    this.ready = txtW(this, W / 2, 252, t('ready', this.items.length), 22, '#ffffff', W - 60);
    this.btn = button(this, W / 2, 752, t('strike'), () => this.strike(), 240);
    window.DC.phase = 'strike-ready';
  }
  // camera shake budget: crits share one rate limit (~1 per 400ms); punch() = the big finishing shake (never stacks closer than 400ms either)
  critShake(i) { const now = this.time.now; if (now - (this.lastShake || -1e9) < 400) return false; this.lastShake = now; this.cameras.main.shake(140, i); window.DC.shakes = (window.DC.shakes || 0) + 1; return true; }
  punch(i, d) { const now = this.time.now; if (now - (this.lastPunch || -1e9) < 400) return; this.lastPunch = this.lastShake = now; this.cameras.main.shake(d, i, true); window.DC.shakes = (window.DC.shakes || 0) + 1; window.DC.punches = (window.DC.punches || 0) + 1; }
  // boss knockback: an offset that decays every frame (no stacking tweens, never drifts)
  recoil(a) { this.rc = Phaser.Math.Clamp((this.rc || 0) + a, -14, 34); }
  recoilKick() { if (!this.boss || !this.boss.active) return; this.tweens.add({ targets: this.boss, x: this.cfg.x + 40, yoyo: true, duration: 120, ease: 'Quad.out' }); }
  update(t, dt) { // shadows stay glued to the feet; the HP ghost bar drains toward the real bar a beat after each drop
    if (this.hpGhost && this.hp) { const gw = this.hpGhost.width, hw = this.hp.width;
      if (gw < hw) this.hpGhost.width = hw; else if (gw > hw && t > this.ghostHold) this.hpGhost.width = Math.max(hw, gw - Math.max(1.2, (gw - hw) * 0.07) * (dt / 16.7));
      window.DC.ghostW = Math.round(this.hpGhost.width); }
    if (this.recoilOn && this.boss && this.boss.active) { this.rc = (this.rc || 0) * 0.8; if (Math.abs(this.rc) < 0.3) this.rc = 0; this.boss.x = this.cfg.x + this.rc; const k = this.cfg.scale; this.boss.scaleX = k * (1 - Math.abs(this.rc) * 0.003); this.boss.scaleY = k * (1 + Math.abs(this.rc) * 0.002); }
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
    // lock + hide the stats panel / GEAR list for the swing itself
    if (this.gearOpen) this.closeGear(); this.statsLocked = true;
    this.charge();
  }
  charge() {
    window.DC.phase = 'windup';
    // WINDUP: the hero pulls back and squashes for ~0.15s before dashing in (the "here it comes" beat)
    synth(this, 'windup'); this.hero.anims.pause();
    this.tweens.add({ targets: this.hero, x: this.hero.x - 26, scaleX: 3.25, scaleY: 2.8, angle: -8, duration: 150, ease: 'Quad.out', onComplete: () => {
      this.hero.setScale(3).setAngle(0); this.hero.anims.resume(); this.dash();
    } });
  }
  dash() {
    window.DC.phase = 'striking';
    const r = this.res, hd = this.head();
    this.hero.play('hero-run');
    this.cameras.main.zoomTo(1.06, 500, 'Sine.easeInOut');
    this.cameras.main.pan(W / 2 + 20, LAVA_GROUND - 200, 500, 'Sine.easeInOut');
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
    this.recoil(22); this.recoilOn = true;
    this.boss.setTintFill(0xffffff); this.time.delayedCall(110, () => this.untint());
    this.slash(hd.x, hd.y);
    burst(this, hd.x, hd.y, 0xffd36a, N(40), 380).setDepth(41);
    burst(this, hd.x, hd.y, 0xff5a2a, N(20), 280, 'px').setDepth(41);
    this.hitStop(Phaser.Math.Clamp(60 + 8 * r.L + (r.crits ? 12 : 0), 60, 100)); synth(this, r.crits ? 'crit' : 'hit', 0);   // HITSTOP scales with the blow
    // live damage counter (nothing is revealed before the blade lands)
    // the counter is drawn by the UI camera (never zoomed / shaken off screen); it sits between the boss box and the boss
    const TX = this.TX = W / 2, TY = this.TY = 322;
    this.rays = hudAdd(this, this.add.image(TX, TY, 'rays').setTint(0xffd36a).setBlendMode(Phaser.BlendModes.ADD).setDepth(43).setScale(0).setAlpha(0));
    this.tweens.add({ targets: this.rays, angle: 360, duration: 6000, repeat: -1 });
    this.dmgLabel = hudAdd(this, txt(this, TX, TY - 60, t('damage'), 18, '#ffe8b0', { strokeThickness: 5, maxW: W - 40 }).setDepth(46));
    this.dmg = hudAdd(this, txt(this, TX, TY, '0', 72, '#ffffff', { strokeThickness: 12 }).setDepth(46));
    popText(this, this.dmg, 1);
    this.br = hudAdd(this, txt(this, TX, TY + 50, '', 16, '#ffffff', { strokeThickness: 4, maxW: W - 20 }).setDepth(45));
    this.dmgScale = 1; this.shown = 0;
    this.logInit();
    // the strike plays as a volley: curse / frostbite notes first, then EVERY hit on its own (the hero, then each weapon with
    // its own roll and its own crit), THUNDER chains on the hits that fork, and FIRE burn ticks last. The whole volley is
    // squeezed into ~3s: the cadence speeds up with more weapons and above 15 hits the pops are batched.
    const steps = [];
    r.off.forEach((el) => steps.push({ kind: 'seal', el }));
    if (r.weak < 1) steps.push({ kind: 'weak', v: r.weak });
    if (r.S.vuln > 1) steps.push({ kind: 'vuln', v: r.S.vuln });
    const nPre = steps.length, H = r.hits, nH = H.length, B = nH > 15 ? Math.ceil(nH / 12) : 1;
    for (let k = 0; k < nH; k += B) { const hs = H.slice(k, k + B); steps.push(B > 1 ? { kind: 'batch', hs, from: k } : { kind: 'hit', h: hs[0], from: k }); }
    const nVol = steps.length - nPre;
    if (r.boom > 0) steps.push({ kind: 'boom', v: r.boom });
    const nb = r.ticks.length, shownTicks = nb > 4 ? 3 : nb;
    if (nb && r.S.melt) steps.push({ kind: 'melt' });
    for (let k = 0; k < shownTicks; k++) steps.push({ kind: 'burn', v: r.ticks[k], n: 1 });
    if (nb > shownTicks) steps.push({ kind: 'burn', v: r.ticks[0] * (nb - shownTicks), n: nb - shownTicks });
    if (r.executed) steps.push({ kind: 'exec' });
    const hitGap = Phaser.Math.Clamp(2400 / Math.max(1, nVol), 95, 300);
    window.DC.result.nsteps = steps.length; window.DC.result.batch = B; window.DC.result.hitGap = Math.round(hitGap);
    window.DC.result.seqMs = Math.round(nPre * 230 + nVol * hitGap + Math.min(nb, 4) * 230);
    let sum = 0, burn = 0, next = 1, hitsDone = 0;
    const show = (v) => {
      this.dmg.setText(fmt(v));
      const lim = Math.min(1.9, (W - 30) / Math.max(1, this.dmg.width)); if (this.dmg.scaleX > lim) { this.dmg.setScale(lim); this.dmgScale = Math.min(this.dmgScale, lim); }
      const left = this.execd ? 0 : Math.max(0, this.hpMax - v);
      const nw = HPW * left / this.hpMax; if (nw < this.hp.width - 0.5) this.ghostHold = this.time.now + 260;
      this.hp.width = nw; this.hpText.setText(`${fmt(left)} / ${fmt(this.hpMax)}`);
      if (this.logV) this.logV.setText(fmt(v));
      while (next <= L && v >= OK_TIERS[next].at * this.hpMax) { this.pulse(next, v); next++; }
    };
    // hit counter: "x37 HITS"
    this.hitsT = hudAdd(this, txt(this, TX, TY - 86, ' ', 22, '#ffe066', { strokeThickness: 6, stroke: '#2a1404', maxW: W - 40 }).setDepth(46));
    window.DC.popped = 0; this.burnI = 0; this.lastTick = 0;
    let shown = 0;
    const runStep = (k) => {
      if (k >= steps.length) return this.afterCount(r, show, () => next);
      const s = steps[k], K = s.kind;
      if (K === 'hit' || K === 'batch') {
        (K === 'hit' ? [s.h] : s.hs).forEach((h) => { sum = capN(Math.max(0, sum + h.v + h.cv)); });
        hitsDone += K === 'hit' ? 1 : s.hs.length; this.hitIdx = hitsDone;
        if (!this.dmgPulse) { this.tweens.killTweensOf(this.dmg); this.dmg.setScale(this.dmgScale * 1.14); this.tweens.add({ targets: this.dmg, scale: this.dmgScale, duration: 110, ease: 'Quad.out' }); }   // the total bumps on every hit
        setFit(this.hitsT, r.combo > 1.005 ? t('hitsCombo', hitsDone, (1 + r.S.combo * (hitsDone - 1)).toFixed(2)) : t('hits', hitsDone)); this.tweens.killTweensOf(this.hitsT); this.hitsT.setScale(1.3); this.tweens.add({ targets: this.hitsT, scale: 1, duration: 120 });
      } else if (K === 'burn') burn += s.v;
      else if (K === 'boom') sum = capN(sum + s.v);
      if (K === 'exec') { this.executeFx(r); window.DC.popped = k + 1; this.time.delayedCall(900, () => runStep(k + 1)); return; }
      const target = k === steps.length - 1 || steps[k + 1] && steps[k + 1].kind === 'exec' && k === steps.length - 2 ? r.total : capN(sum + burn);
      this.popNumber(s, k);
      window.DC.popped = k + 1;
      const c = { v: shown }, gap = K === 'burn' ? 230 : K === 'hit' || K === 'batch' ? hitGap : K === 'boom' || K === 'melt' ? 420 : 230;
      this.tweens.add({ targets: c, v: target, duration: gap * 0.8, ease: 'Cubic.out', onUpdate: () => show(c.v), onComplete: () => { shown = target; show(target); } });
      this.time.delayedCall(gap, () => runStep(k + 1));
    };
    this.time.delayedCall(260, () => runStep(0));
    this.tweens.add({ targets: this.hero, x: HERO_X, duration: 500, delay: 300, ease: 'Quad.out' });
  }
  // one floating number bursting out of the boss (a hit, a batch of hits, a burn tick or a curse / frostbite note)
  popNumber(s, k) {
    const hd = this.head(), K = s.kind, fast = K === 'hit' || K === 'batch';
    let x = hd.x + Phaser.Math.Between(-110, 110), y = hd.y - 20 + Phaser.Math.Between(-70, 50);
    if (K === 'burn') { const bi = this.burnI = (this.burnI || 0) + 1; x = hd.x + 30; y = hd.y + 30 - (bi - 1) * 46; }
    if (!fast) { x = hd.x + ((k % 3) - 1) * 70; y = hd.y - 40 - (k % 2) * 50; }
    x = Phaser.Math.Clamp(x, 70, W - 70); y = Math.max(TOPY_POP, y);
    let label, col, size, neg = false, crit = false, chain = 0, cv = 0;
    if (K === 'hit') {
      const h = s.h; neg = h.v < 0; crit = h.crit; chain = h.chain; cv = h.cv;
      label = neg ? '−' + fmt(-h.v) : fmt(h.v); col = neg ? '#c890ff' : crit ? '#ffffff' : h.it ? EL_CSS[h.it.element] : '#ffffff';
      size = crit ? 52 : neg ? 30 : 30;
      if (h.echo) { label = t('echoTag') + ' ' + label; window.DC.echoPopped = (window.DC.echoPopped || 0) + 1; }
      if (crit && this.res.S.superconduct && !this.scShown) { this.scShown = true; this.comboPop(t('scPop'), '#9ae8ff', 0x8ae2ff); }
    } else if (K === 'batch') {
      const v = s.hs.reduce((a, h) => a + h.v + h.cv, 0); crit = s.hs.some((h) => h.crit); chain = s.hs.reduce((a, h) => a + h.chain, 0); neg = v < 0;
      label = (neg ? '−' + fmt(-v) : fmt(v)) + ` ×${s.hs.length}`; col = neg ? '#c890ff' : crit ? '#ffffff' : '#ffffff'; size = crit ? 44 : 32;
    }
    else if (K === 'seal') { label = t('sealPop', elName(s.el)); col = '#c8a0ff'; size = 30; }
    else if (K === 'boom') { label = t('overloadPop', fmt(s.v)); col = '#ffb04a'; size = 40; this.comboPop(t('comboN').overload + '!', '#ffb04a', 0xffa040); }
    else if (K === 'melt') { this.comboPop(t('comboN').melt + ' ×' + +(RULES.combos.melt.base * Math.pow(RULES.combos.melt.per, Math.max(0, this.res.S.melt - 1))).toPrecision(3) + '!', '#ff9a6a', 0xff7a3a); return; }
    else if (K === 'weak') { label = t('cur').weak(P100(1 - s.v)); col = '#ff7a9a'; size = 32; }
    else if (K === 'vuln') { label = t('vulnPop', fmtX(s.v)); col = '#9ae8ff'; size = 40; }
    else { label = t('burnPop', fmt(s.v)) + (s.n > 1 ? ` ×${s.n}` : ''); col = '#ff9a4a'; size = 34; }
    this.logAdd(K, s, label, col, crit, chain, cv, neg);
    this.elemFx(s, crit, chain);
    if (neg) window.DC.drainPopped = (window.DC.drainPopped || 0) + 1;
    const critNum = crit && (K === 'hit' || K === 'batch');
    const fl = txt(this, x, y, label, size, col, { strokeThickness: Math.max(5, size / 6) + (critNum ? 3 : 0), stroke: critNum ? '#c8102a' : '#140812', maxW: W - 20 }).setDepth(critNum ? 45 : 44);
    fl.x = Phaser.Math.Clamp(fl.x, Math.min(W / 2, fl.width / 2 + 6), Math.max(W / 2, W - 6 - fl.width / 2));
    // POP: scale up past full size, then settle (crits overshoot more)
    fl.setScale(0.25);
    this.tweens.add({ targets: fl, scale: critNum ? 1.6 : 1.3, duration: fast ? 70 : 100, ease: 'Quad.out', onComplete: () => { if (fl.active) this.tweens.add({ targets: fl, scale: 1, duration: 140, ease: 'Back.out' }); } });
    if (critNum) { fl.setAngle(Phaser.Math.Between(-8, 8)); window.DC.critPopped = (window.DC.critPopped || 0) + 1; }
    const life = fast ? Math.max(380, Math.min(700, 2600 / Math.max(1, this.res.hits.length) * 4)) : 700;
    this.tweens.add({ targets: fl, y: y - (K === 'burn' ? 40 : 70), alpha: { from: 1, to: 0 }, delay: fast ? 200 : 260, duration: life, ease: 'Quad.in', onComplete: () => fl.destroy() });
    if (crit && K === 'hit') { const ct = txt(this, Phaser.Math.Clamp(x, 60, W - 60), y - size * 0.75, t('critHit'), 18, '#fff2a0', { strokeThickness: 4 }).setDepth(44); this.tweens.add({ targets: ct, alpha: 0, y: ct.y - 50, delay: 260, duration: life, onComplete: () => ct.destroy() }); }
    if (chain && K === 'hit' && cv) { const cl = txt(this, 0, y + 30, `${t('chainHit', chain)} +${fmt(cv)}`, 18, '#ffe866', { strokeThickness: 5, maxW: W - 20 }); cl.x = Phaser.Math.Clamp(x + 60, cl.width / 2 + 6, W - 6 - cl.width / 2); (cl).setDepth(44); this.tweens.add({ targets: cl, alpha: 0, y: cl.y - 40, delay: 300, duration: life, onComplete: () => cl.destroy() }); }
    // the boss flinches with every number (light on fast volleys)
    if (neg) this.boss.setTint(0xc090ff); else this.boss.setTintFill(0xffffff);   // white hit flash on the boss
    this.time.delayedCall(neg ? 60 : crit ? 70 : 45, () => this.untint());
    this.recoil(neg ? -5 : crit ? 14 : fast ? 5 : 9);   // local boss knockback instead of a camera shake
    const BC = { vuln: 0x6ad8ff, burn: 0xff7a2a };
    const bc = neg ? CURSE_COL : crit ? 0xffd23a : BC[K] || (K === 'hit' && s.h.it ? EL_COLOR[s.h.it.element] : 0xffffff);
    burst(this, x, y, bc, Math.max(3, Math.round((crit ? 18 : 8) * this.lite())), 220, 'px').setDepth(43);
    // sound: crits always ring; normal hits tick at most every ~90ms so long volleys stay clean
    const now = this.time.now;
    const hi = this.hitIdx || 0;
    if (crit) { sfx(this, 'hit', 0.5); synth(this, 'crit', hi); }
    else if (neg || K === 'seal' || K === 'weak') sfx(this, 'curse', 0.35);
    else if (now - this.lastTick > 60) { if (K === 'vuln') sfx(this, 'banner', 0.45); else synth(this, 'hit', hi); this.lastTick = now; }
  }
  // HIT LOG (bottom, over the hidden gear bar): one row per hit = icon + who + damage (+CRIT / ECHO / chain), the newest
  // row slides in at the bottom and older rows scroll up, in step with the volley; the running total sits underneath
  logInit() {
    (this.barObjs || []).forEach((o) => o.setVisible(false));
    const D = 55, y0 = LOG_Y, add = (o) => { this.logObjs.push(hudAdd(this, o).setDepth(D)); return o; };
    this.logObjs = []; this.logRows = []; window.DC.hitLog = [];
    // v8.2: no panel fill, the log floats over the scene; rows carry a thick stroke + drop shadow instead
    const sh = (o) => o.setShadow(2, 2, '#000000', 3, true, true);
    const c = this.logC = add(this.add.container(0, 0));
    const mg = this.make.graphics({ add: false }); mg.fillStyle(0xffffff).fillRect(8, y0 + 6, W - 16, LOG_N * LOG_RH); c.setMask(mg.createGeometryMask()); this.logMask = mg;
    add(this.add.rectangle(W / 2, y0 + 10 + LOG_N * LOG_RH, W - 28, 2, 0xffcf40, 0.5));
    sh(add(txt(this, 20, H - 26, t('logTotal'), 18, '#ffe8a0', { strokeThickness: 5 }).setOrigin(0, 0.5)));
    this.logV = sh(add(txt(this, W - 20, H - 26, '0', 22, '#ffd36a', { strokeThickness: 6 }).setOrigin(1, 0.5)));
  }
  logAdd(K, s, label, col, crit, chain, cv, neg) {
    if (!this.logC) return;
    const c = this.logC, y0 = LOG_Y + 6, RH = LOG_RH, put = (o) => { hudAdd(this, o); c.add(o); if (o.type === 'Text') o.setShadow(2, 2, '#000000', 3, true, true); return o; };
    let icon = null, name = label, val = '', marks = [];
    if (K === 'hit') {
      const h = s.h; icon = h.it ? ['icons', h.it.frame] : ['hero_idle', 0];
      name = h.it ? h.it.name : t('logHero'); val = neg ? '−' + fmt(-h.v) : fmt(h.v);
      if (h.echo) marks.push([t('echoTag'), '#9ae8ff']); if (crit) marks.push([t('logCrit'), '#fff2a0']); if (chain && cv) marks.push(['+' + fmt(cv), '#ffe866']);
    } else if (K === 'batch') {
      const it = (s.hs.find((h) => h.it) || {}).it; icon = it ? ['icons', it.frame] : ['hero_idle', 0];
      name = t('logBatch', s.hs.length); val = label.replace(/ ×\d+$/, ''); if (crit) marks.push([t('logCrit'), '#fff2a0']);
    } else icon = ['el_' + (K === 'vuln' ? 'Ice' : K === 'seal' ? s.el : 'Fire'), null];
    const n = this.logRows.length, yy = y0 + Math.min(n, LOG_N) * RH + RH / 2;
    const row = [];
    if (icon) { const im = put(icon[1] === null ? this.add.image(22, yy, icon[0]).setScale(1.2) : this.add.image(22, yy, icon[0], icon[1]).setScale(icon[0] === 'icons' ? 0.6 : 0.7)); if (icon[0] === 'hero_idle') im.setCrop(14, 8, 36, 30); row.push(im); }
    let rx = W - 18;
    if (val) { const v = put(txt(this, rx, yy, val, 17, neg ? '#c890ff' : crit ? '#ffffff' : col, { strokeThickness: 5, stroke: crit ? '#c8102a' : '#140812' }).setOrigin(1, 0.5)); row.push(v); rx -= v.width + 8; }
    marks.slice().reverse().forEach(([m, mc]) => { const mt = put(txt(this, rx, yy, m, 16, mc, { strokeThickness: 5 }).setOrigin(1, 0.5)); row.push(mt); rx -= mt.width + 6; });
    const nm = put(txt(this, 40, yy, name, 16, val ? '#f4ead8' : col, { strokeThickness: 5 }).setOrigin(0, 0.5)); clipText(nm, Math.max(60, rx - 46)); row.push(nm);
    this.logRows.push(row); window.DC.hitLog.push([name, val, marks.map((m) => m[0]).join(' ')]);
    const fast = Math.min(110, (this.res.hits.length > 8 ? 70 : 110));
    row.forEach((o) => { o.alpha = 0; o.x += 18; this.tweens.add({ targets: o, alpha: 1, x: o.x - 18, duration: fast }); });
    if (n >= LOG_N) {   // full: everything scrolls up one row, rows that leave the top are dropped
      this.logRows.forEach((r) => r.forEach((o) => this.tweens.add({ targets: o, y: o.y - RH, duration: fast, ease: 'Quad.out' })));
      const gone = this.logRows.splice(0, this.logRows.length - LOG_N - 1); gone.forEach((r) => r.forEach((o) => o.destroy()));
    }
  }
  logEnd() { const o = this.logObjs || []; this.logObjs = []; this.logC = null; this.tweens.add({ targets: o, alpha: 0, duration: 250, onComplete: () => o.forEach((q) => q.destroy()) }); }
  // dual-element combo callout (MELT / SUPERCONDUCT / OVERLOAD): a banner under the hit counter
  comboPop(label, css, col) {
    const y = 404 + (this.comboN || 0) * 40; this.comboN = (this.comboN || 0) + 1;
    const c = hudAdd(this, txt(this, W / 2, y + 20, label, 30, css, { strokeThickness: 8, stroke: '#1a0804', maxW: W - 20 }).setDepth(48));
    try { if (c.preFX) c.preFX.addGlow(col, 3, 0, false, 0.1, 8); } catch (e) {}
    popText(this, c, 1); sfx(this, 'banner', 0.5);
    this.tweens.add({ targets: c, alpha: 0, y: y - 20, delay: 1300, duration: 400, onComplete: () => c.destroy() });
    window.DC.combos = (window.DC.combos || []).concat(label);
  }
  // EXECUTE: the boss is under the execute line after all hits -> a red guillotine slash finishes it
  executeFx(r) {
    const hd = this.head(), cam = this.cameras.main, N = (n) => Math.max(4, Math.round(n * this.lite()));
    this.execd = true;
    const line = this.add.rectangle(hd.x, -20, 14, 0, 0xff3a6a).setOrigin(0.5, 0).setDepth(45).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: line, height: LAVA_GROUND + 20, duration: 180, ease: 'Quad.in', onComplete: () => {
      this.slash(hd.x, hd.y, 1.6, 0xff3a6a); burst(this, hd.x, hd.y, 0xff3a6a, N(50), 420).setDepth(42);
      this.recoil(30); this.hitStop(100); sfx(this, 'hit', 0.9); sfx(this, 'shatter', 0.5);
      this.tweens.add({ targets: line, alpha: 0, duration: 500, onComplete: () => line.destroy() });
      this.hp.width = 0; this.hpText.setText(`0 / ${fmt(this.hpMax)}`);
    } });
    const ex = hudAdd(this, txt(this, W / 2, 470, t('execPop'), 48, '#ff4a7a', { strokeThickness: 10, stroke: '#2a0410', maxW: W - 20 }).setDepth(49));
    try { if (ex.preFX) ex.preFX.addGlow(0xff3a6a, 4, 0, false, 0.1, 10); } catch (e) {}
    popText(this, ex, 1); window.DC.executePopped = true;
    this.tweens.add({ targets: ex, alpha: 0, delay: 1500, duration: 400, onComplete: () => ex.destroy() });
  }
  // element-specific VFX: ICE frost ring + shards, crit slash, THUNDER chain lightning, FIRE flames rising off the boss
  elemFx(s, crit, chain) {
    const hd = this.head(), N = (n) => Math.max(4, Math.round(n * this.lite())), cam = this.cameras.main, now = this.time.now, many = this.res.hits.length > 15;
    if (s.kind === 'vuln') { this.ring(hd.x, hd.y, 0x8ae2ff, 8, 6); burst(this, hd.x, hd.y, 0x8ae2ff, N(30), 300, 'spark').setDepth(42); this.boss.setTint(0x9ae8ff); this.time.delayedCall(160, () => this.untint()); return; }
    if (s.kind === 'burn') {
      const f = this.add.particles(hd.x, hd.y + 40, 'spark', { x: { min: -70, max: 70 }, speedY: { min: -220, max: -90 }, lifespan: 600, scale: { start: 1.3, end: 0 }, tint: [0xff5a1a, 0xffb02a, 0xffe08a], blendMode: 'ADD', emitting: false }).setDepth(42);
      f.explode(N(26)); this.time.delayedCall(800, () => f.destroy());
      this.boss.setTint(0xff9a6a); this.time.delayedCall(120, () => this.untint()); return;
    }
    if (s.kind === 'seal' || s.kind === 'weak') { this.ring(hd.x, hd.y, CURSE_COL, 6, 4); return; }
    if (s.kind === 'boom') { // OVERLOAD: fire + lightning explosion rings
      this.ring(hd.x, hd.y, 0xffa040, 12, 9); this.ring(hd.x, hd.y, 0xffe04a, 6, 12, 120);
      burst(this, hd.x, hd.y, 0xff7a2a, N(50), 420).setDepth(42); burst(this, hd.x, hd.y, 0xffe04a, N(30), 360, 'spark').setDepth(42);
      sfx(this, 'boom', 0.7); this.recoil(30); return;
    }
    // weapon hits: a gold crescent + kick on a crit, THUNDER bolts on a chain (both rate-limited on long volleys)
    if (crit && now - (this.lastCritFx || 0) > (many ? 160 : 60)) {
      this.lastCritFx = now; this.slash(hd.x + Phaser.Math.Between(-40, 40), hd.y + Phaser.Math.Between(-30, 30), many ? 0.9 : 1.2, 0xffd23a);
      // crit HITSTOP instead of a camera shake (no shaking during the volley); bigger crits freeze longer, rate-limited
      if (!many && now - (this.lastStop || -1e9) > 260) { this.lastStop = now; this.hitStop(Phaser.Math.Clamp(60 + 6 * Math.log10(Math.max(1, this.res.total / this.hpMax) + 1) * 10, 60, 85)); }
    }
    if (chain && now - (this.lastChainFx || 0) > (many ? 200 : 90)) {
      this.lastChainFx = now;
      for (let k = 0; k < Math.min(4, 1 + chain); k++) {
        const bx = hd.x + Phaser.Math.Between(-200, 200), b = this.add.image(bx, LAVA_GROUND + 30, 'beam').setOrigin(0.5, 1).setTint(k % 2 ? 0xffffff : 0xffe04a)
          .setBlendMode(Phaser.BlendModes.ADD).setDepth(42).setScale(0.3, 1.3).setAlpha(0).setAngle(Phaser.Math.Between(-12, 12));
        this.tweens.add({ targets: b, alpha: { from: 0.85, to: 0 }, scaleX: 0.08, duration: 320, delay: k * 40, onComplete: () => b.destroy() });
      }
      this.ring(hd.x, hd.y, 0xffe04a, 6, 5); sfx(this, 'boom', 0.3);
    }
  }
  afterCount(r, show, getNext) {
    show(r.total); this.dmg.setText(fmt(r.total));
    const parts = [t('strikeSum', r.hits.length, r.crits, r.chained)]; if (r.boom > 0) parts.push(t('overloadPop', fmt(r.boom))); if (r.burn > 0) parts.push(t('burnPop', fmt(r.burn)));
    setFit(this.br, parts.join('  ·  ') + `  =  ${fmt(r.total)}`);
    this.finalLabel(r);
    window.DC.phase = 'impact-done';
    const L = r.L, cam = this.cameras.main;
    this.recoilOn = false; if (this.boss && this.boss.active) this.boss.setX(this.cfg.x).setScale(this.cfg.scale);
    if (L >= 1 && !r.executed) this.recoilKick();
    this.time.delayedCall(800 + 220 * L, () => {
      cam.zoomTo(1, 400); cam.pan(W / 2, H / 2, 400);
      this.time.delayedCall(420, () => L >= 1 ? this.killSeq(r) : this.loseSeq());
    });
  }
  // escalating hit at each overkill threshold
  pulse(L, v) {
    const T = OK_TIERS[L], cam = this.cameras.main, hd = this.head(), N = (n) => Math.max(4, Math.round(n * this.lite()));
    this.shown = L; window.DC.overkill = L;
    this.dmgScale = Math.min(T.font / 84, 1.9, (W - 30) / Math.max(1, this.dmg.width));
    this.dmg.setColor(T.css);
    this.tweens.killTweensOf(this.dmg); this.dmgPulse = true; this.time.delayedCall(260, () => { this.dmgPulse = false; });
    this.dmg.setScale(this.dmgScale * 1.25);
    this.tweens.add({ targets: this.dmg, scale: this.dmgScale, duration: 220, ease: 'Back.out' });
    this.tweens.add({ targets: this.dmg, angle: { from: L % 2 ? -6 : 6, to: 0 }, duration: 260 });
    if (L === 1) { // HP hits zero
      sfx(this, 'hit', 1); sfx(this, 'banner', 0.5); this.recoil(18);
      this.hp.setFillStyle(0xffffff); this.time.delayedCall(90, () => this.hp.setFillStyle(0xd22a2a));
      this.boss.setTint(0xff6a5a); this.time.delayedCall(120, () => this.untint());
      burst(this, hd.x, hd.y, T.col, N(40), 380).setDepth(41);
      return;
    }
    // L >= 2: overkill tiers
    sfx(this, T.snd, 0.75 + 0.08 * L); if (L >= 3) sfx(this, 'hit', 1);
    this.hitStop(T.stop); this.recoil(16 + L * 3);
    // (no camera shake / flash on tier-ups: the ONE shake of a strike is the killing blow)
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
    this.okT = hudAdd(this, txt(this, this.TX, this.TY + 88, okLabel(L, ratio), 24 + 5 * L, T.css, { strokeThickness: 8, stroke: '#1a0410', maxW: W - 20 }).setDepth(47));
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
      const lbl = hudAdd(this, txt(this, this.TX, this.TY + 88, r.executed ? t('execPop') : L === 1 ? t('kill') : t('notEnough', fmt(r.total), fmt(this.hpMax)), L === 1 ? 40 : 24, OK_TIERS[L].css, { strokeThickness: 8, maxW: W - 20 }).setDepth(47));
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
    // KILLING BLOW: a white flash on the boss, ~0.5s slow motion, it shatters into chunks, and the strike's ONE screen shake
    this.boss.setTintFill(0xffffff); this.slash(hd.x, hd.y, 1.5, OK_TIERS[Math.max(1, L)].col);
    this.tweens.timeScale = 0.3; this.time.timeScale = 0.3; window.DC.slowmo = true;
    setTimeout(() => { if (this.tweens) { this.tweens.timeScale = 1; this.time.timeScale = 1; } window.DC.slowmo = false; }, 500);
    synth(this, 'kill'); sfx(this, 'shatter', 0.9); sfx(this, L >= 4 ? 'nuke' : L >= 3 ? 'boom' : 'win', 0.8);
    this.punch(Math.min(0.022, 0.01 + 0.003 * L), 420 + 40 * L);
    this.ring(hd.x, hd.y - 20, OK_TIERS[Math.max(1, L)].col, 14, 10 + Math.min(4, L), 0, 800);
    this.shatter(L >= 4 ? 9 : L >= 3 ? 6 : 5, L >= 4 ? 7 : L >= 3 ? 5 : 4, L >= 5 ? 640 : L === 4 ? 520 : L === 3 ? 360 : 260);
    for (let k = 0; k < 3 + L; k++) this.time.delayedCall(k * 110, () => burst(this, hd.x + Phaser.Math.Between(-120, 120), hd.y + Phaser.Math.Between(-60, 80), k % 2 ? 0xff7a2a : OK_TIERS[Math.max(1, L)].col, N(40), 420).setDepth(41));
    window.DC.blownApart = true;
    this.record(r, false);
    this.time.delayedCall(L >= 3 ? 1250 : 1100, () => this.stageClear());
  }
  record(r, failed) {
    const R = this.run;
    this.log.push({ stage: this.s, dmg: r.total, hp: this.hpMax, L: failed ? 0 : r.L, ratio: r.ratio, failed });
    R.total = capN(R.total + r.total); R.maxHit = Math.max(R.maxHit, r.total);
    window.DC.log = this.log.slice(-20); window.DC.run = { stage: this.s + 1, total: R.total, maxHit: R.maxHit };
  }
  stageClear() {
    window.DC.phase = 'stage-clear';
    this.tweens.add({ targets: [this.dmg, this.br, this.okT, this.rays, this.dmgLabel, this.hitsT].filter(Boolean), alpha: 0, duration: 250 });
    this.logEnd();
    const N = (n) => Math.max(4, Math.round(n * this.lite()));
    sfx(this, 'banner', 0.8); sfx(this, 'rare', 0.5);
    this.tweens.add({ targets: this.hero, x: W / 2 - 40, duration: 400 });
    const big = isBig(this.s);
    const ban = txt(this, W / 2, 300, big ? t('milestone', this.s + 1) : t('stageClear', this.s + 1), 44, '#ffd36a', { strokeThickness: 10, stroke: '#4a2400', maxW: W - 24 }).setDepth(60);
    this.statsHidden = false; this.statsLocked = false; this.drawStats();   // the swing is over: the panel is back in its spot
    if (big) milestoneJingle(this);
    try { if (ban.preFX) { ban.preFX.addShine(0.9, 0.35, 4); ban.preFX.addGlow(0xffcf40, 4, 0, false, 0.1, 10); } } catch (e) {}
    popText(this, ban, 1);
    const nxs = this.s + 1, nxb = isBig(nxs);
    const sub = txtW(this, W / 2, 334, (nxb ? t('bigBoss') + '!  ' : '') + t('next', bossName(nxs), fmt(stageHp(nxs, this.G))), 20, nxb ? '#ff9a7a' : '#ffffff', W - 40).setDepth(60); sub.setAlpha(0);
    this.tweens.add({ targets: sub, alpha: 1, duration: 300, delay: 300 });
    const coins = this.add.particles(0, -20, 'coin', { x: { min: 10, max: W - 10 }, lifespan: 2000, speedY: { min: 120, max: 260 }, gravityY: 260, rotate: { min: 0, max: 360 }, scale: { min: 1.4, max: 2.2 }, frequency: 30 / this.lite() }).setDepth(59);
    this.time.delayedCall(1200, () => coins.stop());
    burst(this, W / 2, 300, 0xffcf40, N(60), 420).setDepth(61);
    const g = afterKill(this.G, this.res);   // OVERKILL CONVERSION -> permanent damage bonus
    if (g > 0) {
      const pp = txt(this, W / 2, 420, t('permPop', pct(g)), 24, '#ffb0e0', { strokeThickness: 7, maxW: W - 30 }).setDepth(60);
      popText(this, pp, 1); this.tweens.add({ targets: pp, alpha: 0, y: pp.y - 20, delay: 1200, duration: 400, onComplete: () => pp.destroy() });
      window.DC.perm = this.G.perm;
    }
    this.clearTxt = [ban, sub];
    this.time.delayedCall(big ? 900 : 600, () => this.bonusMoment());
  }
  // OVERKILL BONUS: reward scaled by damage / boss HP, auto-opened, added to the gear
  bonusMoment() {
    const r = this.res, b = bonusDrop(r.total, this.hpMax, Math.random, this.s, r.executed), N = (n) => Math.max(4, Math.round(n * this.lite()));
    if (!b) { window.DC.bonus = null; window.DC.bonusShown = true; this.time.delayedCall(900, () => this.toNextStage()); return; }
    const it = nameItem(b.item); it.bonus = b.tier; it.src = 'boss'; this.dropItem = it;
    const R = RARITY[it.rarity], leg = LEG_R[it.rarity], jack = b.tier === 'jackpot';
    window.DC.phase = 'bonus'; window.DC.bonus = { tier: b.tier, type: b.type, name: it.name, rule: ruleText(it), rarity: it.rarity, q: b.q, rare: b.rare, base: b.base, shift: b.shift };
    this.log[this.log.length - 1].bonus = b.tier;
    // centred reveal: dim the arena, the clear banner steps aside, the chest pops open mid-screen, a big item card below
    const X = W / 2;
    (this.clearTxt || []).forEach((o) => this.tweens.add({ targets: o, alpha: 0, duration: 250 }));
    const dimR = this.add.rectangle(-100, -100, W + 200, H + 200, 0x05030a, 1).setOrigin(0).setDepth(60.5).setAlpha(0);
    this.tweens.add({ targets: dimR, alpha: 0.55, duration: 300 });
    // the (dead) boss's info box stays in its spot but dims under the modal reveal, so the reveal title reads clearly
    (this.bossHud || []).forEach((o) => { if (o.active) this.tweens.add({ targets: o, alpha: 0, duration: 250 }); });
    const title = txt(this, X, 250, t('bonusTitle'), 34, '#ffd36a', { strokeThickness: 8, stroke: '#4a2400', maxW: W - 24 }).setDepth(62);
    window.DC.bonusTitleY = { title: 250 - 20, box: BOSS_Y + 76 };
    popText(this, title, 1); sfx(this, 'banner', 0.7);
    const tier = txt(this, X, 286, t('bonusTier')[b.tier], 20, jack ? '#ffcf40' : b.tier === 'chest' ? '#d58cff' : '#e8dcff', { strokeThickness: 5, maxW: W - 30 }).setDepth(62);
    tier.setAlpha(0); this.tweens.add({ targets: tier, alpha: 1, duration: 200, delay: 150 });
    // OVERKILL -> RARITY: how much the overkill raised the drop's odds ("Overkill x12 -> Rare+ 64% (normally 20%)")
    if (b.q >= 1 && b.rare !== undefined) {
      const qs = b.q >= 100 ? fmt(b.q) : b.q >= 10 ? String(Math.round(b.q)) : b.q.toFixed(1).replace(/\.0$/, '');
      const ol = txtW(this, X, 302, t('okRare', qs, P100(b.rare), P100(b.base)), 16, '#9affd8', W - 30, { stroke: '#04201a' }).setDepth(62);
      ol.setAlpha(0); this.tweens.add({ targets: ol, alpha: 1, duration: 200, delay: 300 }); window.DC.okRareText = ol.text;
    }
    const CX = X, IX = X, CY = 524; // chest mid-screen, the item rises above it
    const ch = this.add.image(CX, -60, 'chest_' + it.element).setScale(2.6).setOrigin(0.5, 1).setDepth(62);
    if (jack) { const g = this.add.image(CX, CY - 40, 'glowdot').setTint(0xffcf40).setBlendMode(Phaser.BlendModes.ADD).setDepth(61).setScale(2.5).setAlpha(0.6); this.tweens.add({ targets: g, scale: 3.2, yoyo: true, repeat: 4, duration: 140 }); this.time.delayedCall(1400, () => g.destroy()); sfx(this, 'charge', 0.6); }
    this.tweens.add({ targets: ch, y: CY, duration: 380, ease: 'Bounce.out', onComplete: () => {
      sfx(this, 'open', 0.5);
      this.tweens.add({ targets: ch, angle: { from: -7, to: 7 }, yoyo: true, repeat: jack ? 4 : 2, duration: 55, onComplete: () => {
        ch.setAngle(0).setTexture('open_' + it.element);
        const iy = 392;
        if (it.rarity !== 'COMMON') {
          const rays = this.add.image(IX, iy, 'rays').setTint(R.col).setBlendMode(Phaser.BlendModes.ADD).setDepth(62).setScale(0).setAlpha(0.7);
          this.tweens.add({ targets: rays, scale: leg ? 1.2 : 0.85, duration: 360, ease: 'Back.out' }); this.tweens.add({ targets: rays, angle: 360, duration: 6000, repeat: -1 });
        }
        burst(this, CX, CY - 40, R.col, N(leg ? 80 : 40), leg ? 460 : 320).setDepth(63);
        this.ring(CX, CY - 40, R.col, leg ? 10 : 6, leg ? 8 : 4);
        if (leg) { softFlash(this, 0xffe6a0, 0.22, 260); sfx(this, 'legendary', 0.85); this.cameras.main.shake(400, 0.012);
          const coins = this.add.particles(0, -20, 'coin', { x: { min: 10, max: W - 10 }, lifespan: 1800, speedY: { min: 120, max: 240 }, gravityY: 260, rotate: { min: 0, max: 360 }, scale: { min: 1.4, max: 2.2 }, frequency: 30 / this.lite() }).setDepth(63);
          this.time.delayedCall(900, () => coins.stop()); }
        else if (BIG_R[it.rarity]) { sfx(this, 'epic', 0.7); this.cameras.main.shake(250, 0.008); }
        else sfx(this, it.rarity === 'COMMON' ? 'open' : 'rare', 0.6);
        const icon = this.add.image(CX, CY - 40, 'icons', it.frame).setDepth(64).setScale(1);
        try { if (icon.preFX && it.rarity !== 'COMMON') icon.preFX.addGlow(R.col, 4, 0, false, 0.1, 10); } catch (e) {}
        this.tweens.add({ targets: icon, x: IX, y: iy, scale: 3, duration: 420, ease: 'Back.out' });
        // the item card: rarity, name, effect (+ the gear event below)
        const rt = txt(this, X, 560, t('rar')[it.rarity], 18, R.css, { strokeThickness: 5, maxW: W - 50 }).setDepth(64).setAlpha(0);
        const nm = txt(this, X, 590, it.name, 24, it.cursed ? '#d9a6ff' : EL_CSS[it.element], { strokeThickness: 6, maxW: W - 50 }).setDepth(64).setAlpha(0);
        const pre = stats(this.G.items), ev = equip(this.G, it, this.s), ups = buildUps(pre, stats(this.G.items));
        this.time.delayedCall(650, () => this.setPower(this.pw()));
        if (ups.length) this.time.delayedCall(1300, () => buildBanner(this, ups));
        const rl = txtW(this, X, 610, ruleText(it), 20, ruleCol(it), W - 50).setDepth(64).setAlpha(0);
        const cb = rl.y + rl.height + 12, cardBg = panel(this, 12, 540, W - 24, cb - 540, { border: R.col, alpha: 0.95 }).setDepth(63).setAlpha(0);
        this.tweens.add({ targets: [cardBg, rt, nm, rl], alpha: 1, duration: 200, delay: 200 }); popText(this, nm, 1);
        window.DC.bonusCard = { x: X, y: 590, name: it.name, rarity: it.rarity, bottom: cb };
        window.DC.event = { type: ev.type, n: ev.n, gem: ev.gem, purified: ev.purified.map((p) => p.curse) };
        // equip it: the event label pops above the item, the gear bar redraws
        this.time.delayedCall(600, () => {
          const el = txt(this, X, Math.min(BAR_Y - 22, cb + 26), ev.gem ? `${evText(ev)}  ${t('evGem')}` : evText(ev), 20, ev.gem ? EV_CSS.gem : EV_CSS[ev.type], { strokeThickness: 6, maxW: W - 30 }).setDepth(65);
          popText(this, el, 1); sfx(this, 'tick', 0.55);
          ev.purified.forEach((p, k) => this.time.delayedCall(250 + k * 450, () => { purifyFx(this, p, IX, iy, 66); }));
          window.DC.bonusShown = true;
        });
        // stays up long enough to read; tap to continue sooner
        this.time.delayedCall(leg ? 3600 : 3000, () => this.toNextStage());
        this.time.delayedCall(700, () => this.input.once('pointerdown', () => this.toNextStage()));
      } });
    } });
  }
  // the BOSS DROP goes into the gear list on its own beat (not together with the next chest's item): the reveal fades, the
  // item flies from the centre into the list, which peeks open with that row dropping in under a BOSS DROP tag
  fileDrop(done) {
    const it = this.dropItem; this.dropItem = null;
    if (!it || !this.G.items.includes(it)) { done(); return; }
    window.DC.phase = 'drop-file';
    const ic = this.children.list.find((o) => o.type === 'Image' && o.depth === 64 && o.frame && o.frame.name === it.frame);
    const from = ic ? { x: ic.x, y: ic.y } : { x: W / 2, y: 192 };
    this.children.list.filter((o) => o.depth > 61 && o.depth < 70 && o.active && o !== ic).forEach((o) => this.tweens.add({ targets: o, alpha: 0, duration: 220 }));
    if (ic) this.tweens.add({ targets: ic, alpha: 0, duration: 120 });
    if (this.gearOpen) this.closeGear();
    this.seenN = this.G.seenN = this.G.items.length - 1;
    const cam = this.cameras.main, sp = { x: (from.x - cam.worldView.x) * cam.zoom, y: (from.y - cam.worldView.y) * cam.zoom, s: 3 };
    this.time.delayedCall(160, () => flyToBar(this, it, sp, t('bossDrop'), '#ff9a8a', () => { window.DC.gearPeek = true; window.DC.dropFiled = { name: it.name, rows: this.G.items.length, bar: barKey(it) }; }));
    this.time.delayedCall(1700, done);
  }
  toNextStage() {
    if (this.leaving) return; this.leaving = true;
    if (this.dropItem) { this.fileDrop(() => { this.leaving = false; this.dropItem = null; this.toNextStage(); }); return; }
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.run.s++;
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(isBig(this.run.s) ? 'intro' : 'pick', { run: this.run }));
  }
  loseSeq() {
    // the boss lunges and EATS the hero
    window.DC.phase = 'eating'; this.logEnd();
    this.tweens.add({ targets: [this.dmg, this.br, this.okT, this.rays, this.dmgLabel, this.hitsT].filter(Boolean), alpha: 0, duration: 250 });
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
            const chomp = txt(this, Phaser.Math.Clamp(m.x, 130, W - 130), Math.max(300, m.y - 90), t('chomp'), 52, '#ff5a4a', { strokeThickness: 10, maxW: W - 20 }).setDepth(50);
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
    // portrait result card; the HUD / gear bar (UI camera) are hidden so nothing draws over it
    if (this.gearOpen) this.closeGear(); this.statsLocked = true; if (this.tip) this.tip.hide(true);
    this.children.list.filter((o) => o.__hud && o !== (this.tip && this.tip.c)).forEach((o) => o.setVisible(false));
    const cam = this.cameras.main; cam.setZoom(1); cam.centerOn(W / 2, H / 2);
    this.add.rectangle(-100, -100, W + 200, H + 200, 0x000000, 0.72).setOrigin(0).setDepth(70);
    const D = 71, X = W / 2, WW = W - 56, g = panel(this, 14, 40, W - 28, 790, { border: rec ? 0xffcf40 : 0xd04a3a }); g.setDepth(D);
    let y = 66;
    const tt = txtW(this, X, y, t('ateBy', bossName(this.s)), 30, '#ff5a4a', WW, { strokeThickness: 8 }).setDepth(D); y += tt.height + 36;
    const st = txt(this, X, y, t('reached', reached), 44, '#ffd36a', { strokeThickness: 10, stroke: '#2a1404', maxW: WW }).setDepth(D); y += 48;
    try { if (st.preFX) st.preFX.addShine(0.8, 0.3, 4); } catch (e) {}
    txt(this, X, y, t('maxHit', fmt(R.maxHit)), 26, '#ffffff', { strokeThickness: 6, maxW: WW }).setDepth(D); y += 36;
    txt(this, X, y, t('totalDmg', fmt(R.total)), 20, '#ffd36a', { strokeThickness: 5, maxW: WW }).setDepth(D); y += 30;
    txt(this, X, y, t('bestRec', best.stage, fmt(best.hit)), 18, '#b8f0a0', { strokeThickness: 4, maxW: WW }).setDepth(D); y += 18;
    const ll = txtW(this, X, y, t('loseLine'), 18, '#e8dcff', WW).setDepth(D); y += ll.height + 34;
    if (rec) {
      const nr = txt(this, W - 86, 50, t('newRec'), 22, '#8aff7a', { strokeThickness: 7, maxW: 150 }).setDepth(D + 1).setAngle(8);
      popText(this, nr, 1); this.tweens.add({ targets: nr, scale: 1.12, yoyo: true, repeat: -1, duration: 420 });
      this.time.delayedCall(400, () => burst(this, W - 86, 50, 0x8aff7a, 40, 320).setDepth(D + 1));
    }
    // final gear, newest first: up to five rows of 6 (+N more)
    const list = [...this.items].reverse(), n = Math.min(30, list.length), sp = 60, more = list.length - n;
    list.slice(0, n).forEach((it, i) => {
      const row = Math.floor(i / 6), inRow = Math.min(6, n - row * 6), x = X - (inRow - 1) * sp / 2 + (i % 6) * sp, yy = y + row * 58;
      this.add.rectangle(x, yy, 52, 52, itemCol(it), it.cursed ? 0.55 : 0.3).setStrokeStyle(2, RARITY[it.rarity].col).setDepth(D);
      const im = this.tip.attach(this.add.image(x, yy, 'icons', it.frame).setScale(1.35).setDepth(D), it);
      if (it.cursed && it.kind === 'weapon') im.setTint(0xb070ff);
    });
    const rows = Math.ceil(n / 6); y += Math.max(0, rows - 1) * 58 + 40;
    if (more) { txt(this, X, y, '+' + more, 20, '#ffe8a0', { strokeThickness: 5 }).setDepth(D); y += 26; }
    if (n) txtW(this, X, y, t('tapItem'), 16, '#bba8d0', WW).setDepth(D);
    window.DC.endLayout = { gridBottom: y };
    button(this, X, 772, t('playAgain'), () => { restoreMusic(this); this.scene.start('title'); }, 300).setDepth(D);
  }
}

// the Strike scene's pre-swing moment reuses the pick screen's stats panel + GEAR list (one implementation)
Object.assign(Strike.prototype, UI); Object.assign(Intro.prototype, UI);
Object.assign(Pick.prototype, Object.fromEntries(Object.entries(UI).filter(([k]) => k !== 'drawPower')));   // Pick adds its hero first, then UI.drawPower

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
  loadLangFont(LANG).then(boot, boot);
}
// ---- small landscape frames (the X feed player, ~500x380 / 640x480): a readable cover instead of a shrunken portrait game ----
// big landscape (desktop 1200x628) keeps the letterboxed portrait game; portrait phones play directly
function coverMode() { const w = window.innerWidth, h = window.innerHeight; return w > h && h < 520; }
function boot() { if (coverMode() && !/[?&]nocover/.test(location.search)) showCover(); else startGame(); }
function showCover() {
  const DC = window.DC; DC.phase = 'cover'; DC.cover = { shown: true, taps: 0, action: null };
  const el = document.createElement('div'); el.id = 'cover'; el.setAttribute('role', 'button');
  el.innerHTML = `<div class="cv-t">${t('title')}</div><div class="cv-s">${t('coverSub')}</div>
    <div class="cv-b"><span></span></div><div class="cv-p">${t('coverPlay')}</div><div class="cv-n"></div>`;
  el.style.fontFamily = fontFor(LANG);
  document.body.appendChild(el);
  const note = el.querySelector('.cv-n');
  const done = () => { window.removeEventListener('resize', check); el.remove(); DC.cover.shown = false; startGame(); };
  const check = () => { if (!coverMode()) done(); };
  window.addEventListener('resize', check);
  el.addEventListener('click', () => {
    DC.cover.taps++;
    const de = document.documentElement, rf = de.requestFullscreen || de.webkitRequestFullscreen;
    let p = null; try { p = rf ? rf.call(de) : null; } catch (e) { p = null; }
    // full screen granted -> the resize listener starts the game; still a small landscape (phone held sideways / blocked
    // inside an iframe) -> open the same page in a new tab (portrait in-app browser / a big desktop tab)
    const fallback = () => {
      if (!coverMode()) return done();
      const w = window.open(location.href.split('#')[0], '_blank');
      DC.cover.action = w ? 'tab' : 'rotate'; note.textContent = w ? t('coverOpen') : t('coverRotate');
    };
    DC.cover.action = 'fullscreen';
    Promise.resolve(p).then(() => setTimeout(fallback, 500), fallback);
  });
}
