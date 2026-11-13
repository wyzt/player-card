// ===== GAME LOGIC (pure, no Phaser) =====
// ENDLESS: every stage = pick ONE of 3 chests (one per element: Fire / Ice / Thunder; sometimes one is a DARK chest),
// then ONE strike. Kill -> next stage, forever. Every 5th stage is a BIG BOSS (more HP, better loot, bonus chest).
// Gear STACKS FOREVER. Every weapon hits on its own with its own crit chance; armour & accessories never crit, they add
// order-independent effects (element %, crit damage, combo, execute line, echo, greed, overkill conversion).
const RULES = {
  hp0: 30, hpGrowth: 1.75, hpCurve: 0.01, // boss HP at stage s (0-based) = hp0 * hpGrowth^s * e^(hpCurve*s^2): gentle start, steeper later
  bigEvery: 5, bigHp: 2.5, bigRank: 1.6, // BIG BOSS: x2.5 HP; its chests roll rarity as if stage were x1.6 further
  lootGrowth: 1.4,                 // weapon damage of loot found at stage s is x lootGrowth^s
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
  boss: { weak: 1.25, resist: 0.8,  // each weapon of the boss's weak / resisted element
    infWeak: 2.2, infResist: 0.3 },    // INFUSION: the whole strike takes the element of the chest you opened this stage
  // ELEMENTS: same-element item count 3 / 6 / 9 -> Lv1..3, each level adds a qualitative upgrade
  elem: { at: [3, 6, 9],
    // FIRE: your Fire hits keep burning (x% of the Fire hits per tick). Lv3 INFERNO: +1 tick per 3 extra Fire items
    Fire: { burn: [0, 0.15, 0.4, 1.0], ticks: [0, 3, 4, 6] },
    // ICE: frostbite amplifies EVERY hit; Ice weapons crit more. Lv3 SHATTER: +1x crit damage for everything
    Ice: { vuln: [1, 1.2, 1.7, 3.0], crit: [0, 0.1, 0.2, 0.35], shatter: 1 },
    // THUNDER: each Thunder hit may fork into chain bolts. Lv3 STORM: chain bolts can crit
    Thunder: { chance: [0, 0.3, 0.5, 0.7], chains: [0, 2, 4, 7], bolt: 0.8 } },
  // DUAL COMBOS when two elements are both Lv1+: MELT (Fire+Ice) burn x3, SUPERCONDUCT (Ice+Thunder) crit damage x2,
  // OVERLOAD (Fire+Thunder) an explosion of 35% of all hits
  combos: { melt: 3, superconduct: 2, overload: 0.35 },
  bonus: { minor: false, chestAt: 3, jackpotAt: 8, jackpotShift: 1.6 },
  milestone: 5,
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
const bossHp = (s) => capN(RULES.hp0 * Math.pow(RULES.hpGrowth, s) * Math.exp(RULES.hpCurve * s * s) * (isBig(s) ? RULES.bigHp : 1));
const lootScale = (s) => capN(Math.pow(RULES.lootGrowth, s));
// each boss has a weak and a resisted element (fixed per roster slot, shifted every cycle of 15)
const BOSS_N = 15;
function bossEl(s) { if (s < 1) return null; const i = s % BOSS_N, c = Math.floor(s / BOSS_N); return { weak: ELEMENTS[(i * 2 + c) % 3], resist: ELEMENTS[(i * 2 + c + 1) % 3] }; }
// 3 chests, one per element (shuffled); from stage `dark.from` one may be swapped for a DARK chest of a random element
function rollOffer(rng, s = 0) {
  const els = [...ELEMENTS]; for (let i = 2; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [els[i], els[j]] = [els[j], els[i]]; }
  const off = els.map((e) => ({ type: 'normal', element: e }));
  if (s >= RULES.dark.from && rng() < RULES.dark.chance) off[Math.floor(rng() * 3)] = { type: 'dark', element: pick(rng, ELEMENTS) };
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
function mkRandom(el, rank, s, rng) { const k = rollKind(rng); return k === 'weapon' ? mkWeapon(el, rank, s, rng) : mkGear(k, el, rank, s, rng); }
// open a chest: random kind + rarity. G (optional) supplies GREED (+1 rarity chance). noCurse: bonus chests never curse.
function openChest(chest, rng, s = 0, G = null, noCurse = false, shift = 1) {
  const R = RULES, el = chest.element, dark = chest.type === 'dark';
  if (G && !noCurse) G.inf = el;   // the strike this stage is infused with the chosen chest's element
  if (dark && !noCurse && rng() < R.dark.curse) return mkCurse(el, s, rng);
  let rank = rollRank(s, rng, shift * (dark ? R.dark.shift : 1) * (isBig(s) ? R.bigRank : 1));
  let greedy = false;
  if (G && rank < 5 && rng() < stats(G.items).greed) { rank++; greedy = true; }
  const it = mkRandom(el, rank, s, rng); if (greedy) it.greedy = true;
  if (!dark && rng() < R.gem) it.gem = 1;
  return it;
}
// reward for overkilling a boss (q = damage / HP); a BIG BOSS always gives at least a bonus chest
function bonusDrop(dmg, hp, rng, s = 0, executed = false) {
  const B = RULES.bonus, el = pick(rng, ELEMENTS); let q = dmg / hp; if (!(q >= 1) && !executed) return null;
  if (isBig(s)) q = Math.max(q, B.chestAt);
  if (q < B.chestAt) return B.minor ? { tier: 'minor', item: openChest({ type: 'normal', element: el }, rng, s, null, true, 0.8) } : null;
  if (q < B.jackpotAt) return { tier: 'chest', item: openChest({ type: 'normal', element: el }, rng, s, null, true, 1.5) };
  return { tier: 'jackpot', item: openChest({ type: 'normal', element: el }, rng, s, null, true, B.jackpotShift) };
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
  const lv = {}; ELEMENTS.forEach((e) => { lv[e] = RULES.elem.at.filter((k) => cnt[e] >= k).length; });
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
  S.burn = E.Fire.burn[lv.Fire]; S.burnT = E.Fire.ticks[lv.Fire] + (lv.Fire >= 3 ? Math.floor((cnt.Fire - 9) / 3) : 0);
  S.vuln = E.Ice.vuln[lv.Ice]; S.critUp = E.Ice.crit[lv.Ice]; if (lv.Ice >= 3) S.critX += E.Ice.shatter;
  S.chance = E.Thunder.chance[lv.Thunder]; S.chains = E.Thunder.chains[lv.Thunder]; S.bolt = E.Thunder.bolt; S.storm = lv.Thunder >= 3;
  S.melt = lv.Fire >= 1 && lv.Ice >= 1; S.superconduct = lv.Ice >= 1 && lv.Thunder >= 1; S.overload = lv.Fire >= 1 && lv.Thunder >= 1;
  if (S.melt) S.burn *= C.melt;
  if (S.superconduct) S.critX *= C.superconduct;
  S.critX = Math.max(1, S.critX);
  return S;
}
const critOf = (it, S) => it && it.cursed ? 0 : Math.min(0.95, (it ? it.crit : RULES.hero.crit) + (it && it.element === 'Ice' ? S.critUp : 0));
const isEl = (it, e) => !!it && !it.cursed && it.element === e;
const elMul = (it, B) => !it || it.cursed || !B ? 1 : it.element === B.weak ? RULES.boss.weak : it.element === B.resist ? RULES.boss.resist : 1;
function hitters(G) {
  const off = offEls(G), list = G.items.filter((it) => it.cursed || !off.includes(it.element));
  return { list, S: stats(list), weapons: list.filter((it) => it.kind === 'weapon') };
}
const infMul = (G, B) => !B || !G.inf ? 1 : G.inf === B.weak ? RULES.boss.infWeak : G.inf === B.resist ? RULES.boss.infResist : 1;
const hitMul = (it, S, G, B) => (S.glob + G.perm) * (it && !it.cursed ? 1 + S.elemB[it.element] : 1) * S.vuln * weakMult(G) * elMul(it, B) * infMul(G, B);
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
  return capN(sum * (1 + (S.overload ? RULES.combos.overload : 0)) + Math.max(0, fire) * S.burn * S.burnT);
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
    hits.push({ it, echo: !!(h0 && h0.echo), v, crit, chain: ch, cv, el: elMul(it, B) }); sum = capN(Math.max(0, sum + v + cv)); if (isEl(it, 'Fire')) fire = capN(fire + v); if (crit) crits++; if (ch) chained++;
  });
  const boom = S.overload ? capN(sum * RULES.combos.overload) : 0;
  const tick = capN(fire * S.burn), ticks = S.burn > 0 ? Array.from({ length: S.burnT }, () => tick) : [];
  const burn = capN(tick * ticks.length), total = capN(sum + boom + burn);
  const executed = total < hp && S.execute > 0 && hp - total <= S.execute * hp;
  return { list, S, B, off, weak: weakMult(G), hits, nH, combo: cm, crits, chained, echoes, hit: sum, boom, burn, ticks, total, hp, executed, kill: total >= hp || executed };
}
// after a kill: OVERKILL CONVERSION turns part of the overkill into a permanent damage bonus (capped per kill)
function afterKill(G, r) { const S = r.S, q = r.total / r.hp; if (!(S.okConv > 0) || !(q > 1)) return 0; const g = S.okConv * Math.min(3, q - 1); G.perm += g; return g; }
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
  const Y = stats(items.filter((i) => !i.cursed || i.curse !== 'seal')), n = Y.cnt[el], lv = Y.lv[el], nx = RULES.elem.at[lv];
  const P = (x) => Math.round(x * 100);
  const fx = !lv ? t('synOff') : el === 'Fire' ? t('synFx').Fire(P(Y.burn), Y.burnT) : el === 'Ice' ? t('synFx').Ice(P(Y.vuln - 1), P(Y.critUp)) : t('synFx').Thunder(P(Y.chance), Y.chains);
  return [`${elName(el)} ${t('syn')[el]} · ${t('synLv', n, lv, nx)}`, fx + (lv >= 3 ? ' · ' + t('lv3')[el] : '')];
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
const PICK_GROUND = 542;   // top edge of the floor strip in bg_hoard (the hero stands on it on the pick screen)
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
    if (it.kind === 'gem') lines = [[t('gemT'), 26, '#e0b8ff'], [t('gemHeld', this.scene.G ? this.scene.G.gems : 0), 22, '#ffffff'], [t('gemDesc'), 18, '#d8ccff']];
    else if (it.kind === 'combo') lines = [[t('comboN')[it.combo], 26, it.on ? '#ffd84a' : '#a89ab8'], [t('comboD')[it.combo], 20, '#ffffff'], [it.on ? t('comboOn') : t('comboOff'), 17, it.on ? '#7aff8a' : '#c8b49a']];
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
function powerHud(scene, v) {
  const D = 70, x = 12, y = 10, w = 216, h = 62, mk = (o) => { o.__hud = true; return o; };
  if (!scene.uiCam || !scene.cameras.cameras.includes(scene.uiCam)) hudCamera(scene);
  const objs = [], add = (o) => { objs.push(o); return o; };
  add(panel(scene, x, y, w, h, { border: 0xffcf40, alpha: 0.92 }).setDepth(D));
  add(txt(scene, x + w / 2, y + 15, t('power'), 14, '#ffe8a0', { strokeThickness: 4, maxW: w - 16 }).setDepth(D + 1));
  const n = add(txt(scene, x + w / 2, y + 42, fmt(v), 30, '#ffd36a', { strokeThickness: 7, stroke: '#2a1404', maxW: w - 20 }).setDepth(D + 1));
  const hit = add(scene.add.rectangle(x + w / 2, y + h / 2, w, h, 0xffffff, 0.001).setDepth(D + 2).setData('item', true));
  objs.forEach((o) => { mk(o); o.cameraFilter &= ~scene.uiCam.id; scene.cameras.main.ignore(o); });   // only the UI camera draws the chip
  if (scene.openGear) hit.setInteractive({ useHandCursor: true }).on('pointerdown', () => { if (scene.statsLocked) return; if (scene.gearOpen && scene.gearPinned) scene.closeGear(); else scene.openGear(true); });
  scene.powPos = { x: x + w / 2, y: y + 42 }; window.DC.powerHud = { x: x + w / 2, y: y + 42, text: n.text };
  return n;
}
const GEM_ROW = { x: 1170, y: 482 };   // where a found PURIFY GEM flies to (the stats panel's gem row)
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

// the balance sim's 'smart' policy: all three elements to Lv1 (combos), then the nearest 3/6/9 threshold; take the boss weakness, avoid its resistance
function smartPick(off, G, s, rng = Math.random) {
  const S = stats(G.items), B = bossEl(s), allLv1 = ELEMENTS.every((e) => S.lv[e] >= 1); let best = null, bs = -1e9;
  for (const c of off) {
    const n = S.cnt[c.element]; let sc = 0;
    if (!allLv1 && S.lv[c.element] === 0) sc += 20 - (3 - n) * 2;
    const nxt = RULES.elem.at.find((k) => k > n); if (nxt) sc += Math.max(0, 8 - (nxt - n) * 2.5);
    if (B && c.element === B.weak) sc += 30; if (B && c.element === B.resist) sc -= 30;
    if (c.type === 'dark') sc += curses(G).length && !G.gems ? -30 : 5;
    sc += rng(); if (sc > bs) { bs = sc; best = c; }
  }
  return best;
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
// boss weakness / resistance: [WEAK icon] [RESISTS icon], centred at x
function weakResist(scene, x, y, B, size = 15, depth = 0) {
  if (!B) return [];
  const a = txt(scene, 0, y, t('weakT'), size, '#7aff8a', { strokeThickness: 4 }), b = txt(scene, 0, y, t('resistT'), size, '#ff8a7a', { strokeThickness: 4 });
  const ia = scene.add.image(0, y, 'el_' + B.weak).setScale(size / 6), ib = scene.add.image(0, y, 'el_' + B.resist).setScale(size / 6);
  const gap = 8, wI = ia.displayWidth, tot = a.width + gap / 2 + wI + 22 + b.width + gap / 2 + wI;
  let cx = x - tot / 2;
  a.setX(cx + a.width / 2); cx += a.width + gap / 2; ia.setX(cx + wI / 2); cx += wI + 22;
  b.setX(cx + b.width / 2); cx += b.width + gap / 2; ib.setX(cx + wI / 2);
  const o = [a, ia, b, ib]; if (depth) o.forEach((q) => q.setDepth(depth));
  window.DC.bossEl = { weak: B.weak, resist: B.resist };
  return o;
}
// NEXT boss preview (one stage ahead): name, BIG tag, weakness / resistance icons
function nextBossLine(scene, x, y, s, size = 14, depth = 0) {
  const n = s + 1, B = bossEl(n), big = isBig(n);
  const lab = txt(scene, 0, y, `${t('nextBoss')}: ${bossName(n)}${big ? ' · ' + t('bigBoss') : ''}`, size, big ? '#ffb08a' : '#c8b49a', { strokeThickness: 4, maxW: 380 });
  const o = [lab]; let w = lab.displayWidth;
  if (B) { const ia = scene.add.image(0, y, 'el_' + B.weak).setScale(size / 7), ib = scene.add.image(0, y, 'el_' + B.resist).setScale(size / 7);
    const ta = txt(scene, 0, y, '+', size, '#7aff8a', { strokeThickness: 3 }), tb = txt(scene, 0, y, '−', size, '#ff8a7a', { strokeThickness: 3 });
    o.push(ta, ia, tb, ib); w += 14 + ta.width + ia.displayWidth + 8 + tb.width + ib.displayWidth; }
  let cx = x - w / 2; lab.setX(cx + lab.displayWidth / 2); cx += lab.displayWidth + 14;
  for (let k = 1; k < o.length; k++) { const q = o[k], qw = q.displayWidth; q.setX(cx + qw / 2); cx += qw + (k === 2 ? 8 : 0); }
  if (depth) o.forEach((q) => q.setDepth(depth));
  window.DC.nextBoss = { name: bossName(n), big, weak: B && B.weak, resist: B && B.resist };
  return o;
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
  R.s = n; R.G.seenN = R.G.items.length; R.G.inf = null;
  return R;
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
    this.G.inf = null; this.B = bossEl(s);   // no infusion until a chest is picked
    // centred top HUD: STAGE on the left, boss + HP bar + weakness / resistance on the right, NEXT boss preview below
    panel(this, W / 2 - 300, 8, 600, 128, { border: big ? 0xff5a4a : undefined });
    const st = txt(this, W / 2 - 165, big ? 42 : 58, t('stageN', s + 1), 44, '#ffd36a', { strokeThickness: 10, stroke: '#1a0a04', maxW: 250 });
    window.DC.roundText = st.text;
    if (big) {
      const bb = txt(this, W / 2 - 165, 88, t('bigBoss'), 22, '#ff6a5a', { strokeThickness: 6, stroke: '#2a0404', maxW: 250 });
      this.tweens.add({ targets: bb, scale: 1.12, yoyo: true, repeat: -1, duration: 420 });
    }
    txt(this, W / 2 + 135, 30, bossName(s), 22, c.col, { strokeThickness: 5, maxW: 300 });
    this.add.rectangle(W / 2 + 135, 60, 280, 24, 0x220000).setStrokeStyle(3, 0xffd36a);
    this.add.rectangle(W / 2 - 3, 60, 276, 18, 0xd22a2a).setOrigin(0, 0.5);
    this.hpT = txt(this, W / 2 + 135, 60, `HP ${fmt(stageHp(s, this.G))}`, 17, '#ffffff', { strokeThickness: 4 });
    if (hasCurse(this.G, 'hpUp')) this.add.rectangle(W / 2 + 135, 60, 280, 24).setStrokeStyle(3, 0xff5a3a);
    this.elTags = weakResist(this, W / 2 + 135, 90, this.B, 15);
    nextBossLine(this, W / 2, 120, s, 14);
    this.prompt = txt(this, W / 2, 162, t('pickOne'), 38, '#ffffff', { strokeThickness: 8, maxW: 600 }).setAlpha(0);
    this.tip = new Tooltip(this, () => this.items);
    this.drawPower();
    this.offer = rollOffer(Math.random, s); window.DC.offer = this.offer.map((o) => o.type === 'dark' ? 'dark:' + o.element : o.element);
    const xs = [W / 2 - 270, W / 2, W / 2 + 270], base = 400;
    this.chests = this.offer.map((c, i) => {
      const x = xs[i];
      shadow(this, x, base, 160);
      const glow = this.add.circle(x, base - 80, 105, EL_COLOR[c.element], 0.16).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: glow, scale: 1.1, alpha: 0.26, yoyo: true, repeat: -1, duration: 900 + i * 120 });
      const dark = c.type === 'dark', B = this.B;
      const spr = this.add.image(x, base + 12, 'chest_' + chestKey(c)).setScale(5).setOrigin(0.5, 1);
      // the element emblem floats above the chest (a DARK chest shows its element too)
      const gem = this.add.image(x, base - 205, 'el_' + c.element).setScale(4.2);
      this.tweens.add({ targets: gem, y: base - 213, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.inOut' });
      const label = txt(this, x, base + 32, dark ? t('darkChest') : t('chestEl', elName(c.element)), 28, dark ? '#c9a6ff' : EL_CSS[c.element], { maxW: 250 });
      // infusion: this stage's strike takes the chest's element -> show what it does against this boss
      const iw = B && c.element === B.weak, ir = B && c.element === B.resist;
      const el = txt(this, x, base + 64, dark ? elName(c.element) + (iw ? '  ·  ' + t('infWeakTag', RULES.boss.infWeak) : ir ? '  ·  ' + t('infResTag', RULES.boss.infResist) : '')
        : iw ? t('infWeakTag', RULES.boss.infWeak) : ir ? t('infResTag', RULES.boss.infResist) : '·', iw || ir ? 22 : 18, iw ? '#7aff8a' : ir ? '#ff7a6a' : '#a89a8a', { maxW: 250 });
      if (iw) this.tweens.add({ targets: el, scale: 1.08, yoyo: true, repeat: -1, duration: 500 });
      if (dark) { const bh = txt(this, x, base + 92, t('darkHint'), 15, '#d9a6ff', { strokeThickness: 4, maxW: 240 }); el.on('destroy', () => bh.destroy()); this.tweens.add({ targets: bh, alpha: 0.55, yoyo: true, repeat: -1, duration: 700 }); }
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
      this.tweens.add({ targets: this.prompt, y: 156, yoyo: true, repeat: -1, duration: 420, ease: 'Sine.inOut' });
    });
    this.input.on('pointerdown', (p, over) => { if (this.canSkip && !over.some((o) => o.getData && o.getData('item'))) this.next(); });
  }
  // hero-side POWER: expected damage of the current gear (synergies + curses included). Not a promise - rolls, crits and chains vary.
  drawPower() {
    const hx = 120;
    this.hShadow = shadow(this, hx, PICK_GROUND - 2, 80);
    this.heroS = this.add.sprite(hx, PICK_GROUND, 'hero_idle').setScale(2.4).setOrigin(0.5, 1).play('hero-idle'); heroGlow(this.heroS);
    this.heroS.setDepth(12); this.hShadow.setDepth(12);
    this.gemObjs = [];
    this.statX = 1006; this.gx0 = 652;           // stats panel on the right; the GEAR list expands to its left
    this.setupGearInput();
    this.powV = this.pw();
    this.gearOpen = false; this.inv = []; this.seenN = this.G.seenN || 0;
    this.statObjs = []; this.drawStats(); this.powN = powerHud(this, this.powV); this.setPower(this.powV, false);
  }
  // HERO STATS: compact, always visible during the pick (right column, clear of the 3 chests); changed values flash
  drawStats() {
    (this.statObjs || []).forEach((o) => o.destroy()); const o = this.statObjs = [];
    if (this.statsHidden) return;
    const G = this.G, Y = stats(G.items), X = this.statX, Wd = 186, D = 14, add = (q) => { o.push(q.setDepth(D)); return q; };
    const rows = [];   // POWER itself is the fixed HUD chip (top-left), always on screen
    ELEMENTS.forEach((el) => { const lv = Y.lv[el], nx = RULES.elem.at[lv]; rows.push(['el' + el, elName(el), `${Y.cnt[el]}${nx ? '/' + nx : ''} · Lv${lv}`, lv ? '#ffffff' : EL_CSS[el], el]); });
    ['melt', 'superconduct', 'overload'].forEach((k) => rows.push(['c_' + k, t('comboN')[k], Y[k] ? t('comboOn') : '—', Y[k] ? '#7aff8a' : '#6a5a7a', null, k]));
    rows.push(['exec', t('stExec'), pct(Y.execute) + '%', Y.execute ? '#ff8ab0' : '#8a7a8a'], ['echo', t('stEcho'), pct(Y.echo) + '%', Y.echo ? '#ffffff' : '#8a7a8a'],
      ['greed', t('stGreed'), pct(Y.greed) + '%', Y.greed ? '#ffd84a' : '#8a7a8a'], ['perm', t('stPerm'), '+' + pct(G.perm) + '%', G.perm ? '#ffb0e0' : '#8a7a8a'],
      ['curse', t('stCurses'), String(curses(G).length), curses(G).length ? '#ff6a9a' : '#8a7a8a'], ['gems', t('stGems'), String(G.gems), G.gems ? '#e0b8ff' : '#8a7a8a', null, null, 'gem']);
    const rh = 24, y0 = 150, h = 62 + rows.length * rh;
    add(panel(this, X, y0, Wd, h, { border: 0xffcf40, alpha: 0.88 }));
    // the whole panel: hover (desktop) peeks the full GEAR list, tap pins / unpins it
    const hit = add(this.add.rectangle(X + Wd / 2, y0 + h / 2, Wd, h, 0xffffff, 0.001).setInteractive({ useHandCursor: true }).setData('item', true));
    hit.on('pointerover', (p) => { if (!p.wasTouch && !this.statsLocked) { this.hoverPow = true; this.openGear(false); } });
    hit.on('pointerout', (p) => { if (!p.wasTouch) { this.hoverPow = false; this.maybeCloseGear(); } });
    hit.on('pointerdown', () => { if (this.statsLocked) return; if (this.gearOpen && this.gearPinned) this.closeGear(); else this.openGear(true); });
    this.statBox = { x: X, y: y0, w: Wd, h };
    add(txt(this, X + Wd / 2, y0 + 18, t('statsT'), 16, '#ffd36a', { strokeThickness: 4, maxW: Wd - 12 }));
    add(txt(this, X + Wd / 2, y0 + h - 14, t('gearTap'), 12, '#c8b49a', { strokeThickness: 3, maxW: Wd - 12 }));
    const prev = G.statPrev || {}, cur = {};
    rows.forEach(([key, label, val, col, el, combo, gem], i) => {
      const y = y0 + 44 + i * rh, sep = i === 3 || i === 6;
      if (sep) add(this.add.rectangle(X + Wd / 2, y - rh / 2, Wd - 16, 1, 0xffcf40, 0.3));
      if (el) add(this.add.image(X + 16, y, 'el_' + el).setScale(1.5));
      const lt = add(this.add.text(X + (el ? 28 : 10), y, label, { fontFamily: FONT, fontSize: '14px', color: combo ? col : '#e8dcc8', fontStyle: 'bold', stroke: '#140812', strokeThickness: 3 }).setOrigin(0, 0.5));
      const vt = add(this.add.text(X + Wd - 10, y, val, { fontFamily: FONT, fontSize: key === 'power' ? '18px' : '14px', color: col, fontStyle: 'bold', stroke: '#140812', strokeThickness: 3 }).setOrigin(1, 0.5));
      fitText(vt, 84, key === 'power' ? 18 : 14); fitText(lt, Wd - 22 - vt.displayWidth - (el ? 18 : 0), 14);
      cur[key] = val;
      if (gem) { add(this.add.image(X + Wd - 26 - vt.displayWidth, y, 'gem').setScale(1.2)); this.tip.attach(add(this.add.rectangle(X + Wd / 2, y, Wd - 8, rh - 2, 0xffffff, 0.001).setData('row', true)), { kind: 'gem', rarity: 'EPIC', element: 'Ice', name: t('gemT') }); GEM_ROW.x = X + Wd - 16; GEM_ROW.y = y; }
      if (el || combo) this.tip.attach(add(this.add.rectangle(X + Wd / 2, y, Wd - 8, rh - 2, 0xffffff, 0.001).setData('row', true)), el ? { kind: 'syn', element: el, rarity: 'RARE', name: t('syn')[el] } : { kind: 'combo', combo, on: Y[combo], rarity: Y[combo] ? 'LEGENDARY' : 'COMMON', element: 'Fire', name: t('comboN')[combo] });
      if (prev[key] !== undefined && prev[key] !== val) { // changed since last shown: glow the row, pop the value
        const hl = add(this.add.rectangle(X + Wd / 2, y, Wd - 8, rh - 2, 0xffd36a, 0.4)); hl.setDepth(D - 0.5);
        this.tweens.add({ targets: hl, alpha: 0.08, yoyo: true, repeat: 2, duration: 380, onComplete: () => hl.setAlpha(0.14) });
        vt.setScale(1.4); this.tweens.add({ targets: vt, scale: 1, duration: 320, ease: 'Back.out' });
        window.DC.statChanged = (window.DC.statChanged || []).concat(key);
      }
    });
    G.statPrev = cur; window.DC.stats = cur;
  }
  drawGems() { this.drawStats(); }
  // shared pointer handling for the GEAR list (drag / wheel scroll, tap outside closes)
  setupGearInput() {
    this.input.on('pointerdown', (p, over) => { if (this.gearOpen && !over.length && !this.inPopup(p)) this.closeGear(); });
    this.input.on('pointermove', (p) => {
      if (this.drag && p.isDown) { const dy = p.worldY - this.drag.y; if (Math.abs(dy) > 6) this.drag.moved = true; if (this.drag.moved) { if (this.tip.visible) this.tip.hide(true); } if (this.drag.moved) this.scrollTo(this.drag.s0 - dy * (this.drag.thumb ? this.contentH / this.vh : 1)); }
      if (this.gearOpen && !this.gearPinned && !p.wasTouch) this.maybeCloseGear(0);
    });
    this.input.on('pointerup', () => { this.drag = null; });
    this.input.on('wheel', (p, over, dx, dy) => { if (this.gearOpen && this.inPopup(p)) this.scrollTo(this.scrollY + dy * 0.6); });
  }
  setPower(v, anim = true) {
    const cursed = curses(this.G).length > 0, col = cursed ? '#ff5a5a' : '#ffd36a', from = this.powShown || 0, up = v > from * 1.0001;
    this.powV = v; this.powN.setColor(col); window.DC.power = v;
    if (!anim || !this.powN) { this.powShown = v; if (this.powN) setFit(this.powN, fmt(v)); return; }
    const c = { v: from };
    this.tweens.add({ targets: c, v, duration: 650, ease: 'Cubic.out', onUpdate: () => { if (this.powN.active) setFit(this.powN, fmt(c.v)); }, onComplete: () => {
      this.powShown = v; if (!this.powN.active) return; setFit(this.powN, fmt(v));
      this.tweens.killTweensOf(this.powN); this.powN.setScale(up ? 1.45 : 0.8);
      this.tweens.add({ targets: this.powN, scale: 1, duration: 260, ease: 'Back.out' });
      if (up) { burst(this, this.powPos.x, this.powPos.y, 0xffcf40, 24, 220, 'px').setDepth(30); sfx(this, 'tick', 0.6); }
      else { this.cameras.main.shake(160, 0.006); }
    } });
  }
  // ---- gear popup: EVERY item (newest at the top), scrollable with wheel / drag / scrollbar; whole-row tooltips ----
  inPopup(p) { const g = this.gx0; return this.gearOpen && p.worldX >= g - 18 && p.worldX <= g + 316 && p.worldY >= 116 && p.worldY <= (this.popBottom || 610); }
  openGear(pin) {
    if (pin) this.gearPinned = true;
    if (this.peekT) { this.peekT.remove(); this.peekT = null; if (this.gearOpen) { this.gearOpen = false; this.inv.forEach((o) => o.destroy()); this.inv = []; } }
    if (this.gearOpen) return; this.gearOpen = true; this.renderGear(); window.DC.gearOpen = true;
  }
  maybeCloseGear(ms = 160) {
    this.time.delayedCall(ms, () => {
      if (this.gearPinned || !this.gearOpen || this.peekT || this.drag) return;
      const p = this.input.activePointer, B = this.statBox || { x: 0, y: 0, w: 0, h: 0 }, inPow = p.worldX >= B.x && p.worldX <= B.x + B.w && p.worldY >= B.y && p.worldY <= B.y + B.h;
      if (!this.inPopup(p) && !inPow) this.closeGear();
    });
  }
  closeGear() {
    this.gearOpen = false; this.gearPinned = false; if (this.peekT) { this.peekT.remove(); this.peekT = null; }
    this.inv.forEach((o) => o.destroy()); this.inv = []; this.rows = []; this.rowObjs = []; if (this.tip) this.tip.hide(true); window.DC.gearOpen = false;
  }
  // peek = a short auto-closing view right after a pick so the new item can be seen sliding in at the top
  renderGear(peek = false) {
    this.inv.forEach((o) => o.destroy()); this.inv = []; this.rows = []; this.rowObjs = [];
    if (!this.gearOpen) return;
    const x0 = this.gx0, G = this.G, D = 600, add = (o) => { this.inv.push(o); return o; };
    const items = [...G.items].reverse(), rowH = this.rowH = 37, top = 182;
    const fresh = Math.max(0, Math.min(3, items.length, G.items.length - this.seenN));   // at most the 3 newest slide in
    const vh = this.vh = peek ? Math.min(6, Math.max(1, items.length)) * rowH : 370, bottom = this.popBottom = top + vh + (peek ? 8 : 16);
    const bg = add(panel(this, x0 - 18, 116, 334, bottom - 116, { border: 0xffcf40, alpha: 0.96 }));
    const hit = add(this.add.rectangle(x0 + 149, (116 + bottom) / 2, 334, bottom - 116, 0xffffff, 0.001).setInteractive().setData('item', true));
    hit.on('pointerover', () => { this.hoverPop = true; }); hit.on('pointerout', () => { this.hoverPop = false; this.maybeCloseGear(); });
    hit.on('pointerdown', (p) => { this.drag = { y: p.worldY, s0: this.scrollY, moved: false }; });
    add(txt(this, x0 + 149, 134, t('gearT') + `  ${items.length}`, 20, '#ffd36a', { strokeThickness: 5, maxW: 300 }));
    const nc = curses(G).length;
    add(txt(this, x0 + 149, 156, t('gearCount', ofKind(G, 'weapon').filter((x) => !x.cursed).length, ofKind(G, 'armor').filter((x) => !x.cursed).length, ofKind(G, 'accessory').filter((x) => !x.cursed).length) + (nc ? ` · ${t('cursedN', nc)}` : ''), 13, nc ? '#ffb0d0' : '#c8b49a', { strokeThickness: 3, maxW: 310 }));
    // element levels, combos and key stats live in the compact stats panel next to this list (no duplicates here)
    const Y = stats(G.items); window.DC.combosOn = ['melt', 'superconduct', 'overload'].filter((c) => Y[c]);
    add(this.add.rectangle(x0 + 149, top - 8, 310, 2, 0xffcf40, 0.4));
    // the list lives in a masked container; rows outside the viewport are not interactive
    const list = this.listC = add(this.add.container(0, top));
    const mg = this.make.graphics({ add: false }); mg.fillStyle(0xffffff).fillRect(x0 - 16, top, 330, vh); this.inv.push(mg);
    list.setMask(mg.createGeometryMask());
    items.forEach((it, i) => this.addInvRow(list, i * rowH + rowH / 2, it, i < fresh));
    this.contentH = items.length * rowH; this.scrollY = 0; this.listTop = top;
    // scrollbar
    if (this.contentH > vh) {
      add(this.add.rectangle(x0 + 309, top + vh / 2, 6, vh, 0xffffff, 0.12));
      const th = Math.max(24, vh * vh / this.contentH);
      this.thumb = add(this.add.rectangle(x0 + 309, top + th / 2, 8, th, 0xffcf40, 0.8).setInteractive({ useHandCursor: true }).setData('item', true));
      this.thumb.on('pointerdown', (p) => { this.drag = { y: p.worldY, s0: this.scrollY, moved: true, thumb: true }; });
      this.thumbH = th;
    } else this.thumb = null;
    // new items: slide in at the top with a highlight; the older rows shift down into place
    if (fresh) {
      this.rowObjs.forEach((r) => {
        if (r.i < fresh) { r.c.x = -330; r.c.alpha = 0; this.tweens.add({ targets: r.c, x: 0, alpha: 1, delay: 120 + r.i * 90, duration: 380, ease: 'Back.out' }); }
        else { r.c.y -= fresh * rowH; this.tweens.add({ targets: r.c, y: r.c.y + fresh * rowH, delay: 60, duration: 360, ease: 'Cubic.out' }); }
      });
      window.DC.slideIn = (window.DC.slideIn || 0) + fresh;
    }
    this.seenN = this.G.seenN = G.items.length;
    this.inv.forEach((o) => { if (o.depth < D) o.setDepth(D + (o === bg ? 0 : 1)); });
    this.updateRowInput();
    window.DC.bagRows = this.rows; window.DC.gear = gearSummary(G); window.DC.gearScroll = { y: 0, max: Math.max(0, this.contentH - vh), vh, rows: items.length };
  }
  addInvRow(list, y, it, fresh) {
    const x0 = this.gx0, bx = 32, c = this.add.container(0, y), rH = this.rowH;
    // the WHOLE row (icon + name + numbers) is the hover / tap target; height rowH-2 so neighbouring rows never overlap
    const row = this.add.rectangle(x0 + 147, 0, 296, rH - 2, 0xffffff, 0.001).setData('row', true);
    this.tip.attach(row, it);
    row.on('pointerdown', (p) => { this.drag = { y: p.worldY, s0: this.scrollY, moved: false }; });
    const parts = [row];
    if (it.cursed) parts.push(this.add.rectangle(x0 + 147, 0, 296, rH - 4, 0x3a0a4a, 0.55));
    if (fresh) { const hl = this.add.rectangle(x0 + 147, 0, 296, rH - 4, 0xffe6a0, 0.35).setStrokeStyle(2, 0xffd36a); parts.push(hl); this.tweens.add({ targets: hl, alpha: 0, delay: 1300, duration: 900 }); }
    parts.push(this.add.rectangle(x0 + 21, 0, bx, bx, itemCol(it), 0.3).setStrokeStyle(2, RARITY[it.rarity].col));
    const ic = this.add.image(x0 + 21, 0, 'icons', it.frame).setScale(0.86); if (it.cursed && it.kind === 'weapon') ic.setTint(0xb070ff); parts.push(ic);
    parts.push(clipText(this.add.text(x0 + 44, -15, it.name, { fontFamily: FONT, fontSize: '14px', color: it.cursed ? '#d9a6ff' : RARITY[it.rarity].css, fontStyle: 'bold' }), fresh ? 210 : 250));
    const rt = this.add.text(x0 + 44, 1, ruleText(it), { fontFamily: FONT, fontSize: '14px', color: ruleCol(it) });
    fitText(rt, 250, 14); parts.push(rt);
    if (fresh) parts.push(txt(this, x0 + 278, -9, t('newTag'), 12, '#1a0a04', { strokeThickness: 0 }).setBackgroundColor('#ffd36a').setPadding(3, 1, 3, 1));
    c.add(parts); list.add(c);
    this.rowObjs.push({ c, row, y, i: this.rowObjs.length });
    this.rows.push({ x: x0 + 147, y: this.listTop + y, w: 296, h: rH - 2, kind: it.kind, cursed: !!it.cursed });
  }
  scrollTo(v) {
    if (!this.gearOpen || !this.listC) return;
    const max = Math.max(0, this.contentH - this.vh); this.scrollY = Phaser.Math.Clamp(v, 0, max);
    this.listC.y = this.listTop - this.scrollY;
    if (this.thumb) this.thumb.y = this.listTop + this.thumbH / 2 + (this.vh - this.thumbH) * (max ? this.scrollY / max : 0);
    this.updateRowInput();
    window.DC.gearScroll = { y: this.scrollY, max, vh: this.vh, rows: this.rowObjs.length };
  }
  updateRowInput() { // only rows inside the viewport take the pointer (the mask hides the rest)
    (this.rowObjs || []).forEach((r) => {
      const yy = this.listTop - (this.scrollY || 0) + r.y, vis = yy > this.listTop - 2 && yy < this.listTop + this.vh + 2;
      if (r.row.input) r.row.input.enabled = vis;
      r.vy = yy;
    });
    this.rows = (this.rowObjs || []).filter((r) => r.row.input && r.row.input.enabled).map((r) => ({ x: r.row.x, y: r.vy, w: 296, h: this.rowH - 2 }));
    window.DC.bagRows = this.rows;
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
    this.chests.forEach((o, j) => { o.zone.disableInteractive(); o.sp.stop(); if (j !== i) this.reject(o); });
    sfx(this, 'click');
    const raw = this.forcedItem(ch) || openChest(ch.c, Math.random, this.s, this.G);
    this.G.inf = ch.c.element;   // INFUSION: this stage's strike takes the chosen chest's element
    window.DC.inf = { el: ch.c.element, mult: infMul(this.G, this.B) };
    const it = nameItem(raw);
    const tier = it.rarity, R = RARITY[tier], big = BIG_R[tier], leg = LEG_R[tier];
    window.DC.reveal = { rarity: tier, stage: 'anticipation' };
    const im = infMul(this.G, this.B);
    if (im !== 1) {
      const il = txt(this, 130, 288, t('infPop', elName(ch.c.element), im), 24, im > 1 ? '#7aff8a' : '#ff7a6a', { strokeThickness: 6, maxW: 240 }).setDepth(41);
      popText(this, il, 1); this.tweens.add({ targets: il, alpha: 0, y: il.y - 20, delay: 1400, duration: 400, onComplete: () => il.destroy() });
    }
    this.tweens.killTweensOf([ch.spr, ch.glow]); ch.spr.setScale(5).setDepth(11); ch.glow.setDepth(11);
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
    ch.spr.setTexture('open_' + chestKey(ch.c));
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
        const label = tier === 'MYTHIC' ? t('banMyth') : leg ? t('banLeg') : t('banEpic'), size = leg ? 66 : 70;
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
      const t1 = txt(this, 40, -36, it.name, 28, it.cursed ? '#d9a6ff' : EL_CSS[it.element], { maxW: 480 });
      const t2 = txt(this, 0, 2, ruleText(it), 32, ruleCol(it), { maxW: 620 });
      const t3 = txt(this, 0, 38, ev.type === 'curse' ? `${evText(ev)}  ${t('curseNote')}` : it.kind === 'weapon' ? `${evText(ev)}  ·  ${t('wNote')}` : `${evText(ev)}  ·  ${t('noCrit')}`, 20, EV_CSS[ev.type], { strokeThickness: 4, maxW: 630 });
      card.add([pg, tag, t1, t2, t3]); card.setAlpha(0);
      if (it.greedy) { const gt = txt(this, 250, -38, t('greedPop'), 15, '#ffd84a', { strokeThickness: 4, maxW: 150 }); card.add(gt); window.DC.greedy = (window.DC.greedy || 0) + 1; }
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
    const tx = this.powPos.x, ty = this.powPos.y, col = EV_COL[ev.type];
    const fly = this.add.image(icon.x, icon.y, 'icons', it.frame).setScale(2).setDepth(40); if (it.cursed) fly.setTint(0xb070ff);
    this.tweens.add({ targets: fly, x: tx, y: ty, scale: 0.5, alpha: 0.3, duration: 420, ease: 'Quad.in', onComplete: () => {
      fly.destroy(); burst(this, tx, ty, col, N(20), 200, 'px').setDepth(40);
      const lab = txt(this, this.statX + 93, 136, evText(ev), 22, EV_CSS[ev.type], { strokeThickness: 6, maxW: 240 }).setDepth(41);
      popText(this, lab, 1); sfx(this, ev.type === 'curse' ? 'curse' : 'tick', 0.55);
      this.tweens.add({ targets: lab, y: lab.y - 30, alpha: 0, delay: 1100, duration: 400, onComplete: () => lab.destroy() });
      const after = () => {
        this.drawGems();
        this.hpT.setText(`HP ${fmt(stageHp(this.s, this.G))}`).setColor(hasCurse(this.G, 'hpUp') ? '#ffb0a0' : '#ffffff');
        this.setPower(this.pw()); this.drawStats();
      };
      after();
      if (ev.gem) { // the gem pops out of the item and flies to its counter
        const g = this.add.image(icon.x, icon.y, 'gem').setScale(3).setDepth(42);
        const gl = txt(this, icon.x, icon.y - 60, t('evGem'), 22, EV_CSS.gem, { strokeThickness: 6, maxW: 300 }).setDepth(42);
        popText(this, gl, 1); sfx(this, 'rare', 0.6);
        this.tweens.add({ targets: gl, alpha: 0, y: gl.y - 24, delay: 1100, duration: 400, onComplete: () => gl.destroy() });
        this.tweens.add({ targets: g, x: GEM_ROW.x, y: GEM_ROW.y, scale: 1.6, duration: 520, delay: 200, ease: 'Quad.in', onComplete: () => { g.destroy(); burst(this, GEM_ROW.x, GEM_ROW.y, 0xd08aff, N(16), 160, 'px').setDepth(42); } });
      }
      ev.purified.forEach((p, k) => this.time.delayedCall((ev.gem ? 760 : 380) + k * 500, () => { purifyFx(this, p, this.statX + 93, 300, 60); after(); }));
      // peek: the list opens briefly so the new item slides in at the top (a pinned / hovered list just re-renders)
      if (this.gearOpen) this.renderGear();
      else if (!this.done) {
        this.gearOpen = true; this.renderGear(true); window.DC.gearPeek = true;
        this.peekT = this.time.delayedCall(PEEK_MS, () => { this.peekT = null; if (!this.gearPinned && !this.hoverPow && !this.hoverPop) this.closeGear(); });
      }
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
  init(d) { this.run = d.run; this.s = this.run.s; this.gone = false; this.uiCam = null; }
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
    weakResist(this, 330, 334, bossEl(s), 18);
    txt(this, 330, 368, t('introLine'), 26, '#ffffff', { maxW: 600 });
    powerHud(this, expStrike(G, bossEl(s), s));
    const n = gearList(G).length;
    txt(this, 330, 404, n ? t('gearLine', n) : t('gear0'), 22, '#b8f0a0', { strokeThickness: 4, maxW: 600 });
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
    res.ratio = res.total / this.hpMax; res.L = res.executed ? 1 : okLevel(res.total, this.hpMax); res.hp = this.hpMax;
    res.inf = infMul(this.G, res.B);
    window.DC.result = { total: res.total, hp: this.hpMax, L: res.L, ratio: res.ratio, hits: res.hits.length, crits: res.crits, chained: res.chained, drains: res.hits.filter((h) => h.v < 0).length, weak: res.weak, vuln: res.S.vuln, burn: res.burn, ticks: res.ticks.length, off: res.off, power: expStrike(this.G, res.B, s), weaponCrits: res.hits.map((h) => (h.it ? h.it.crit : RULES.hero.crit)),
      combo: res.combo, echoes: res.echoes, boom: res.boom, executed: res.executed, kill: res.kill, inf: res.inf, melt: res.S.melt, superconduct: res.S.superconduct, overload: res.S.overload, execLine: res.S.execute };
    this.tip = new Tooltip(this, () => this.items);
    const c = this.cfg;
    this.bShadow = shadow(this, c.x, LAVA_GROUND, c.body[1] * c.scale * 1.05);
    this.hShadow = shadow(this, 270, LAVA_GROUND, 90);
    this.boss = this.add.sprite(c.x, LAVA_GROUND, c.tex).setScale(c.scale).setOrigin(0.5, 1).play(c.anim);
    this.untint();
    this.hero = this.add.sprite(270, LAVA_GROUND, 'hero_idle').setScale(3).setOrigin(0.5, 1).play('hero-idle');
    heroGlow(this.hero);
    panel(this, 640, 14, 440, 166, { border: c.big ? 0xff5a4a : undefined });
    weakResist(this, 860, 158, bossEl(s), 15);
    // execute line marker on the HP bar
    if (this.execL0 = executeLine(this.G)) { const ex = 662 + 396 * this.execL0; this.add.rectangle(ex, 120, 3, 34, 0xff4a8a).setDepth(5); txt(this, ex, 98, t('execLine', pct(this.execL0)), 12, '#ff8ab0', { strokeThickness: 3 }).setDepth(5); }
    txt(this, 860, 40, c.big ? `${t('stageN', s + 1)}  ·  ${t('bigBoss')}` : t('stageN', s + 1), 20, c.big ? '#ff8a6a' : '#ffd36a', { strokeThickness: 4, maxW: 400 });
    txt(this, 860, 76, bossName(s), 30, c.col, { maxW: 410 });
    this.add.rectangle(860, 120, 400, 28, 0x220000).setStrokeStyle(3, 0xffd36a);
    this.hp = this.add.rectangle(662, 120, 396, 22, 0xd22a2a).setOrigin(0, 0.5);
    this.hpText = txt(this, 860, 120, `${fmt(this.hpMax)} / ${fmt(this.hpMax)}`, 20);
    this.dbObjs = [];
    // the compact stats panel (left) stays usable until STRIKE is pressed; tap / hover opens the full GEAR list beside it
    this.statX = 12; this.gx0 = 222; this.inv = []; this.gearOpen = false; this.seenN = this.G.seenN = this.G.items.length; this.statObjs = [];
    this.powV = this.pw(); this.setupGearInput(); this.drawStats(); this.powN = powerHud(this, this.powV); this.setPower(this.powV, false);
    this.ready = txt(this, 420, 190, t('ready', this.items.length), 28, '#ffffff', { maxW: 400 });
    this.btn = button(this, 420, 262, t('strike'), () => this.strike(), 240);
    window.DC.phase = 'strike-ready';
  }
  // camera shake budget: crits share one rate limit (~1 per 400ms); punch() = the big finishing shake (never stacks closer than 400ms either)
  critShake(i) { const now = this.time.now; if (now - (this.lastShake || -1e9) < 400) return false; this.lastShake = now; this.cameras.main.shake(140, i); window.DC.shakes = (window.DC.shakes || 0) + 1; return true; }
  punch(i, d) { const now = this.time.now; if (now - (this.lastPunch || -1e9) < 400) return; this.lastPunch = this.lastShake = now; this.cameras.main.shake(d, i, true); window.DC.shakes = (window.DC.shakes || 0) + 1; window.DC.punches = (window.DC.punches || 0) + 1; }
  // boss knockback: an offset that decays every frame (no stacking tweens, never drifts)
  recoil(a) { this.rc = Phaser.Math.Clamp((this.rc || 0) + a, -14, 34); }
  recoilKick() { if (!this.boss || !this.boss.active) return; this.tweens.add({ targets: this.boss, x: this.cfg.x + 40, yoyo: true, duration: 120, ease: 'Quad.out' }); }
  update() { // shadows stay glued to the feet
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
    if (this.gearOpen) this.closeGear(); this.statsLocked = true; this.statsHidden = true;
    this.statObjs.forEach((o) => this.tweens.add({ targets: o, alpha: 0, duration: 180, onComplete: () => o.destroy() })); this.statObjs = [];
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
    this.recoil(22); this.recoilOn = true;
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
    // the strike plays as a volley: curse / frostbite notes first, then EVERY hit on its own (the hero, then each weapon with
    // its own roll and its own crit), THUNDER chains on the hits that fork, and FIRE burn ticks last. The whole volley is
    // squeezed into ~3s: the cadence speeds up with more weapons and above 15 hits the pops are batched.
    const steps = [];
    if (r.inf !== 1) steps.push({ kind: 'inf', v: r.inf, el: this.G.inf });
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
      const lim = Math.min(1.9, 440 / Math.max(1, this.dmg.width)); if (this.dmg.scaleX > lim) { this.dmg.setScale(lim); this.dmgScale = Math.min(this.dmgScale, lim); }
      const left = this.execd ? 0 : Math.max(0, this.hpMax - v);
      this.hp.width = 396 * left / this.hpMax; this.hpText.setText(`${fmt(left)} / ${fmt(this.hpMax)}`);
      while (next <= L && v >= OK_TIERS[next].at * this.hpMax) { this.pulse(next, v); next++; }
    };
    // hit counter: "x37 HITS"
    this.hitsT = txt(this, TX, TY - 108, ' ', 28, '#ffe066', { strokeThickness: 6, stroke: '#2a1404', maxW: 320 }).setDepth(46);
    window.DC.popped = 0; this.burnI = 0; this.lastTick = 0;
    let shown = 0;
    const runStep = (k) => {
      if (k >= steps.length) return this.afterCount(r, show, () => next);
      const s = steps[k], K = s.kind;
      if (K === 'hit' || K === 'batch') {
        (K === 'hit' ? [s.h] : s.hs).forEach((h) => { sum = capN(Math.max(0, sum + h.v + h.cv)); });
        hitsDone += K === 'hit' ? 1 : s.hs.length;
        setFit(this.hitsT, r.combo > 1.005 ? t('hitsCombo', hitsDone, (1 + r.S.combo * (hitsDone - 1)).toFixed(2)) : t('hits', hitsDone)); this.tweens.killTweensOf(this.hitsT); this.hitsT.setScale(1.3); this.tweens.add({ targets: this.hitsT, scale: 1, duration: 120 });
      } else if (K === 'burn') burn += s.v;
      else if (K === 'boom') sum = capN(sum + s.v);
      if (K === 'exec') { this.executeFx(r); window.DC.popped = k + 1; this.time.delayedCall(900, () => runStep(k + 1)); return; }
      const target = k === steps.length - 1 || steps[k + 1] && steps[k + 1].kind === 'exec' && k === steps.length - 2 ? r.total : capN(sum + burn);
      this.popNumber(s, k);
      window.DC.popped = k + 1;
      const c = { v: shown }, gap = K === 'burn' ? 230 : K === 'hit' || K === 'batch' ? hitGap : K === 'boom' || K === 'melt' || K === 'inf' ? 420 : 230;
      this.tweens.add({ targets: c, v: target, duration: gap * 0.8, ease: 'Cubic.out', onUpdate: () => show(c.v), onComplete: () => { shown = target; show(target); } });
      this.time.delayedCall(gap, () => runStep(k + 1));
    };
    this.time.delayedCall(260, () => runStep(0));
    this.tweens.add({ targets: this.hero, x: hd.x - 300, duration: 500, delay: 300, ease: 'Quad.out' });
  }
  // one floating number bursting out of the boss (a hit, a batch of hits, a burn tick or a curse / frostbite note)
  popNumber(s, k) {
    const hd = this.head(), K = s.kind, fast = K === 'hit' || K === 'batch';
    let x = hd.x + Phaser.Math.Between(-110, 110), y = hd.y - 20 + Phaser.Math.Between(-70, 50);
    if (K === 'burn') { const bi = this.burnI = (this.burnI || 0) + 1; x = Math.max(800, hd.x + 30); y = hd.y + 30 - (bi - 1) * 46; }
    if (!fast) { x = hd.x + ((k % 3) - 1) * 70; y = hd.y - 40 - (k % 2) * 50; }
    let label, col, size, neg = false, crit = false, chain = 0, cv = 0;
    if (K === 'hit') {
      const h = s.h; neg = h.v < 0; crit = h.crit; chain = h.chain; cv = h.cv;
      label = neg ? '−' + fmt(-h.v) : fmt(h.v); col = neg ? '#c890ff' : crit ? '#ffd23a' : h.it ? EL_CSS[h.it.element] : '#ffffff';
      size = crit ? 46 : neg ? 30 : 28;
      if (h.echo) { label = t('echoTag') + ' ' + label; window.DC.echoPopped = (window.DC.echoPopped || 0) + 1; }
      if (crit && this.res.S.superconduct && !this.scShown) { this.scShown = true; this.comboPop(t('scPop'), '#9ae8ff', 0x8ae2ff); }
    } else if (K === 'batch') {
      const v = s.hs.reduce((a, h) => a + h.v + h.cv, 0); crit = s.hs.some((h) => h.crit); chain = s.hs.reduce((a, h) => a + h.chain, 0); neg = v < 0;
      label = (neg ? '−' + fmt(-v) : fmt(v)) + ` ×${s.hs.length}`; col = neg ? '#c890ff' : crit ? '#ffd23a' : '#ffffff'; size = crit ? 40 : 30;
    }
    else if (K === 'seal') { label = t('sealPop', elName(s.el)); col = '#c8a0ff'; size = 30; }
    else if (K === 'inf') { label = t('infPop', elName(s.el), s.v); col = s.v > 1 ? '#7aff8a' : '#ff7a6a'; size = 38; }
    else if (K === 'boom') { label = t('overloadPop', fmt(s.v)); col = '#ffb04a'; size = 40; this.comboPop(t('comboN').overload + '!', '#ffb04a', 0xffa040); }
    else if (K === 'melt') { this.comboPop(t('meltPop'), '#ff9a6a', 0xff7a3a); return; }
    else if (K === 'weak') { label = t('cur').weak(P100(1 - s.v)); col = '#ff7a9a'; size = 32; }
    else if (K === 'vuln') { label = t('vulnPop', fmtX(s.v)); col = '#9ae8ff'; size = 40; }
    else { label = t('burnPop', fmt(s.v)) + (s.n > 1 ? ` ×${s.n}` : ''); col = '#ff9a4a'; size = 34; }
    this.elemFx(s, crit, chain);
    if (neg) window.DC.drainPopped = (window.DC.drainPopped || 0) + 1;
    const fl = txt(this, x, y, label, size, col, { strokeThickness: Math.max(5, size / 6) }).setDepth(44);
    fl.setScale(0.3);
    this.tweens.add({ targets: fl, scale: 1, duration: fast ? 90 : 140, ease: 'Back.out' });
    const life = fast ? Math.max(380, Math.min(700, 2600 / Math.max(1, this.res.hits.length) * 4)) : 700;
    this.tweens.add({ targets: fl, y: y - (K === 'burn' ? 40 : 70), alpha: { from: 1, to: 0 }, delay: fast ? 200 : 260, duration: life, ease: 'Quad.in', onComplete: () => fl.destroy() });
    if (crit && K === 'hit') { const ct = txt(this, x, y - size * 0.75, t('critHit'), 18, '#fff2a0', { strokeThickness: 4 }).setDepth(44); this.tweens.add({ targets: ct, alpha: 0, y: ct.y - 50, delay: 260, duration: life, onComplete: () => ct.destroy() }); }
    if (chain && K === 'hit' && cv) { const cl = txt(this, x + 60, y + 30, `${t('chainHit', chain)} +${fmt(cv)}`, 20, '#ffe866', { strokeThickness: 5 }).setDepth(44); this.tweens.add({ targets: cl, alpha: 0, y: cl.y - 40, delay: 300, duration: life, onComplete: () => cl.destroy() }); }
    // the boss flinches with every number (light on fast volleys)
    this.boss.setTint(neg ? 0xc090ff : 0xffd0b0); this.time.delayedCall(60, () => this.untint());
    this.recoil(neg ? -5 : crit ? 14 : fast ? 5 : 9);   // local boss knockback instead of a camera shake
    const BC = { vuln: 0x6ad8ff, burn: 0xff7a2a };
    const bc = neg ? CURSE_COL : crit ? 0xffd23a : BC[K] || (K === 'hit' && s.h.it ? EL_COLOR[s.h.it.element] : 0xffffff);
    burst(this, x, y, bc, Math.max(3, Math.round((crit ? 18 : 8) * this.lite())), 220, 'px').setDepth(43);
    // sound: crits always ring; normal hits tick at most every ~90ms so long volleys stay clean
    const now = this.time.now;
    if (crit) { sfx(this, 'hit', 0.55); sfx(this, 'banner', 0.25); }
    else if (neg || K === 'seal' || K === 'weak') sfx(this, 'curse', 0.35);
    else if (now - this.lastTick > 90) { sfx(this, K === 'vuln' ? 'banner' : 'tick', 0.45); this.lastTick = now; }
  }
  // dual-element combo callout (MELT / SUPERCONDUCT / OVERLOAD): a banner under the hit counter
  comboPop(label, css, col) {
    const hd = this.head(), y = 236 + (this.comboN || 0) * 44; this.comboN = (this.comboN || 0) + 1;
    const c = txt(this, Phaser.Math.Clamp(hd.x, 760, 1000), y, label, 34, css, { strokeThickness: 8, stroke: '#1a0804', maxW: 420 }).setDepth(48);
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
      this.punch(0.024, 420); this.hitStop(110); sfx(this, 'hit', 0.9); sfx(this, 'shatter', 0.5);
      this.tweens.add({ targets: line, alpha: 0, duration: 500, onComplete: () => line.destroy() });
      this.hp.width = 0; this.hpText.setText(`0 / ${fmt(this.hpMax)}`);
    } });
    const ex = txt(this, Phaser.Math.Clamp(hd.x, 760, 980), Math.max(250, hd.y - 110), t('execPop'), 64, '#ff4a7a', { strokeThickness: 12, stroke: '#2a0410', maxW: 520 }).setDepth(49);
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
    if (s.kind === 'inf') { const c = EL_COLOR[s.el]; this.ring(hd.x, hd.y, c, 8, s.v > 1 ? 6 : 3); burst(this, hd.x, hd.y, c, N(s.v > 1 ? 30 : 12), 260, 'spark').setDepth(42); return; }
    if (s.kind === 'boom') { // OVERLOAD: fire + lightning explosion rings
      this.ring(hd.x, hd.y, 0xffa040, 12, 9); this.ring(hd.x, hd.y, 0xffe04a, 6, 12, 120);
      burst(this, hd.x, hd.y, 0xff7a2a, N(50), 420).setDepth(42); burst(this, hd.x, hd.y, 0xffe04a, N(30), 360, 'spark').setDepth(42);
      sfx(this, 'boom', 0.7); this.recoil(30); this.critShake(0.008); return;
    }
    // weapon hits: a gold crescent + kick on a crit, THUNDER bolts on a chain (both rate-limited on long volleys)
    if (crit && now - (this.lastCritFx || 0) > (many ? 160 : 60)) {
      this.lastCritFx = now; this.slash(hd.x + Phaser.Math.Between(-40, 40), hd.y + Phaser.Math.Between(-30, 30), many ? 0.9 : 1.2, 0xffd23a);
      if (this.critShake(many ? 0.006 : 0.009) && !many) this.hitStop(45);
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
    if (L >= 1 && !r.executed) { this.punch(Math.min(0.03, 0.014 + 0.004 * L), 380 + 60 * L); this.recoilKick(); }
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
      sfx(this, 'hit', 1); sfx(this, 'banner', 0.5); this.recoil(18);
      this.hp.setFillStyle(0xffffff); this.time.delayedCall(90, () => this.hp.setFillStyle(0xd22a2a));
      this.boss.setTint(0xff6a5a); this.time.delayedCall(120, () => this.untint());
      burst(this, hd.x, hd.y, T.col, N(40), 380).setDepth(41);
      return;
    }
    // L >= 2: overkill tiers
    sfx(this, T.snd, 0.75 + 0.08 * L); if (L >= 3) sfx(this, 'hit', 1);
    this.hitStop(T.stop); this.recoil(16 + L * 3);
    this.critShake(Math.min(0.012, T.shake * 0.25));   // tier-ups mid-volley: a short kick, same rate limit
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
      const lbl = txt(this, this.TX, this.TY + 130, r.executed ? t('execPop') : L === 1 ? t('kill') : t('notEnough', fmt(r.total), fmt(this.hpMax)), L === 1 ? 46 : 30, OK_TIERS[L].css, { strokeThickness: 8, maxW: 600 }).setDepth(47);
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
      this.punch(0.026, 600);
      this.ring(hd.x, hd.y - 20, OK_TIERS[L].col, 14, 14, 0, 800);
      this.shatter(L >= 4 ? 9 : 6, L >= 4 ? 7 : 5, L >= 5 ? 640 : L === 4 ? 520 : 360);
      for (let k = 0; k < 3 + L; k++) this.time.delayedCall(k * 110, () => burst(this, hd.x + Phaser.Math.Between(-120, 120), hd.y + Phaser.Math.Between(-60, 80), k % 2 ? 0xff7a2a : OK_TIERS[L].col, N(40), 420).setDepth(41));
      window.DC.blownApart = true;
    } else { // falls / gets knocked back
      sfx(this, 'win');
      for (let k = 0; k < 4; k++) this.time.delayedCall(k * 150, () => burst(this, hd.x - 40 + k * 50, LAVA_GROUND - 100, 0xffcf40, N(40), 380));
      this.boss.setTint(0x777777);
      if (L === 2) this.tweens.add({ targets: this.boss, x: this.boss.x + 180, angle: 18, alpha: 0, scaleY: this.cfg.scale * 0.8, duration: 900, ease: 'Cubic.in' });
      else this.tweens.add({ targets: this.boss, alpha: 0, scaleY: this.cfg.scale * 0.8, duration: 1000, ease: 'Cubic.in' });
      this.tweens.add({ targets: this.bShadow, alpha: 0, duration: 1000 });
    }
    this.record(r, false);
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
    this.tweens.add({ targets: [this.dmg, this.br, this.okT, this.rays, this.dmgLabel, this.hitsT].filter(Boolean), alpha: 0, duration: 250 });
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
    const g = afterKill(this.G, this.res);   // OVERKILL CONVERSION -> permanent damage bonus
    if (g > 0) {
      const pp = txt(this, W / 2, 352, t('permPop', pct(g)), 30, '#ffb0e0', { strokeThickness: 7, maxW: 600 }).setDepth(60);
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
    const it = nameItem(b.item); it.bonus = b.tier;
    const R = RARITY[it.rarity], leg = LEG_R[it.rarity], jack = b.tier === 'jackpot';
    window.DC.phase = 'bonus'; window.DC.bonus = { tier: b.tier, type: b.type, name: it.name, rule: ruleText(it), rarity: it.rarity };
    this.log[this.log.length - 1].bonus = b.tier;
    // centred reveal: dim the arena, the clear banner steps aside, the chest pops open mid-screen, a big item card below
    const X = W / 2;
    (this.clearTxt || []).forEach((o) => this.tweens.add({ targets: o, alpha: 0, duration: 250 }));
    const dimR = this.add.rectangle(-100, -100, W + 200, H + 200, 0x05030a, 1).setOrigin(0).setDepth(60.5).setAlpha(0);
    this.tweens.add({ targets: dimR, alpha: 0.55, duration: 300 });
    const title = txt(this, X, 62, t('bonusTitle'), 40, '#ffd36a', { strokeThickness: 8, stroke: '#4a2400', maxW: 560 }).setDepth(62);
    popText(this, title, 1); sfx(this, 'banner', 0.7);
    const tier = txt(this, X, 100, t('bonusTier')[b.tier], 24, jack ? '#ffcf40' : b.tier === 'chest' ? '#d58cff' : '#e8dcff', { strokeThickness: 5, maxW: 560 }).setDepth(62);
    tier.setAlpha(0); this.tweens.add({ targets: tier, alpha: 1, duration: 200, delay: 150 });
    const CX = X, IX = X, CY = 330; // chest mid-screen, the item rises above it
    const ch = this.add.image(CX, -60, 'chest_' + it.element).setScale(2.6).setOrigin(0.5, 1).setDepth(62);
    if (jack) { const g = this.add.image(CX, CY - 40, 'glowdot').setTint(0xffcf40).setBlendMode(Phaser.BlendModes.ADD).setDepth(61).setScale(2.5).setAlpha(0.6); this.tweens.add({ targets: g, scale: 3.2, yoyo: true, repeat: 4, duration: 140 }); this.time.delayedCall(1400, () => g.destroy()); sfx(this, 'charge', 0.6); }
    this.tweens.add({ targets: ch, y: CY, duration: 380, ease: 'Bounce.out', onComplete: () => {
      sfx(this, 'open', 0.5);
      this.tweens.add({ targets: ch, angle: { from: -7, to: 7 }, yoyo: true, repeat: jack ? 4 : 2, duration: 55, onComplete: () => {
        ch.setAngle(0).setTexture('open_' + it.element);
        const iy = 175;
        if (it.rarity !== 'COMMON') {
          const rays = this.add.image(IX, iy, 'rays').setTint(R.col).setBlendMode(Phaser.BlendModes.ADD).setDepth(62).setScale(0).setAlpha(0.7);
          this.tweens.add({ targets: rays, scale: leg ? 1.2 : 0.85, duration: 360, ease: 'Back.out' }); this.tweens.add({ targets: rays, angle: 360, duration: 6000, repeat: -1 });
        }
        burst(this, CX, CY - 40, R.col, N(leg ? 80 : 40), leg ? 460 : 320).setDepth(63);
        this.ring(CX, CY - 40, R.col, leg ? 10 : 6, leg ? 8 : 4);
        if (leg) { softFlash(this, 0xffe6a0, 0.22, 260); sfx(this, 'legendary', 0.85); this.cameras.main.shake(400, 0.012);
          const coins = this.add.particles(0, -20, 'coin', { x: { min: 100, max: 1100 }, lifespan: 1800, speedY: { min: 120, max: 240 }, gravityY: 260, rotate: { min: 0, max: 360 }, scale: { min: 1.4, max: 2.2 }, frequency: 30 / this.lite() }).setDepth(63);
          this.time.delayedCall(900, () => coins.stop()); }
        else if (BIG_R[it.rarity]) { sfx(this, 'epic', 0.7); this.cameras.main.shake(250, 0.008); }
        else sfx(this, it.rarity === 'COMMON' ? 'open' : 'rare', 0.6);
        const icon = this.add.image(CX, CY - 40, 'icons', it.frame).setDepth(64).setScale(1);
        try { if (icon.preFX && it.rarity !== 'COMMON') icon.preFX.addGlow(R.col, 4, 0, false, 0.1, 10); } catch (e) {}
        this.tweens.add({ targets: icon, x: IX, y: iy, scale: 3.4, duration: 420, ease: 'Back.out' });
        // the item card: rarity, name, effect (+ the gear event below)
        const cardBg = panel(this, X - 340, 352, 680, 172, { border: R.col, alpha: 0.95 }).setDepth(63).setAlpha(0);
        const rt = txt(this, X, 378, t('rar')[it.rarity], 20, R.css, { strokeThickness: 5, maxW: 600 }).setDepth(64).setAlpha(0);
        const nm = txt(this, X, 414, it.name, 30, it.cursed ? '#d9a6ff' : EL_CSS[it.element], { strokeThickness: 6, maxW: 640 }).setDepth(64).setAlpha(0);
        const ev = equip(this.G, it, this.s);
        this.time.delayedCall(650, () => this.setPower(this.pw()));
        const rl = txt(this, X, 456, ruleText(it), 28, ruleCol(it), { strokeThickness: 6, maxW: 640 }).setDepth(64).setAlpha(0);
        this.tweens.add({ targets: [cardBg, rt, nm, rl], alpha: 1, duration: 200, delay: 200 }); popText(this, nm, 1);
        window.DC.bonusCard = { x: X, y: 438, name: it.name, rarity: it.rarity };
        window.DC.event = { type: ev.type, n: ev.n, gem: ev.gem, purified: ev.purified.map((p) => p.curse) };
        // equip it: the event label pops above the item, the gear bar redraws
        this.time.delayedCall(600, () => {
          const el = txt(this, X, 498, ev.gem ? `${evText(ev)}  ${t('evGem')}` : evText(ev), 22, ev.gem ? EV_CSS.gem : EV_CSS[ev.type], { strokeThickness: 6, maxW: 330 }).setDepth(65);
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
  toNextStage() {
    if (this.leaving) return; this.leaving = true;
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.run.s++;
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(isBig(this.run.s) ? 'intro' : 'pick', { run: this.run }));
  }
  loseSeq() {
    // the boss lunges and EATS the hero
    window.DC.phase = 'eating';
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
    // final gear, newest first: up to two rows of 10 (+N more)
    const list = [...this.items].reverse(), n = Math.min(20, list.length), sp = 62, more = list.length - n;
    list.slice(0, n).forEach((it, i) => {
      const row = Math.floor(i / 10), inRow = Math.min(10, n - row * 10), x = W / 2 - (inRow - 1) * sp / 2 + (i % 10) * sp, y = 372 + row * 58;
      this.add.rectangle(x, y, 52, 52, itemCol(it), it.cursed ? 0.55 : 0.3).setStrokeStyle(2, RARITY[it.rarity].col).setDepth(D);
      const im = this.tip.attach(this.add.image(x, y, 'icons', it.frame).setScale(1.35).setDepth(D), it);
      if (it.cursed && it.kind === 'weapon') im.setTint(0xb070ff);
    });
    if (more) txt(this, W / 2 + 5 * sp + 30, 372 + 58, '+' + more, 22, '#ffe8a0', { strokeThickness: 5 }).setDepth(D);
    if (n) txt(this, W / 2, n > 10 ? 478 : 420, t('tapItem'), 16, '#bba8d0', { strokeThickness: 3, maxW: 740 }).setDepth(D);
    button(this, W / 2, 560, t('playAgain'), () => { restoreMusic(this); this.scene.start('intro', { run: newRun() }); }, 300).setDepth(D);
  }
}

// the Strike scene's pre-swing moment reuses the pick screen's stats panel + GEAR list (one implementation)
['drawStats', 'drawGems', 'setupGearInput', 'setPower', 'inPopup', 'openGear', 'maybeCloseGear', 'closeGear', 'renderGear', 'addInvRow', 'scrollTo', 'updateRowInput'].forEach((k) => { Strike.prototype[k] = Pick.prototype[k]; });

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
