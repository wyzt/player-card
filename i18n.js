// ===== I18N: en, zh (Simplified), ja, ko, pt (BR), es =====
// Each language block sits between /*<xx>*/ markers so the build script can subset the CJK pixel fonts.
const LANGS = ['en', 'zh', 'ja', 'ko', 'pt', 'es'];
const LANG_NAME = { en: 'English', zh: '中文', ja: '日本語', ko: '한국어', pt: 'Português', es: 'Español' };
// noun keys (index order matches ICONS nouns): Sword Dagger Mace Bow Axe Blade Staff Spear Armor Boots Helm Amulet Ring Pendant Medal Talisman Relic Idol Grimoire Shard
const I18N = {
/*<en>*/
en: {
  bonusTitle: 'OVERKILL BONUS!', bonusTier: { minor: 'Trophy', chest: 'Bonus chest!', jackpot: 'JACKPOT CHEST!' },
  title: 'DRAGON CHEST', sub1: '3 bosses. 3 chests each. ONE strike per boss.', sub2: 'Your loot stacks up. Kill them, or get eaten.',
  tapStart: '▶  TAP TO START', tapCont: '▶  TAP TO CONTINUE',
  stageRound: (s, n, k, m) => `STAGE ${s}/${n}  ·  ROUND ${k}/${m}`, round: (k, m) => `ROUND ${k}/${m}`, pickOne: 'PICK ONE!', missed: 'missed:', pickNext: (b, hp) => `Pick one  ·  next: ${b}  HP ${hp}`,
  chest: { wood: 'Wooden', gold: 'Gold', black: 'Black' }, el: { Fire: 'Fire', Ice: 'Ice', Thunder: 'Thunder' },
  bag: (n, m) => `BAG  ${n}/${m}`, rar: { COMMON: 'COMMON', RARE: 'RARE', EPIC: 'EPIC', LEGENDARY: 'LEGENDARY', CURSED: 'CURSED' },
  banLeg: 'LEGENDARY!!', banEpic: 'EPIC!', kind: { weapon: 'Weapon', armor: 'Armor', accessory: 'Accessory', cursed: 'Cursed item' },
  ruleFlat: (lo, hi) => `${lo}–${hi} ATK`, ruleMult: (m) => `+${m}x total damage`, ruleCurse: (a, b) => `${a} to ${b} ATK (cursed)`,
  setLine: (el, n, x, h) => `${el} set: ${n} ${el} items = x${x} damage (you have ${h}/${n})`,
  stage: (s, n) => `STAGE ${s} / ${n}`, openChests: (n) => `Open ${n} chests, then strike ONCE.`, carry: (n) => `Your ${n} items carry over.`,
  carry0: 'Everything you find stays with you.', finalBoss: 'Final boss. Make it count.', ready: (n) => `Your ${n} items are ready.`,
  strike: 'STRIKE!', damage: 'DAMAGE', atk: 'ATK', setPop: (v) => `x${v} SET!`, setPart: (v, el) => `x${v} ${el} set`,
  kill: 'KILL!', notEnough: (a, b) => `NOT ENOUGH  (${a} / ${b})`, overTail: (n) => `(+${n} overkill)`,
  ok: ['OVERKILL', 'MEGA OVERKILL', 'GODLIKE'], stageClear: (s) => `STAGE ${s} CLEAR!`, next: (b, hp) => `Next: ${b}  ·  HP ${hp}`,
  chomp: 'CHOMP!', allSlain: 'ALL BOSSES SLAIN!', ate: ['THE HOUND ATE YOU', 'THE BEAST ATE YOU', 'THE DRAGON ATE YOU'],
  boss: ['HELL HOUND', 'HELL BEAST', 'ANCIENT DRAGON'], endStage: (k, b) => `STAGE ${k}  ${b}`, notReached: 'not reached', eaten: 'EATEN',
  totals: (t, b) => `TOTAL DAMAGE ${t}   ·   BEST HIT ${b}`, winLine: 'Legends will sing of your loot.', loseLine: 'Read your items. Choose better.',
  tapItem: 'Tap an item to inspect it', playAgain: 'PLAY AGAIN',
  names: {
    pre: { Fire: ['Ember', 'Blaze', 'Inferno', 'Cinder', 'Magma'], Ice: ['Frost', 'Glacier', 'Rime', 'Winter', 'Hoarfrost'], Thunder: ['Storm', 'Volt', 'Thunder', 'Tempest', 'Skybolt'] },
    mid: ['Dragonbone', 'Runed', 'Ancient', 'Moonsteel', 'Obsidian', 'Royal', 'Elven', 'Dwarven'], cur: ['Cursed', 'Hexed', 'Doomed', 'Haunted'],
    noun: ['Sword', 'Dagger', 'Mace', 'Bow', 'Axe', 'Blade', 'Staff', 'Spear', 'Armor', 'Boots', 'Helm', 'Amulet', 'Ring', 'Pendant', 'Medal', 'Talisman', 'Relic', 'Idol', 'Grimoire', 'Shard'],
    fmt: (p, m, n) => `${p} ${m} ${n}`, fmtCur: (c, p, n) => `${c} ${p} ${n}`,
  },
},
/*</en>*/
/*<zh>*/
zh: {
  bonusTitle: '溢出奖励！', bonusTier: { minor: '战利品', chest: '奖励宝箱！', jackpot: '大奖宝箱！' },
  title: '屠龙宝箱', sub1: '3 个 Boss，每关 3 个宝箱，每个 Boss 只砍一刀。', sub2: '装备逐关累积。砍死它们，或者被吃掉。',
  tapStart: '▶  点击开始', tapCont: '▶  点击继续',
  stageRound: (s, n, k, m) => `第 ${s}/${n} 关  ·  第 ${k}/${m} 轮`, round: (k, m) => `第 ${k}/${m} 轮`, pickOne: '三选一！', missed: '错过了：', pickNext: (b, hp) => `三选一  ·  下一个：${b}  HP ${hp}`,
  chest: { wood: '木箱', gold: '金箱', black: '黑箱' }, el: { Fire: '火', Ice: '冰', Thunder: '雷' },
  bag: (n, m) => `背包  ${n}/${m}`, rar: { COMMON: '普通', RARE: '稀有', EPIC: '史诗', LEGENDARY: '传说', CURSED: '诅咒' },
  banLeg: '传说！！', banEpic: '史诗！', kind: { weapon: '武器', armor: '防具', accessory: '饰品', cursed: '诅咒物品' },
  ruleFlat: (lo, hi) => `攻击 ${lo}–${hi}`, ruleMult: (m) => `总伤害 +${m} 倍`, ruleCurse: (a, b) => `攻击 ${a} ~ ${b}（诅咒）`,
  setLine: (el, n, x, h) => `${el}套装：${n} 件${el}属性 = 伤害 x${x}（已有 ${h}/${n}）`,
  stage: (s, n) => `第 ${s} / ${n} 关`, openChests: (n) => `开 ${n} 个宝箱，然后只砍一刀。`, carry: (n) => `你的 ${n} 件装备全部保留。`,
  carry0: '开到的装备会一直保留。', finalBoss: '最终 Boss，全力一击！', ready: (n) => `${n} 件装备已就绪。`,
  strike: '砍！', damage: '伤害', atk: '攻击', setPop: (v) => `套装 x${v}！`, setPart: (v, el) => `${el}套装 x${v}`,
  kill: '击杀！', notEnough: (a, b) => `伤害不够（${a} / ${b}）`, overTail: (n) => `（溢出 +${n}）`,
  ok: ['溢出击杀', '超级溢出', '神之一击'], stageClear: (s) => `第 ${s} 关 通关！`, next: (b, hp) => `下一个：${b}  ·  HP ${hp}`,
  chomp: '嗷呜！', allSlain: '全部 Boss 已击败！', ate: ['你被地狱犬吃掉了', '你被地狱魔兽吃掉了', '你被远古巨龙吃掉了'],
  boss: ['地狱犬', '地狱魔兽', '远古巨龙'], endStage: (k, b) => `第 ${k} 关  ${b}`, notReached: '未到达', eaten: '被吃掉',
  totals: (t, b) => `总伤害 ${t}   ·   最高一击 ${b}`, winLine: '你的战利品将被传颂。', loseLine: '看清装备说明，下次选得更好。',
  tapItem: '点击装备查看详情', playAgain: '再来一局',
  names: {
    pre: { Fire: ['余烬', '烈焰', '炼狱', '灰烬', '熔岩'], Ice: ['寒霜', '冰川', '白霜', '凛冬', '玄冰'], Thunder: ['风暴', '电光', '雷霆', '狂岚', '天雷'] },
    mid: ['龙骨', '符文', '远古', '月钢', '黑曜', '王者', '精灵', '矮人'], cur: ['诅咒', '邪咒', '厄运', '怨灵'],
    noun: ['剑', '匕首', '战锤', '弓', '战斧', '刃', '法杖', '长枪', '铠甲', '战靴', '头盔', '护符', '戒指', '吊坠', '勋章', '灵符', '遗物', '神像', '魔典', '碎片'],
    fmt: (p, m, n) => `${p}${m}${n}`, fmtCur: (c, p, n) => `${c}${p}${n}`,
  },
},
/*</zh>*/
/*<ja>*/
ja: {
  bonusTitle: 'オーバーキルボーナス！', bonusTier: { minor: '戦利品', chest: 'ボーナス宝箱！', jackpot: '大当たり宝箱！' },
  title: 'ドラゴンチェスト', sub1: 'ボス3体。各ステージ宝箱3つ。攻撃は1回だけ。', sub2: '装備は引き継がれる。倒すか、喰われるか。',
  tapStart: '▶  タップしてスタート', tapCont: '▶  タップして続ける',
  stageRound: (s, n, k, m) => `ステージ ${s}/${n}  ·  ラウンド ${k}/${m}`, round: (k, m) => `ラウンド ${k}/${m}`, pickOne: 'ひとつ選べ！', missed: '逃した中身：', pickNext: (b, hp) => `1つ選べ  ·  次：${b}  HP ${hp}`,
  chest: { wood: '木の箱', gold: '金の箱', black: '黒の箱' }, el: { Fire: '炎', Ice: '氷', Thunder: '雷' },
  bag: (n, m) => `バッグ  ${n}/${m}`, rar: { COMMON: 'コモン', RARE: 'レア', EPIC: 'エピック', LEGENDARY: 'レジェンド', CURSED: '呪い' },
  banLeg: 'レジェンド！！', banEpic: 'エピック！', kind: { weapon: '武器', armor: '防具', accessory: '装飾品', cursed: '呪いの品' },
  ruleFlat: (lo, hi) => `攻撃 ${lo}–${hi}`, ruleMult: (m) => `総ダメージ +${m}倍`, ruleCurse: (a, b) => `攻撃 ${a}～${b}（呪い）`,
  setLine: (el, n, x, h) => `${el}セット：${el}属性${n}個でダメージ x${x}（所持 ${h}/${n}）`,
  stage: (s, n) => `ステージ ${s} / ${n}`, openChests: (n) => `宝箱を${n}つ開けて、一撃で決めろ。`, carry: (n) => `装備${n}個を引き継ぐ。`,
  carry0: '手に入れた装備はずっと使える。', finalBoss: '最後のボス。全力で叩け。', ready: (n) => `装備${n}個、準備完了。`,
  strike: '斬る！', damage: 'ダメージ', atk: '攻撃', setPop: (v) => `セット x${v}！`, setPart: (v, el) => `${el}セット x${v}`,
  kill: '撃破！', notEnough: (a, b) => `足りない（${a} / ${b}）`, overTail: (n) => `（超過 +${n}）`,
  ok: ['オーバーキル', 'メガオーバーキル', '神の一撃'], stageClear: (s) => `ステージ${s} クリア！`, next: (b, hp) => `次：${b}  ·  HP ${hp}`,
  chomp: 'ガブッ！', allSlain: '全ボス撃破！', ate: ['ヘルハウンドに喰われた', 'ヘルビーストに喰われた', '古代竜に喰われた'],
  boss: ['ヘルハウンド', 'ヘルビースト', '古代竜'], endStage: (k, b) => `ステージ${k}  ${b}`, notReached: '未到達', eaten: '喰われた',
  totals: (t, b) => `総ダメージ ${t}   ·   最大ヒット ${b}`, winLine: 'その戦利品は伝説となる。', loseLine: '装備の説明を読んで、賢く選べ。',
  tapItem: 'アイテムをタップで詳細', playAgain: 'もう一度',
  names: {
    pre: { Fire: ['残り火', '烈火', '煉獄', '燼', '溶岩'], Ice: ['霜', '氷河', '白霜', '冬', '玄氷'], Thunder: ['嵐', '電光', '雷鳴', '暴風', '天雷'] },
    mid: ['竜骨', 'ルーン', '古代', '月鋼', '黒曜', '王家', 'エルフ', 'ドワーフ'], cur: ['呪われし', '禍いの', '破滅の', '怨霊の'],
    noun: ['剣', '短剣', 'メイス', '弓', '斧', '刃', '杖', '槍', '鎧', 'ブーツ', '兜', 'アミュレット', '指輪', 'ペンダント', '勲章', '護符', '聖遺物', '偶像', '魔導書', '欠片'],
    fmt: (p, m, n) => `${p}の${m}${n}`, fmtCur: (c, p, n) => `${c}${p}の${n}`,
  },
},
/*</ja>*/
/*<ko>*/
ko: {
  bonusTitle: '오버킬 보너스!', bonusTier: { minor: '전리품', chest: '보너스 상자!', jackpot: '잭팟 상자!' },
  title: '드래곤 체스트', sub1: '보스 3마리. 스테이지마다 상자 3개. 공격은 단 한 번.', sub2: '장비는 계속 쌓인다. 쓰러뜨리거나, 잡아먹히거나.',
  tapStart: '▶  탭하여 시작', tapCont: '▶  탭하여 계속',
  stageRound: (s, n, k, m) => `스테이지 ${s}/${n}  ·  라운드 ${k}/${m}`, round: (k, m) => `라운드 ${k}/${m}`, pickOne: '하나를 골라라!', missed: '놓친 것:', pickNext: (b, hp) => `하나 선택  ·  다음: ${b}  HP ${hp}`,
  chest: { wood: '나무 상자', gold: '황금 상자', black: '검은 상자' }, el: { Fire: '화염', Ice: '얼음', Thunder: '번개' },
  bag: (n, m) => `가방  ${n}/${m}`, rar: { COMMON: '일반', RARE: '희귀', EPIC: '영웅', LEGENDARY: '전설', CURSED: '저주' },
  banLeg: '전설!!', banEpic: '영웅!', kind: { weapon: '무기', armor: '방어구', accessory: '장신구', cursed: '저주 아이템' },
  ruleFlat: (lo, hi) => `공격력 ${lo}–${hi}`, ruleMult: (m) => `총 피해 +${m}배`, ruleCurse: (a, b) => `공격력 ${a} ~ ${b} (저주)`,
  setLine: (el, n, x, h) => `${el} 세트: ${el} 아이템 ${n}개 = 피해 x${x} (보유 ${h}/${n})`,
  stage: (s, n) => `스테이지 ${s} / ${n}`, openChests: (n) => `상자 ${n}개를 열고, 단 한 번 공격하라.`, carry: (n) => `장비 ${n}개가 그대로 이어진다.`,
  carry0: '얻은 장비는 계속 유지된다.', finalBoss: '최종 보스. 전력을 다하라.', ready: (n) => `장비 ${n}개 준비 완료.`,
  strike: '공격!', damage: '피해량', atk: '공격력', setPop: (v) => `세트 x${v}!`, setPart: (v, el) => `${el} 세트 x${v}`,
  kill: '처치!', notEnough: (a, b) => `부족하다 (${a} / ${b})`, overTail: (n) => `(초과 +${n})`,
  ok: ['오버킬', '메가 오버킬', '신의 일격'], stageClear: (s) => `스테이지 ${s} 클리어!`, next: (b, hp) => `다음: ${b}  ·  HP ${hp}`,
  chomp: '와작!', allSlain: '모든 보스 처치!', ate: ['헬하운드에게 먹혔다', '헬비스트에게 먹혔다', '고대 드래곤에게 먹혔다'],
  boss: ['헬하운드', '헬비스트', '고대 드래곤'], endStage: (k, b) => `스테이지 ${k}  ${b}`, notReached: '도달 못함', eaten: '먹힘',
  totals: (t, b) => `총 피해 ${t}   ·   최고 일격 ${b}`, winLine: '너의 전리품은 전설이 되리라.', loseLine: '장비 설명을 읽고 더 잘 골라라.',
  tapItem: '아이템을 탭해서 확인', playAgain: '다시 하기',
  names: {
    pre: { Fire: ['잿불', '화염', '연옥', '불씨', '용암'], Ice: ['서리', '빙하', '상고대', '겨울', '만년설'], Thunder: ['폭풍', '전격', '천둥', '태풍', '벼락'] },
    mid: ['용뼈', '룬', '고대', '월강', '흑요석', '왕실', '엘프', '드워프'], cur: ['저주받은', '주술 걸린', '파멸의', '원혼의'],
    noun: ['검', '단검', '철퇴', '활', '도끼', '칼날', '지팡이', '창', '갑옷', '장화', '투구', '아뮬렛', '반지', '펜던트', '훈장', '부적', '유물', '우상', '마도서', '파편'],
    fmt: (p, m, n) => `${p} ${m} ${n}`, fmtCur: (c, p, n) => `${c} ${p} ${n}`,
  },
},
/*</ko>*/
/*<pt>*/
pt: {
  bonusTitle: 'BÔNUS DE OVERKILL!', bonusTier: { minor: 'Troféu', chest: 'Baú bônus!', jackpot: 'BAÚ JACKPOT!' },
  title: 'BAÚ DO DRAGÃO', sub1: '3 chefões. 3 baús cada. UM golpe por chefão.', sub2: 'O saque se acumula. Mate-os ou vire comida.',
  tapStart: '▶  TOQUE PARA COMEÇAR', tapCont: '▶  TOQUE PARA CONTINUAR',
  stageRound: (s, n, k, m) => `FASE ${s}/${n}  ·  RODADA ${k}/${m}`, round: (k, m) => `RODADA ${k}/${m}`, pickOne: 'ESCOLHA UM!', missed: 'você perdeu:', pickNext: (b, hp) => `Escolha um  ·  próximo: ${b}  HP ${hp}`,
  chest: { wood: 'Madeira', gold: 'Dourado', black: 'Sombrio' }, el: { Fire: 'Fogo', Ice: 'Gelo', Thunder: 'Trovão' },
  bag: (n, m) => `BOLSA  ${n}/${m}`, rar: { COMMON: 'COMUM', RARE: 'RARO', EPIC: 'ÉPICO', LEGENDARY: 'LENDÁRIO', CURSED: 'MALDITO' },
  banLeg: 'LENDÁRIO!!', banEpic: 'ÉPICO!', kind: { weapon: 'Arma', armor: 'Armadura', accessory: 'Acessório', cursed: 'Item maldito' },
  ruleFlat: (lo, hi) => `${lo}–${hi} ATQ`, ruleMult: (m) => `+${m}x dano total`, ruleCurse: (a, b) => `${a} a ${b} ATQ (maldição)`,
  setLine: (el, n, x, h) => `Conjunto de ${el}: ${n} itens de ${el} = dano x${x} (você tem ${h}/${n})`,
  stage: (s, n) => `FASE ${s} / ${n}`, openChests: (n) => `Abra ${n} baús e golpeie UMA vez.`, carry: (n) => `Seus ${n} itens continuam com você.`,
  carry0: 'Tudo o que encontrar fica com você.', finalBoss: 'Chefão final. Capriche.', ready: (n) => `Seus ${n} itens estão prontos.`,
  strike: 'GOLPEAR!', damage: 'DANO', atk: 'ATQ', setPop: (v) => `CONJUNTO x${v}!`, setPart: (v, el) => `x${v} conj. ${el}`,
  kill: 'ABATIDO!', notEnough: (a, b) => `NÃO BASTOU  (${a} / ${b})`, overTail: (n) => `(+${n} de excesso)`,
  ok: ['OVERKILL', 'MEGA OVERKILL', 'DIVINO'], stageClear: (s) => `FASE ${s} CONCLUÍDA!`, next: (b, hp) => `Próximo: ${b}  ·  HP ${hp}`,
  chomp: 'NHAC!', allSlain: 'TODOS OS CHEFÕES ABATIDOS!', ate: ['O CÃO INFERNAL TE DEVOROU', 'A FERA INFERNAL TE DEVOROU', 'O DRAGÃO TE DEVOROU'],
  boss: ['CÃO INFERNAL', 'FERA INFERNAL', 'DRAGÃO ANCESTRAL'], endStage: (k, b) => `FASE ${k}  ${b}`, notReached: 'não alcançada', eaten: 'DEVORADO',
  totals: (t, b) => `DANO TOTAL ${t}   ·   MELHOR GOLPE ${b}`, winLine: 'Lendas cantarão o seu saque.', loseLine: 'Leia seus itens. Escolha melhor.',
  tapItem: 'Toque num item para ver detalhes', playAgain: 'JOGAR DE NOVO',
  names: { // noun genders: m, f, fp (feminine plural)
    pre: { Fire: ['da Brasa', 'da Chama', 'do Inferno', 'das Cinzas', 'do Magma'], Ice: ['da Geada', 'da Geleira', 'da Escarcha', 'do Inverno', 'da Nevasca'], Thunder: ['da Tormenta', 'do Raio', 'do Trovão', 'da Tempestade', 'do Relâmpago'] },
    mid: [['Dracônico', 'Dracônica', 'Dracônicas'], ['Rúnico', 'Rúnica', 'Rúnicas'], ['Antigo', 'Antiga', 'Antigas'], ['Lunar', 'Lunar', 'Lunares'], ['Sombrio', 'Sombria', 'Sombrias'], ['Real', 'Real', 'Reais'], ['Élfico', 'Élfica', 'Élficas'], ['Anão', 'Anã', 'Anãs']],
    cur: [['Maldito', 'Maldita', 'Malditas'], ['Enfeitiçado', 'Enfeitiçada', 'Enfeitiçadas'], ['Condenado', 'Condenada', 'Condenadas'], ['Assombrado', 'Assombrada', 'Assombradas']],
    noun: [['Espada', 1], ['Adaga', 1], ['Maça', 1], ['Arco', 0], ['Machado', 0], ['Lâmina', 1], ['Cajado', 0], ['Lança', 1], ['Armadura', 1], ['Botas', 2], ['Elmo', 0], ['Amuleto', 0], ['Anel', 0], ['Pingente', 0], ['Medalha', 1], ['Talismã', 0], ['Relíquia', 1], ['Ídolo', 0], ['Grimório', 0], ['Fragmento', 0]],
    fmt: (p, m, n) => `${n[0]} ${m[n[1]]} ${p}`, fmtCur: (c, p, n) => `${n[0]} ${c[n[1]]} ${p}`,
  },
},
/*</pt>*/
/*<es>*/
es: {
  bonusTitle: '¡BONO DE OVERKILL!', bonusTier: { minor: 'Trofeo', chest: '¡Cofre extra!', jackpot: '¡COFRE PREMIO GORDO!' },
  title: 'COFRE DEL DRAGÓN', sub1: '3 jefes. 3 cofres cada uno. UN golpe por jefe.', sub2: 'El botín se acumula. Mátalos o te devoran.',
  tapStart: '▶  TOCA PARA EMPEZAR', tapCont: '▶  TOCA PARA CONTINUAR',
  stageRound: (s, n, k, m) => `FASE ${s}/${n}  ·  RONDA ${k}/${m}`, round: (k, m) => `RONDA ${k}/${m}`, pickOne: '¡ELIGE UNO!', missed: 'te perdiste:', pickNext: (b, hp) => `Elige uno  ·  siguiente: ${b}  HP ${hp}`,
  chest: { wood: 'Madera', gold: 'Dorado', black: 'Sombrío' }, el: { Fire: 'Fuego', Ice: 'Hielo', Thunder: 'Trueno' },
  bag: (n, m) => `BOLSA  ${n}/${m}`, rar: { COMMON: 'COMÚN', RARE: 'RARO', EPIC: 'ÉPICO', LEGENDARY: 'LEGENDARIO', CURSED: 'MALDITO' },
  banLeg: '¡¡LEGENDARIO!!', banEpic: '¡ÉPICO!', kind: { weapon: 'Arma', armor: 'Armadura', accessory: 'Accesorio', cursed: 'Objeto maldito' },
  ruleFlat: (lo, hi) => `${lo}–${hi} ATQ`, ruleMult: (m) => `+${m}x daño total`, ruleCurse: (a, b) => `${a} a ${b} ATQ (maldición)`,
  setLine: (el, n, x, h) => `Set de ${el}: ${n} objetos de ${el} = daño x${x} (tienes ${h}/${n})`,
  stage: (s, n) => `FASE ${s} / ${n}`, openChests: (n) => `Abre ${n} cofres y golpea UNA vez.`, carry: (n) => `Tus ${n} objetos siguen contigo.`,
  carry0: 'Todo lo que encuentres se queda contigo.', finalBoss: 'Jefe final. Que cuente.', ready: (n) => `Tus ${n} objetos están listos.`,
  strike: '¡GOLPEAR!', damage: 'DAÑO', atk: 'ATQ', setPop: (v) => `¡SET x${v}!`, setPart: (v, el) => `x${v} set ${el}`,
  kill: '¡ABATIDO!', notEnough: (a, b) => `NO BASTA  (${a} / ${b})`, overTail: (n) => `(+${n} de exceso)`,
  ok: ['OVERKILL', 'MEGA OVERKILL', 'DIVINO'], stageClear: (s) => `¡FASE ${s} SUPERADA!`, next: (b, hp) => `Siguiente: ${b}  ·  HP ${hp}`,
  chomp: '¡ÑAM!', allSlain: '¡TODOS LOS JEFES ABATIDOS!', ate: ['EL SABUESO TE DEVORÓ', 'LA BESTIA TE DEVORÓ', 'EL DRAGÓN TE DEVORÓ'],
  boss: ['SABUESO INFERNAL', 'BESTIA INFERNAL', 'DRAGÓN ANCESTRAL'], endStage: (k, b) => `FASE ${k}  ${b}`, notReached: 'no alcanzada', eaten: 'DEVORADO',
  totals: (t, b) => `DAÑO TOTAL ${t}   ·   MEJOR GOLPE ${b}`, winLine: 'Las leyendas cantarán tu botín.', loseLine: 'Lee tus objetos. Elige mejor.',
  tapItem: 'Toca un objeto para verlo', playAgain: 'JUGAR OTRA VEZ',
  names: {
    pre: { Fire: ['de Ascuas', 'de Llamas', 'del Infierno', 'de Cenizas', 'de Magma'], Ice: ['de Escarcha', 'del Glaciar', 'de Helada', 'del Invierno', 'de Ventisca'], Thunder: ['de Tormenta', 'del Rayo', 'del Trueno', 'de Tempestad', 'del Relámpago'] },
    mid: [['Dracónico', 'Dracónica', 'Dracónicas'], ['Rúnico', 'Rúnica', 'Rúnicas'], ['Antiguo', 'Antigua', 'Antiguas'], ['Lunar', 'Lunar', 'Lunares'], ['Sombrío', 'Sombría', 'Sombrías'], ['Real', 'Real', 'Reales'], ['Élfico', 'Élfica', 'Élficas'], ['Enano', 'Enana', 'Enanas']],
    cur: [['Maldito', 'Maldita', 'Malditas'], ['Hechizado', 'Hechizada', 'Hechizadas'], ['Condenado', 'Condenada', 'Condenadas'], ['Embrujado', 'Embrujada', 'Embrujadas']],
    noun: [['Espada', 1], ['Daga', 1], ['Maza', 1], ['Arco', 0], ['Hacha', 1], ['Hoja', 1], ['Bastón', 0], ['Lanza', 1], ['Armadura', 1], ['Botas', 2], ['Yelmo', 0], ['Amuleto', 0], ['Anillo', 0], ['Colgante', 0], ['Medalla', 1], ['Talismán', 0], ['Reliquia', 1], ['Ídolo', 0], ['Grimorio', 0], ['Fragmento', 0]],
    fmt: (p, m, n) => `${n[0]} ${m[n[1]]} ${p}`, fmtCur: (c, p, n) => `${n[0]} ${c[n[1]]} ${p}`,
  },
},
/*</es>*/
};
const NOUN_KEYS = ['Sword', 'Dagger', 'Mace', 'Bow', 'Axe', 'Blade', 'Staff', 'Spear', 'Armor', 'Boots', 'Helm', 'Amulet', 'Ring', 'Pendant', 'Medal', 'Talisman', 'Relic', 'Idol', 'Grimoire', 'Shard'];
const CJK_FONT = { zh: 'FusionZH', ja: 'FusionJA', ko: 'FusionKO' };
function detectLang() {
  try { const s = localStorage.getItem('dc_lang'); if (LANGS.includes(s)) return s; } catch (e) {}
  const navs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en']).map((l) => String(l).toLowerCase());
  for (const l of navs) { const c = l.slice(0, 2); if (LANGS.includes(c)) return c; }
  return 'en';
}
let LANG = detectLang();
function fontFor(lang) { return CJK_FONT[lang] ? `"Pixelify Sans", "${CJK_FONT[lang]}", sans-serif` : '"Pixelify Sans", "Trebuchet MS", sans-serif'; }
function loadLangFont(lang) {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  const f = CJK_FONT[lang]; const sample = { zh: '屠龙', ja: 'ドラ', ko: '드래' }[lang];
  const ps = ['700 32px "Pixelify Sans"', '400 16px "Pixelify Sans"'].map((x) => document.fonts.load(x));
  if (f) ps.push(document.fonts.load(`16px "${f}"`, sample));
  return Promise.race([Promise.all(ps), new Promise((r) => setTimeout(r, 3000))]);
}
function setLang(lang) { LANG = lang; try { localStorage.setItem('dc_lang', lang); } catch (e) {} document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : lang === 'pt' ? 'pt-BR' : lang; }
function t(key, ...a) { const d = I18N[LANG] || I18N.en; const v = d[key] !== undefined ? d[key] : I18N.en[key]; return typeof v === 'function' ? v(...a) : v; }
