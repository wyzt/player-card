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
// ===== v5 ENDLESS strings, merged over the blocks above =====
const I18N5 = {
/*<en>*/
en: {
  sub1: 'Endless bosses. Pick ONE chest, then strike ONCE.', sub2: 'Your gear grows forever. Kill them, or get eaten.',
  stageN: (s) => `STAGE ${s}`, bigBoss: 'BIG BOSS', nextBig: 'BIG BOSS NEXT!',
  bosses: ['TOXIC SHROOM', 'BOG TOAD', 'GROTTO VIPER', 'VENOM LIZARD', 'HELL HOUND', 'STORM ROC', 'WAILING WISP', 'FIRE SKULL', 'SHADOW REAPER', 'HELL BEAST', 'NIGHTMARE STEED', 'CAVE WYRM', 'SKY SERPENT', 'DEMON LORD', 'ANCIENT DRAGON'],
  tiers: ['ELDER', 'ABYSSAL', 'COSMIC', 'ETERNAL', 'PRIMORDIAL'], bossTier: (p, n) => `${p} ${n}`,
  introLine: 'Pick 1 chest, then strike ONCE.', gearLine: (n) => `${n} items equipped`, gear0: 'Your gear lives in fixed slots and upgrades itself.',
  gearT: 'GEAR', cat: { weapon: 'WEAPONS', armor: 'ARMOR', accessory: 'ACCESSORIES' }, emptySlot: 'empty slot',
  curseRow: (n, v) => `${n} curse${n > 1 ? 's' : ''}: ${v} ATK next strike`, salvLine: (p) => `Salvage bonus +${p}% damage`, salvPop: (p) => `+${p}% SALVAGE`,
  evMerge: (n) => `★${n} MERGE! x2`, evUpgrade: 'UPGRADE!', evSalvage: (p) => `SALVAGED +${p}% DMG`, evCurse: 'CURSED! hurts your next strike', evEquip: 'EQUIPPED', evMax: '★MAX - salvaged',
  ruleMult: (x) => `${x} total damage`, rar: { COMMON: 'COMMON', RARE: 'RARE', EPIC: 'EPIC', LEGENDARY: 'LEGENDARY', MYTHIC: 'MYTHIC', COSMIC: 'COSMIC', CURSED: 'CURSED' },
  banMyth: 'MYTHIC!!!', banCos: 'COSMIC!!!!', ok: ['OVERKILL', 'MEGA OVERKILL', 'GODLIKE', 'ANNIHILATION'],
  milestone: (s) => `MILESTONE: STAGE ${s}!`, ateBy: (b) => `${b} ATE YOU`,
  reached: (s) => `Reached stage ${s}`, maxHit: (v) => `Max hit ${v}`, totalDmg: (v) => `Total damage ${v}`,
  bestRec: (s, v) => `Best: stage ${s}  ·  hit ${v}`, newRec: 'NEW RECORD!', titleBest: (s, v) => `Best run: stage ${s}  ·  max hit ${v}`,
  loseLine: 'Every pick matters. Go deeper.',
},
/*</en>*/
/*<zh>*/
zh: {
  sub1: '无尽 Boss。选一个宝箱，然后只砍一刀。', sub2: '装备永远成长。砍死它们，或者被吃掉。',
  stageN: (s) => `第 ${s} 关`, bigBoss: '大 BOSS', nextBig: '下一关：大 BOSS！',
  bosses: ['毒蘑菇', '沼泽蟾蜍', '洞窟蝰蛇', '毒蜥蜴', '地狱犬', '风暴巨鸟', '哀嚎幽魂', '烈焰骷髅', '暗影死神', '地狱魔兽', '梦魇战马', '洞穴飞龙', '天空蛟龙', '恶魔领主', '远古巨龙'],
  tiers: ['上古', '深渊', '宇宙', '永恒', '太初'], bossTier: (p, n) => `${p}·${n}`,
  introLine: '选 1 个宝箱，然后只砍一刀。', gearLine: (n) => `已装备 ${n} 件`, gear0: '装备有固定栏位，会自动升级。',
  gearT: '装备', cat: { weapon: '武器', armor: '防具', accessory: '饰品' }, emptySlot: '空栏位',
  curseRow: (n, v) => `${n} 个诅咒：下一刀攻击 ${v}`, salvLine: (p) => `分解加成 伤害 +${p}%`, salvPop: (p) => `分解 +${p}%`,
  evMerge: (n) => `★${n} 合成！x2`, evUpgrade: '升级！', evSalvage: (p) => `已分解 伤害 +${p}%`, evCurse: '诅咒！影响下一刀', evEquip: '已装备', evMax: '★满级 - 已分解',
  ruleMult: (x) => `总伤害 ${x}`, rar: { COMMON: '普通', RARE: '稀有', EPIC: '史诗', LEGENDARY: '传说', MYTHIC: '神话', COSMIC: '宇宙', CURSED: '诅咒' },
  banMyth: '神话！！！', banCos: '宇宙级！！！！', ok: ['溢出击杀', '超级溢出', '神之一击', '毁天灭地'],
  milestone: (s) => `里程碑：第 ${s} 关！`, ateBy: (b) => `你被${b}吃掉了`,
  reached: (s) => `到达第 ${s} 关`, maxHit: (v) => `最高一击 ${v}`, totalDmg: (v) => `总伤害 ${v}`,
  bestRec: (s, v) => `最佳：第 ${s} 关  ·  一击 ${v}`, newRec: '新纪录！', titleBest: (s, v) => `最佳纪录：第 ${s} 关  ·  最高一击 ${v}`,
  loseLine: '每次选择都很重要。再走远一点。',
},
/*</zh>*/
/*<ja>*/
ja: {
  sub1: '終わりなきボス。宝箱を1つ選び、一撃で決めろ。', sub2: '装備は無限に成長する。倒すか、喰われるか。',
  stageN: (s) => `ステージ ${s}`, bigBoss: 'ビッグボス', nextBig: '次はビッグボス！',
  bosses: ['毒キノコ', '沼ガエル', '洞窟マムシ', '毒トカゲ', 'ヘルハウンド', '嵐の怪鳥', '嘆きの亡霊', '炎の髑髏', '影の死神', 'ヘルビースト', '悪夢の駿馬', '洞窟ワーム', '天空の蛇竜', '魔王', '古代竜'],
  tiers: ['古の', '深淵の', '宇宙の', '永劫の', '原初の'], bossTier: (p, n) => `${p}${n}`,
  introLine: '宝箱を1つ選び、一撃で決めろ。', gearLine: (n) => `装備 ${n}個`, gear0: '装備は固定スロット制、自動で強化される。',
  gearT: '装備', cat: { weapon: '武器', armor: '防具', accessory: '装飾品' }, emptySlot: '空きスロット',
  curseRow: (n, v) => `呪い${n}個：次の一撃 攻撃 ${v}`, salvLine: (p) => `分解ボーナス ダメージ +${p}%`, salvPop: (p) => `分解 +${p}%`,
  evMerge: (n) => `★${n} 合成！x2`, evUpgrade: 'アップグレード！', evSalvage: (p) => `分解 ダメージ +${p}%`, evCurse: '呪い！次の一撃に影響', evEquip: '装備した', evMax: '★MAX - 分解',
  ruleMult: (x) => `総ダメージ ${x}`, rar: { COMMON: 'コモン', RARE: 'レア', EPIC: 'エピック', LEGENDARY: 'レジェンド', MYTHIC: 'ミシック', COSMIC: 'コズミック', CURSED: '呪い' },
  banMyth: 'ミシック！！！', banCos: 'コズミック！！！！', ok: ['オーバーキル', 'メガオーバーキル', '神の一撃', '殲滅'],
  milestone: (s) => `節目：ステージ${s}！`, ateBy: (b) => `${b}に喰われた`,
  reached: (s) => `到達：ステージ${s}`, maxHit: (v) => `最大ヒット ${v}`, totalDmg: (v) => `総ダメージ ${v}`,
  bestRec: (s, v) => `ベスト：ステージ${s}  ·  ヒット ${v}`, newRec: '新記録！', titleBest: (s, v) => `ベスト：ステージ${s}  ·  最大ヒット ${v}`,
  loseLine: '選択がすべて。もっと深くへ。',
},
/*</ja>*/
/*<ko>*/
ko: {
  sub1: '끝없는 보스. 상자 하나를 고르고, 한 번만 베어라.', sub2: '장비는 끝없이 성장한다. 쓰러뜨리거나, 먹히거나.',
  stageN: (s) => `스테이지 ${s}`, bigBoss: '빅 보스', nextBig: '다음은 빅 보스!',
  bosses: ['독버섯', '늪 두꺼비', '동굴 독사', '독도마뱀', '헬하운드', '폭풍 괴조', '통곡의 망령', '화염 해골', '그림자 사신', '헬비스트', '악몽의 군마', '동굴 와이번', '하늘 뱀룡', '마왕', '고대 드래곤'],
  tiers: ['고대의', '심연의', '우주의', '영겁의', '태초의'], bossTier: (p, n) => `${p} ${n}`,
  introLine: '상자 1개를 고르고, 한 번만 베어라.', gearLine: (n) => `장비 ${n}개 장착`, gear0: '장비는 고정 슬롯, 자동으로 업그레이드된다.',
  gearT: '장비', cat: { weapon: '무기', armor: '방어구', accessory: '장신구' }, emptySlot: '빈 슬롯',
  curseRow: (n, v) => `저주 ${n}개: 다음 일격 공격력 ${v}`, salvLine: (p) => `분해 보너스 피해 +${p}%`, salvPop: (p) => `분해 +${p}%`,
  evMerge: (n) => `★${n} 합성! x2`, evUpgrade: '업그레이드!', evSalvage: (p) => `분해 피해 +${p}%`, evCurse: '저주! 다음 일격에 영향', evEquip: '장착', evMax: '★MAX - 분해',
  ruleMult: (x) => `총 피해 ${x}`, rar: { COMMON: '일반', RARE: '희귀', EPIC: '영웅', LEGENDARY: '전설', MYTHIC: '신화', COSMIC: '우주', CURSED: '저주' },
  banMyth: '신화!!!', banCos: '우주급!!!!', ok: ['오버킬', '메가 오버킬', '신의 일격', '절멸'],
  milestone: (s) => `이정표: 스테이지 ${s}!`, ateBy: (b) => `${b}에게 먹혔다`,
  reached: (s) => `도달: 스테이지 ${s}`, maxHit: (v) => `최대 일격 ${v}`, totalDmg: (v) => `총 피해 ${v}`,
  bestRec: (s, v) => `최고: 스테이지 ${s}  ·  일격 ${v}`, newRec: '신기록!', titleBest: (s, v) => `최고 기록: 스테이지 ${s}  ·  최대 일격 ${v}`,
  loseLine: '모든 선택이 중요하다. 더 깊이.',
},
/*</ko>*/
/*<pt>*/
pt: {
  sub1: 'Chefões sem fim. Escolha UM baú e golpeie UMA vez.', sub2: 'Seu equipamento cresce para sempre. Mate ou seja devorado.',
  stageN: (s) => `FASE ${s}`, bigBoss: 'CHEFÃO', nextBig: 'PRÓXIMO: CHEFÃO!',
  bosses: ['COGUMELO TÓXICO', 'SAPO DO PÂNTANO', 'VÍBORA DA GRUTA', 'LAGARTO VENENOSO', 'CÃO INFERNAL', 'ROCA DA TEMPESTADE', 'ALMA LAMENTOSA', 'CAVEIRA FLAMEJANTE', 'CEIFADOR SOMBRIO', 'FERA INFERNAL', 'CORCEL DO PESADELO', 'SERPE DA CAVERNA', 'SERPENTE CELESTE', 'SENHOR DEMÔNIO', 'DRAGÃO ANCESTRAL'],
  tiers: ['MILENAR', 'ABISSAL', 'DO COSMOS', 'DA ETERNIDADE', 'PRIMORDIAL'], bossTier: (p, n) => `${n} ${p}`,
  introLine: 'Escolha 1 baú e golpeie UMA vez.', gearLine: (n) => `${n} itens equipados`, gear0: 'Equipamento em espaços fixos que se melhoram sozinhos.',
  gearT: 'EQUIPAMENTO', cat: { weapon: 'ARMAS', armor: 'ARMADURAS', accessory: 'ACESSÓRIOS' }, emptySlot: 'espaço vazio',
  curseRow: (n, v) => `${n} maldição${n > 1 ? 'ões' : ''}: ${v} ATQ no próximo golpe`, salvLine: (p) => `Bônus de sucata +${p}% dano`, salvPop: (p) => `+${p}% SUCATA`,
  evMerge: (n) => `★${n} FUSÃO! x2`, evUpgrade: 'MELHORIA!', evSalvage: (p) => `SUCATA +${p}% DANO`, evCurse: 'MALDIÇÃO! afeta o próximo golpe', evEquip: 'EQUIPADO', evMax: '★MÁX - virou sucata',
  ruleMult: (x) => `${x} dano total`, rar: { COMMON: 'COMUM', RARE: 'RARO', EPIC: 'ÉPICO', LEGENDARY: 'LENDÁRIO', MYTHIC: 'MÍTICO', COSMIC: 'CÓSMICO', CURSED: 'MALDITO' },
  banMyth: 'MÍTICO!!!', banCos: 'CÓSMICO!!!!', ok: ['OVERKILL', 'MEGA OVERKILL', 'DIVINO', 'ANIQUILAÇÃO'],
  milestone: (s) => `MARCO: FASE ${s}!`, ateBy: (b) => `${b} TE DEVOROU`,
  reached: (s) => `Chegou à fase ${s}`, maxHit: (v) => `Maior golpe ${v}`, totalDmg: (v) => `Dano total ${v}`,
  bestRec: (s, v) => `Recorde: fase ${s}  ·  golpe ${v}`, newRec: 'NOVO RECORDE!', titleBest: (s, v) => `Recorde: fase ${s}  ·  maior golpe ${v}`,
  loseLine: 'Cada escolha conta. Vá mais fundo.',
},
/*</pt>*/
/*<es>*/
es: {
  sub1: 'Jefes sin fin. Elige UN cofre y golpea UNA vez.', sub2: 'Tu equipo crece para siempre. Mátalos o te devoran.',
  stageN: (s) => `FASE ${s}`, bigBoss: 'GRAN JEFE', nextBig: '¡SIGUE UN GRAN JEFE!',
  bosses: ['SETA TÓXICA', 'SAPO DEL PANTANO', 'VÍBORA DE LA GRUTA', 'LAGARTO VENENOSO', 'SABUESO INFERNAL', 'ROC DE LA TORMENTA', 'ALMA EN PENA', 'CALAVERA ÍGNEA', 'SEGADOR SOMBRÍO', 'BESTIA INFERNAL', 'CORCEL DE PESADILLA', 'SIERPE DE LA CAVERNA', 'SERPIENTE CELESTE', 'SEÑOR DEMONIO', 'DRAGÓN ANCESTRAL'],
  tiers: ['DE ANTAÑO', 'ABISAL', 'DEL COSMOS', 'DE LA ETERNIDAD', 'PRIMORDIAL'], bossTier: (p, n) => `${n} ${p}`,
  introLine: 'Elige 1 cofre y golpea UNA vez.', gearLine: (n) => `${n} objetos equipados`, gear0: 'Tu equipo va en ranuras fijas y se mejora solo.',
  gearT: 'EQUIPO', cat: { weapon: 'ARMAS', armor: 'ARMADURAS', accessory: 'ACCESORIOS' }, emptySlot: 'ranura vacía',
  curseRow: (n, v) => `${n} maldición${n > 1 ? 'es' : ''}: ${v} ATQ el próximo golpe`, salvLine: (p) => `Bono de chatarra +${p}% daño`, salvPop: (p) => `+${p}% CHATARRA`,
  evMerge: (n) => `¡★${n} FUSIÓN! x2`, evUpgrade: '¡MEJORA!', evSalvage: (p) => `CHATARRA +${p}% DAÑO`, evCurse: '¡MALDICIÓN! afecta al próximo golpe', evEquip: 'EQUIPADO', evMax: '★MÁX - a chatarra',
  ruleMult: (x) => `${x} daño total`, rar: { COMMON: 'COMÚN', RARE: 'RARO', EPIC: 'ÉPICO', LEGENDARY: 'LEGENDARIO', MYTHIC: 'MÍTICO', COSMIC: 'CÓSMICO', CURSED: 'MALDITO' },
  banMyth: '¡¡¡MÍTICO!!!', banCos: '¡¡¡¡CÓSMICO!!!!', ok: ['OVERKILL', 'MEGA OVERKILL', 'DIVINO', 'ANIQUILACIÓN'],
  milestone: (s) => `¡HITO: FASE ${s}!`, ateBy: (b) => `${b} TE DEVORÓ`,
  reached: (s) => `Llegaste a la fase ${s}`, maxHit: (v) => `Golpe máximo ${v}`, totalDmg: (v) => `Daño total ${v}`,
  bestRec: (s, v) => `Récord: fase ${s}  ·  golpe ${v}`, newRec: '¡NUEVO RÉCORD!', titleBest: (s, v) => `Récord: fase ${s}  ·  golpe máx. ${v}`,
  loseLine: 'Cada elección cuenta. Llega más lejos.',
},
/*</es>*/
};
for (const l of LANGS) Object.assign(I18N[l], I18N5[l]);
// ===== v5 curses (debuffs) + element synergies =====
const I18N6 = {
/*<en>*/
en: {
  power: 'POWER', gearTap: 'hover / tap: gear',
  blackHint: 'GAMBLE: big loot or a CURSE', curseT: 'CURSES',
  curseRule: (n, k) => `CURSE: ${n} for ${k} stages. No item, no slot.`,
  db: { weak: 'WEAKNESS', elem: 'ELEMENT SEAL', minroll: 'DULL EDGE', hp: 'BOSS FURY', rarity: 'BAD LUCK' },
  dbDesc: { weak: 'All your damage x0.5', elem: 'Your {el} items do nothing', minroll: 'Weapons & armor roll their minimum', hp: 'Boss HP +50%', rarity: 'Chests roll one rarity lower' },
  dbLeft: (n) => `${n} stage${n > 1 ? 's' : ''} left`, evCurse: (n) => `CURSED: ${n}!`,
  syn: { Fire: 'BURN', Ice: 'FROSTBITE', Thunder: 'CHAIN' },
  synDesc: { Fire: 'Burn: the hit keeps burning for extra damage (steady)', Ice: 'Frostbite: boss takes more from everything, more crits', Thunder: 'Chain: a chance for a huge chain crit (swingy)' },
  synLv: (n, lv, nx) => `${n} items · Lv${lv}` + (nx ? ` (next Lv at ${nx})` : ' (MAX)'),
  synFx: { Fire: (p) => `burn +${p}% of the hit`, Ice: (p, c) => `+${p}% damage taken · crit ${c}%`, Thunder: (c, x) => `${c}% chance: chain ×${x}` },
  synOff: 'no bonus yet (needs 2 items)',
  critPop: 'CRIT ×2!', chainPop: (x) => `CHAIN ×${x}!`, burnPop: (v) => `BURN +${v}`, vulnPop: (x) => `FROSTBITE ${x}`, weakPop: 'WEAKNESS ×0.5', sealPop: (el) => `${el} SEALED`,
},
/*</en>*/
/*<zh>*/
zh: {
  power: '战斗力', gearTap: '悬停/点击查看装备',
  blackHint: '赌博：大奖或诅咒', curseT: '诅咒',
  curseRule: (n, k) => `诅咒：${n}，持续 ${k} 关。不给装备，不占栏位。`,
  db: { weak: '虚弱', elem: '元素封印', minroll: '钝刃', hp: 'Boss 狂暴', rarity: '霉运' },
  dbDesc: { weak: '你的全部伤害 x0.5', elem: '你的{el}装备完全无效', minroll: '武器和防具只出最低值', hp: 'Boss 生命 +50%', rarity: '宝箱稀有度降一级' },
  dbLeft: (n) => `剩余 ${n} 关`, evCurse: (n) => `被诅咒：${n}！`,
  syn: { Fire: '灼烧', Ice: '冻伤', Thunder: '连锁' },
  synDesc: { Fire: '灼烧：命中后持续燃烧造成额外伤害（稳定）', Ice: '冻伤：Boss 承受的所有伤害提高，暴击更多', Thunder: '连锁：有几率触发巨额连锁暴击（波动大）' },
  synLv: (n, lv, nx) => `${n} 件 · ${lv} 级` + (nx ? `（${nx} 件升级）` : '（满级）'),
  synFx: { Fire: (p) => `灼烧 +${p}% 命中伤害`, Ice: (p, c) => `承伤 +${p}% · 暴击率 ${c}%`, Thunder: (c, x) => `${c}% 几率：连锁 ×${x}` },
  synOff: '暂无加成（需要 2 件）',
  critPop: '暴击 ×2！', chainPop: (x) => `连锁 ×${x}！`, burnPop: (v) => `灼烧 +${v}`, vulnPop: (x) => `冻伤 ${x}`, weakPop: '虚弱 ×0.5', sealPop: (el) => `${el}被封印`,
},
/*</zh>*/
/*<ja>*/
ja: {
  power: '戦闘力', gearTap: 'ホバー/タップで装備',
  blackHint: 'ギャンブル：大当たりか呪いか', curseT: '呪い',
  curseRule: (n, k) => `呪い：${n}（${k}ステージ）。装備なし、枠も使わない。`,
  db: { weak: '衰弱', elem: '属性封印', minroll: 'なまくら', hp: 'ボス激昂', rarity: '不運' },
  dbDesc: { weak: '与ダメージすべて x0.5', elem: '{el}の装備が無効になる', minroll: '武器と防具は最低値しか出ない', hp: 'ボスHP +50%', rarity: '宝箱のレア度が1段階下がる' },
  dbLeft: (n) => `残り${n}ステージ`, evCurse: (n) => `呪われた：${n}！`,
  syn: { Fire: '炎上', Ice: '凍傷', Thunder: '連鎖' },
  synDesc: { Fire: '炎上：命中後も燃え続けて追加ダメージ（安定）', Ice: '凍傷：ボスの被ダメージ上昇、会心が増える', Thunder: '連鎖：確率で超大型の連鎖会心（ブレ大）' },
  synLv: (n, lv, nx) => `${n}個 · Lv${lv}` + (nx ? `（${nx}個で次Lv）` : '（MAX）'),
  synFx: { Fire: (p) => `炎上 +${p}%（命中ダメージ比）`, Ice: (p, c) => `被ダメ +${p}% · 会心率 ${c}%`, Thunder: (c, x) => `${c}%で連鎖 ×${x}` },
  synOff: 'ボーナスなし（2個必要）',
  critPop: '会心 ×2！', chainPop: (x) => `連鎖 ×${x}！`, burnPop: (v) => `炎上 +${v}`, vulnPop: (x) => `凍傷 ${x}`, weakPop: '衰弱 ×0.5', sealPop: (el) => `${el}封印`,
},
/*</ja>*/
/*<ko>*/
ko: {
  power: '전투력', gearTap: '호버/탭: 장비 보기',
  blackHint: '도박: 대박 아니면 저주', curseT: '저주',
  curseRule: (n, k) => `저주: ${n}, ${k} 스테이지 동안. 장비 없음, 슬롯 없음.`,
  db: { weak: '쇠약', elem: '속성 봉인', minroll: '무딘 칼날', hp: '보스 분노', rarity: '불운' },
  dbDesc: { weak: '모든 피해 x0.5', elem: '{el} 장비가 아무 효과 없음', minroll: '무기와 방어구가 최저치만 나옴', hp: '보스 HP +50%', rarity: '상자 희귀도 한 단계 하락' },
  dbLeft: (n) => `${n} 스테이지 남음`, evCurse: (n) => `저주: ${n}!`,
  syn: { Fire: '화상', Ice: '동상', Thunder: '연쇄' },
  synDesc: { Fire: '화상: 적중 후 계속 불타 추가 피해 (안정적)', Ice: '동상: 보스가 받는 모든 피해 증가, 치명타 증가', Thunder: '연쇄: 확률로 거대한 연쇄 치명타 (변동 큼)' },
  synLv: (n, lv, nx) => `${n}개 · Lv${lv}` + (nx ? ` (${nx}개에 다음 Lv)` : ' (MAX)'),
  synFx: { Fire: (p) => `화상 +${p}% (적중 피해 대비)`, Ice: (p, c) => `받는 피해 +${p}% · 치명타 ${c}%`, Thunder: (c, x) => `${c}% 확률: 연쇄 ×${x}` },
  synOff: '보너스 없음 (2개 필요)',
  critPop: '치명타 ×2!', chainPop: (x) => `연쇄 ×${x}!`, burnPop: (v) => `화상 +${v}`, vulnPop: (x) => `동상 ${x}`, weakPop: '쇠약 ×0.5', sealPop: (el) => `${el} 봉인`,
},
/*</ko>*/
/*<pt>*/
pt: {
  power: 'PODER', gearTap: 'passe/toque: equipamento',
  blackHint: 'APOSTA: saque enorme ou MALDIÇÃO', curseT: 'MALDIÇÕES',
  curseRule: (n, k) => `MALDIÇÃO: ${n} por ${k} fases. Sem item, sem espaço.`,
  db: { weak: 'FRAQUEZA', elem: 'SELO ELEMENTAL', minroll: 'LÂMINA CEGA', hp: 'FÚRIA DO CHEFE', rarity: 'AZAR' },
  dbDesc: { weak: 'Todo o seu dano x0,5', elem: 'Seus itens de {el} não fazem nada', minroll: 'Armas e armaduras rolam o mínimo', hp: 'Vida do chefe +50%', rarity: 'Baús rolam uma raridade abaixo' },
  dbLeft: (n) => `faltam ${n} fase${n > 1 ? 's' : ''}`, evCurse: (n) => `AMALDIÇOADO: ${n}!`,
  syn: { Fire: 'QUEIMADURA', Ice: 'CONGELAMENTO', Thunder: 'CORRENTE' },
  synDesc: { Fire: 'Queimadura: o golpe continua queimando (dano estável)', Ice: 'Congelamento: o chefe sofre mais de tudo, mais críticos', Thunder: 'Corrente: chance de um crítico em corrente enorme (instável)' },
  synLv: (n, lv, nx) => `${n} itens · Nv${lv}` + (nx ? ` (próximo Nv com ${nx})` : ' (MÁX)'),
  synFx: { Fire: (p) => `queima +${p}% do golpe`, Ice: (p, c) => `+${p}% dano sofrido · crítico ${c}%`, Thunder: (c, x) => `${c}% de chance: corrente ×${x}` },
  synOff: 'sem bônus ainda (precisa de 2 itens)',
  critPop: 'CRÍTICO ×2!', chainPop: (x) => `CORRENTE ×${x}!`, burnPop: (v) => `QUEIMA +${v}`, vulnPop: (x) => `CONGELA ${x}`, weakPop: 'FRAQUEZA ×0,5', sealPop: (el) => `${el} SELADO`,
},
/*</pt>*/
/*<es>*/
es: {
  power: 'PODER', gearTap: 'pasa/toca: equipo',
  blackHint: 'APUESTA: botín enorme o MALDICIÓN', curseT: 'MALDICIONES',
  curseRule: (n, k) => `MALDICIÓN: ${n} durante ${k} fases. Sin objeto, sin ranura.`,
  db: { weak: 'DEBILIDAD', elem: 'SELLO ELEMENTAL', minroll: 'FILO ROMO', hp: 'FURIA DEL JEFE', rarity: 'MALA SUERTE' },
  dbDesc: { weak: 'Todo tu daño x0,5', elem: 'Tus objetos de {el} no hacen nada', minroll: 'Armas y armaduras sacan el mínimo', hp: 'Vida del jefe +50%', rarity: 'Los cofres salen una rareza más baja' },
  dbLeft: (n) => `quedan ${n} fase${n > 1 ? 's' : ''}`, evCurse: (n) => `¡MALDITO: ${n}!`,
  syn: { Fire: 'QUEMADURA', Ice: 'CONGELACIÓN', Thunder: 'CADENA' },
  synDesc: { Fire: 'Quemadura: el golpe sigue ardiendo (daño constante)', Ice: 'Congelación: el jefe recibe más de todo, más críticos', Thunder: 'Cadena: probabilidad de un crítico en cadena enorme (variable)' },
  synLv: (n, lv, nx) => `${n} objetos · Nv${lv}` + (nx ? ` (siguiente Nv con ${nx})` : ' (MÁX)'),
  synFx: { Fire: (p) => `quema +${p}% del golpe`, Ice: (p, c) => `+${p}% daño recibido · crítico ${c}%`, Thunder: (c, x) => `${c}% de probabilidad: cadena ×${x}` },
  synOff: 'sin bono aún (necesita 2 objetos)',
  critPop: '¡CRÍTICO ×2!', chainPop: (x) => `¡CADENA ×${x}!`, burnPop: (v) => `QUEMA +${v}`, vulnPop: (x) => `CONGELA ${x}`, weakPop: 'DEBILIDAD ×0,5', sealPop: (el) => `${el} SELLADO`,
},
/*</es>*/
};
for (const l of LANGS) Object.assign(I18N[l], I18N6[l]);

// v6: gear stacks forever, every weapon hits on its own, cursed items + purify gems
const I18N7 = {
/*<en>*/
en: {
  gear0: 'All gear stacks forever. Every weapon strikes on its own.', sub2: 'Your gear stacks forever. Kill them, or get eaten.',
  blackHint: 'GAMBLE: big loot or a CURSED item',
  ruleW: (lo, hi, c) => `${lo}–${hi} ATK · crit ${c}%`, ruleAcc: (p) => `+${p}% all damage`,
  arm: { critX: (v) => `+${v}× crit damage`, elemB: (v, el) => `+${v}% ${el} weapon damage`, burnT: (v) => `+${v} burn tick${v > 1 ? 's' : ''}`, vuln: (v) => `+${v}% frostbite (damage taken)`, chains: (v) => `+${v} chain bolt${v > 1 ? 's' : ''}` },
  noCrit: 'Never crits: boosts your weapon hits', wNote: 'Hits on its own every strike',
  cur: { drain: (lo, hi) => `Drains ${lo}–${hi} from your total`, critDown: (v) => `Crit damage −${v}×`, seal: (el) => `Your ${el} items do nothing`, weak: (p) => `All damage −${p}%`, hpUp: (p) => `Boss HP +${p}%` },
  curseNote: 'Stays in your gear until a PURIFY GEM removes it',
  gemT: 'PURIFY GEM', gemDesc: 'Wooden & gold chests sometimes drop one. It auto-removes your worst cursed item; with no curse it is held for later.', gemHeld: (n) => `${n} held`,
  evAdd: (n) => `+1 GEAR (${n})`, evCursed: 'CURSED ITEM!', evPurify: 'PURIFIED!', evGem: '+1 PURIFY GEM',
  gearCount: (w, a, c) => `${w} weapons · ${a} armour · ${c} accessories`, cursedN: (n) => `${n} cursed`, newTag: 'NEW',
  synDesc: { Fire: 'Burn: after the hits the boss keeps burning (steady)', Ice: 'Frostbite: boss takes more from every hit, all weapons crit more', Thunder: 'Chain: every hit may fork into extra bolts (swingy)' },
  synFx: { Fire: (p, k) => `burns ${p}% of the hits × ${k} ticks`, Ice: (p, c) => `+${p}% damage taken · +${c}% crit chance`, Thunder: (c, n) => `${c}% per hit: ${n} chain bolts` },
  hits: (n) => `×${n} HITS`, critHit: 'CRIT!', chainHit: (n) => `CHAIN ×${n}`,
  strikeSum: (n, c, ch) => `×${n} hits · ${c} crit · ${ch} chain`,
},
/*</en>*/
/*<zh>*/
zh: {
  gear0: '所有装备永久叠加，每把武器单独出手。', sub2: '装备永久叠加。杀了它们，或者被吃掉。',
  blackHint: '赌博：大奖或诅咒装备',
  ruleW: (lo, hi, c) => `攻击 ${lo}–${hi} · 暴击 ${c}%`, ruleAcc: (p) => `全部伤害 +${p}%`,
  arm: { critX: (v) => `暴击伤害 +${v}倍`, elemB: (v, el) => `${el}武器伤害 +${v}%`, burnT: (v) => `灼烧 +${v} 跳`, vuln: (v) => `冻伤承伤 +${v}%`, chains: (v) => `连锁 +${v} 道闪电` },
  noCrit: '不会暴击：强化你的武器命中', wNote: '每次出击单独命中一次',
  cur: { drain: (lo, hi) => `从总伤害中扣除 ${lo}–${hi}`, critDown: (v) => `暴击伤害 −${v}倍`, seal: (el) => `你的${el}装备完全无效`, weak: (p) => `全部伤害 −${p}%`, hpUp: (p) => `Boss 生命 +${p}%` },
  curseNote: '一直留在装备里，直到净化宝石将其移除',
  gemT: '净化宝石', gemDesc: '木箱和金箱有时会掉落。自动移除你最糟的诅咒装备；没有诅咒时先保存起来。', gemHeld: (n) => `持有 ${n}`,
  evAdd: (n) => `+1 装备（${n}）`, evCursed: '诅咒装备！', evPurify: '净化！', evGem: '+1 净化宝石',
  gearCount: (w, a, c) => `武器 ${w} · 防具 ${a} · 饰品 ${c}`, cursedN: (n) => `诅咒 ${n}`, newTag: '新',
  synDesc: { Fire: '灼烧：命中后 Boss 持续燃烧（稳定）', Ice: '冻伤：Boss 每次受击伤害提高，所有武器暴击率提高', Thunder: '连锁：每次命中都可能分叉出额外闪电（波动大）' },
  synFx: { Fire: (p, k) => `灼烧命中伤害的 ${p}% × ${k} 跳`, Ice: (p, c) => `承伤 +${p}% · 暴击率 +${c}%`, Thunder: (c, n) => `每次命中 ${c}%：${n} 道连锁闪电` },
  hits: (n) => `×${n} 连击`, critHit: '暴击！', chainHit: (n) => `连锁 ×${n}`,
  strikeSum: (n, c, ch) => `${n} 次命中 · ${c} 暴击 · ${ch} 连锁`,
},
/*</zh>*/
/*<ja>*/
ja: {
  gear0: '装備はずっと積み重なる。武器は1本ずつ攻撃する。', sub2: '装備はずっと積み重なる。倒すか、食われるか。',
  blackHint: 'ギャンブル：大当たりか呪いの装備',
  ruleW: (lo, hi, c) => `攻撃 ${lo}–${hi} · 会心 ${c}%`, ruleAcc: (p) => `全ダメージ +${p}%`,
  arm: { critX: (v) => `会心ダメージ +${v}倍`, elemB: (v, el) => `${el}武器ダメージ +${v}%`, burnT: (v) => `燃焼 +${v} 回`, vuln: (v) => `凍傷 被ダメ +${v}%`, chains: (v) => `連鎖の稲妻 +${v}` },
  noCrit: '会心なし：武器の一撃を強化する', wNote: '毎回の攻撃で単独ヒット',
  cur: { drain: (lo, hi) => `合計から ${lo}–${hi} を奪う`, critDown: (v) => `会心ダメージ −${v}倍`, seal: (el) => `${el}の装備が無効になる`, weak: (p) => `全ダメージ −${p}%`, hpUp: (p) => `ボスHP +${p}%` },
  curseNote: '浄化の宝石で消えるまで装備に残る',
  gemT: '浄化の宝石', gemDesc: '木箱と金箱からときどき出る。最悪の呪い装備を自動で消す。呪いがなければ保管される。', gemHeld: (n) => `所持 ${n}`,
  evAdd: (n) => `+1 装備（${n}）`, evCursed: '呪いの装備！', evPurify: '浄化！', evGem: '+1 浄化の宝石',
  gearCount: (w, a, c) => `武器 ${w} · 防具 ${a} · 装飾品 ${c}`, cursedN: (n) => `呪い ${n}`, newTag: 'NEW',
  synDesc: { Fire: '燃焼：攻撃の後もボスが燃え続ける（安定）', Ice: '凍傷：ボスの被ダメージ増加、全武器の会心率アップ', Thunder: '連鎖：各ヒットが追加の稲妻に分かれることがある（ムラあり）' },
  synFx: { Fire: (p, k) => `ヒットの ${p}% を ${k} 回燃焼`, Ice: (p, c) => `被ダメ +${p}% · 会心率 +${c}%`, Thunder: (c, n) => `ヒットごと ${c}%：稲妻 ${n} 本` },
  hits: (n) => `×${n} HIT`, critHit: '会心！', chainHit: (n) => `連鎖 ×${n}`,
  strikeSum: (n, c, ch) => `${n} ヒット · 会心 ${c} · 連鎖 ${ch}`,
},
/*</ja>*/
/*<ko>*/
ko: {
  gear0: '모든 장비는 영원히 쌓인다. 무기마다 따로 공격한다.', sub2: '장비는 영원히 쌓인다. 쓰러뜨리거나, 먹히거나.',
  blackHint: '도박: 대박 또는 저주 장비',
  ruleW: (lo, hi, c) => `공격력 ${lo}–${hi} · 치명 ${c}%`, ruleAcc: (p) => `모든 피해 +${p}%`,
  arm: { critX: (v) => `치명타 피해 +${v}배`, elemB: (v, el) => `${el} 무기 피해 +${v}%`, burnT: (v) => `화상 +${v}회`, vuln: (v) => `동상 받는 피해 +${v}%`, chains: (v) => `연쇄 번개 +${v}` },
  noCrit: '치명타 없음: 무기 타격을 강화', wNote: '공격마다 따로 한 번 타격',
  cur: { drain: (lo, hi) => `총 피해에서 ${lo}–${hi} 차감`, critDown: (v) => `치명타 피해 −${v}배`, seal: (el) => `${el} 장비가 아무 효과 없음`, weak: (p) => `모든 피해 −${p}%`, hpUp: (p) => `보스 HP +${p}%` },
  curseNote: '정화의 보석이 없앨 때까지 장비에 남는다',
  gemT: '정화의 보석', gemDesc: '나무·황금 상자에서 가끔 나온다. 가장 나쁜 저주 장비를 자동으로 없앤다. 저주가 없으면 보관된다.', gemHeld: (n) => `보유 ${n}`,
  evAdd: (n) => `+1 장비 (${n})`, evCursed: '저주 장비!', evPurify: '정화!', evGem: '+1 정화의 보석',
  gearCount: (w, a, c) => `무기 ${w} · 방어구 ${a} · 장신구 ${c}`, cursedN: (n) => `저주 ${n}`, newTag: 'NEW',
  synDesc: { Fire: '화상: 타격 후에도 보스가 계속 불탄다 (안정적)', Ice: '동상: 보스가 받는 피해 증가, 모든 무기 치명타 확률 증가', Thunder: '연쇄: 타격마다 추가 번개로 갈라질 수 있다 (변동 큼)' },
  synFx: { Fire: (p, k) => `타격의 ${p}% × ${k}회 화상`, Ice: (p, c) => `받는 피해 +${p}% · 치명 +${c}%`, Thunder: (c, n) => `타격마다 ${c}%: 번개 ${n}개` },
  hits: (n) => `×${n} HIT`, critHit: '치명타!', chainHit: (n) => `연쇄 ×${n}`,
  strikeSum: (n, c, ch) => `${n}타 · 치명 ${c} · 연쇄 ${ch}`,
},
/*</ko>*/
/*<pt>*/
pt: {
  gear0: 'Todo o equipamento acumula para sempre. Cada arma ataca sozinha.', sub2: 'Seu equipamento acumula para sempre. Mate-os ou seja devorado.',
  blackHint: 'APOSTA: saque enorme ou item AMALDIÇOADO',
  ruleW: (lo, hi, c) => `${lo}–${hi} ATQ · crít ${c}%`, ruleAcc: (p) => `+${p}% todo o dano`,
  arm: { critX: (v) => `+${v}× dano crítico`, elemB: (v, el) => `+${v}% dano de armas de ${el}`, burnT: (v) => `+${v} tique${v > 1 ? 's' : ''} de queimadura`, vuln: (v) => `+${v}% congelamento (dano recebido)`, chains: (v) => `+${v} raio${v > 1 ? 's' : ''} em cadeia` },
  noCrit: 'Nunca crita: fortalece os golpes das armas', wNote: 'Golpeia sozinha a cada ataque',
  cur: { drain: (lo, hi) => `Drena ${lo}–${hi} do seu total`, critDown: (v) => `Dano crítico −${v}×`, seal: (el) => `Seus itens de ${el} não fazem nada`, weak: (p) => `Todo o dano −${p}%`, hpUp: (p) => `HP do chefe +${p}%` },
  curseNote: 'Fica no equipamento até uma GEMA DE PURIFICAÇÃO removê-lo',
  gemT: 'GEMA DE PURIFICAÇÃO', gemDesc: 'Baús de madeira e ouro às vezes soltam uma. Remove sozinha seu pior item amaldiçoado; sem maldição, fica guardada.', gemHeld: (n) => `${n} guardada${n > 1 ? 's' : ''}`,
  evAdd: (n) => `+1 ITEM (${n})`, evCursed: 'ITEM AMALDIÇOADO!', evPurify: 'PURIFICADO!', evGem: '+1 GEMA DE PURIFICAÇÃO',
  gearCount: (w, a, c) => `${w} armas · ${a} armaduras · ${c} acessórios`, cursedN: (n) => `${n} maldito${n > 1 ? 's' : ''}`, newTag: 'NOVO',
  synDesc: { Fire: 'Queimadura: depois dos golpes o chefe continua queimando (estável)', Ice: 'Congelamento: o chefe recebe mais de cada golpe, todas as armas critam mais', Thunder: 'Cadeia: cada golpe pode se dividir em raios extras (instável)' },
  synFx: { Fire: (p, k) => `queima ${p}% dos golpes × ${k} tiques`, Ice: (p, c) => `+${p}% dano recebido · +${c}% chance de crítico`, Thunder: (c, n) => `${c}% por golpe: ${n} raios em cadeia` },
  hits: (n) => `×${n} GOLPES`, critHit: 'CRÍTICO!', chainHit: (n) => `CADEIA ×${n}`,
  strikeSum: (n, c, ch) => `×${n} golpes · ${c} crít · ${ch} cadeia`,
},
/*</pt>*/
/*<es>*/
es: {
  gear0: 'Todo el equipo se acumula para siempre. Cada arma golpea por su cuenta.', sub2: 'Tu equipo se acumula para siempre. Mátalos o te devoran.',
  blackHint: 'APUESTA: botín enorme u objeto MALDITO',
  ruleW: (lo, hi, c) => `${lo}–${hi} ATQ · crít ${c}%`, ruleAcc: (p) => `+${p}% todo el daño`,
  arm: { critX: (v) => `+${v}× daño crítico`, elemB: (v, el) => `+${v}% daño de armas de ${el}`, burnT: (v) => `+${v} tic${v > 1 ? 's' : ''} de quemadura`, vuln: (v) => `+${v}% congelación (daño recibido)`, chains: (v) => `+${v} rayo${v > 1 ? 's' : ''} en cadena` },
  noCrit: 'Nunca hace crítico: potencia los golpes de tus armas', wNote: 'Golpea por su cuenta en cada ataque',
  cur: { drain: (lo, hi) => `Resta ${lo}–${hi} de tu total`, critDown: (v) => `Daño crítico −${v}×`, seal: (el) => `Tus objetos de ${el} no hacen nada`, weak: (p) => `Todo el daño −${p}%`, hpUp: (p) => `PV del jefe +${p}%` },
  curseNote: 'Se queda en tu equipo hasta que una GEMA PURIFICADORA lo quite',
  gemT: 'GEMA PURIFICADORA', gemDesc: 'Los cofres de madera y oro a veces sueltan una. Quita sola tu peor objeto maldito; si no hay maldición, se guarda.', gemHeld: (n) => `${n} guardada${n > 1 ? 's' : ''}`,
  evAdd: (n) => `+1 OBJETO (${n})`, evCursed: '¡OBJETO MALDITO!', evPurify: '¡PURIFICADO!', evGem: '+1 GEMA PURIFICADORA',
  gearCount: (w, a, c) => `${w} armas · ${a} armaduras · ${c} accesorios`, cursedN: (n) => `${n} maldito${n > 1 ? 's' : ''}`, newTag: 'NUEVO',
  synDesc: { Fire: 'Quemadura: tras los golpes el jefe sigue ardiendo (estable)', Ice: 'Congelación: el jefe recibe más de cada golpe, todas las armas hacen más críticos', Thunder: 'Cadena: cada golpe puede dividirse en rayos extra (variable)' },
  synFx: { Fire: (p, k) => `quema ${p}% de los golpes × ${k} tics`, Ice: (p, c) => `+${p}% daño recibido · +${c}% prob. de crítico`, Thunder: (c, n) => `${c}% por golpe: ${n} rayos en cadena` },
  hits: (n) => `×${n} GOLPES`, critHit: '¡CRÍTICO!', chainHit: (n) => `CADENA ×${n}`,
  strikeSum: (n, c, ch) => `×${n} golpes · ${c} crít · ${ch} cadena`,
},
/*</es>*/
};
for (const l of LANGS) Object.assign(I18N[l], I18N7[l]);

// v7: element chests + DARK chest, 6 rarities, gear effects, thresholds 3/6/9, dual combos, boss weakness, execute
const I18N8 = {
/*<en>*/
en: {
  statsT: 'HERO STATS', stExec: 'Execute', stEcho: 'Echo', stGreed: 'Greed', stPerm: 'Permanent', stCurses: 'Curses', stGems: 'Purify gems', 
  statLine: (ex, ec, gr, pm) => `Execute ${ex}% · Echo ${ec}% · Greed ${gr}% · Perm +${pm}%`, comboOn: 'ACTIVE', 
  chestEl: (el) => `${el} chest`, darkChest: 'DARK CHEST', darkHint: 'Better loot… or a CURSED item', blackHint: 'Better loot… or a CURSED item',
  rar: { COMMON: 'COMMON', UNCOMMON: 'UNCOMMON', RARE: 'RARE', EPIC: 'EPIC', LEGENDARY: 'LEGENDARY', MYTHIC: 'MYTHIC', CURSED: 'CURSED' },
  eff: { elemB: (v, el) => `+${v}% ${el} weapon damage`, critX: (v) => `+${v}× crit damage`, combo: (v) => `+${v}% damage per hit in the strike`, execute: (v) => `Execute line +${v}% boss HP`,
    glob: (v) => `+${v}% all damage`, echo: (v) => `${v}% chance a weapon hits twice`, greed: (v) => `${v}% chance: next chest +1 rarity`, okConv: (v) => `${v}% of overkill → permanent damage` },
  effNote: { combo: 'Counts every hit of the strike (order does not matter)', execute: 'After all hits: boss below the line dies instantly (max 20%)', okConv: 'Each kill grows your permanent bonus', greed: 'Rolled when you open a chest' },
  synLv: (n, lv, nx) => `${n} items · Lv${lv}` + (nx ? ` (Lv${lv + 1} at ${nx})` : ' (MAX)'),
  synDesc: { Fire: 'Burn: your Fire hits keep burning after the strike', Ice: 'Frostbite: every hit is amplified, Ice weapons crit more', Thunder: 'Chain: each Thunder hit may fork into bolts (swingy)' },
  synFx: { Fire: (p, k) => `Fire hits burn ${p}% × ${k} ticks`, Ice: (p, c) => `all hits +${p}% · Ice crit +${c}%`, Thunder: (c, n) => `Thunder hits: ${c}% → ${n} bolts` },
  lv3: { Fire: 'INFERNO: +1 burn tick per 3 more Fire items', Ice: 'SHATTER: +1× crit damage for everything', Thunder: 'STORM: chain bolts can crit' },
  combosT: 'COMBOS', comboN: { melt: 'MELT', superconduct: 'SUPERCONDUCT', overload: 'OVERLOAD' },
  comboD: { melt: 'Fire + Ice: burn ×4, then ×1.6 per combo Lv (= lower of the two Lv)', superconduct: 'Ice + Thunder: crit damage ×2.5, then ×1.4 per combo Lv', overload: 'Fire + Thunder: explosion +100% of all hits, then ×1.5 per combo Lv' },
  comboOff: 'needs two elements at Lv1 (3 items each)',
  weakT: 'WEAK', resistT: 'RESISTS', nextBoss: 'NEXT', infWeakTag: (x) => `WEAKNESS ×${x}`, hqTag: 'HIGH QUALITY', infResTag: (x) => `RESISTED ×${x}`,
  infNote: 'Your strike takes the element of the chest you open', infPop: (el, x) => `${el} ×${x}!`,
  execPop: 'EXECUTE!', execLine: (p) => `Execute line ${p}%`, echoTag: 'ECHO', overloadPop: (v) => `OVERLOAD +${v}`, meltPop: 'MELT ×3!', scPop: 'SUPERCONDUCT!',
  permPop: (p) => `+${p}% PERMANENT`, permLine: (p) => `Permanent overkill bonus +${p}% damage`, greedPop: 'GREED: +1 RARITY!',
  gemDesc: 'Normal chests sometimes drop one. It auto-removes your worst cursed item; with no curse it is held for later.',
  hitsCombo: (n, c) => `×${n} HITS · COMBO ×${c}`,
  sub1: 'Endless bosses. Pick one elemental chest, strike once.',
},
/*</en>*/
/*<zh>*/
zh: {
  statsT: '英雄属性', stExec: '斩杀线', stEcho: '回响', stGreed: '贪婪', stPerm: '永久加成', stCurses: '诅咒', stGems: '净化宝石', 
  statLine: (ex, ec, gr, pm) => `斩杀 ${ex}% · 回响 ${ec}% · 贪婪 ${gr}% · 永久 +${pm}%`, comboOn: '已激活', 
  chestEl: (el) => `${el}宝箱`, darkChest: '暗黑宝箱', darkHint: '更好的战利品……或诅咒装备', blackHint: '更好的战利品……或诅咒装备',
  rar: { COMMON: '普通', UNCOMMON: '优秀', RARE: '稀有', EPIC: '史诗', LEGENDARY: '传说', MYTHIC: '神话', CURSED: '诅咒' },
  eff: { elemB: (v, el) => `${el}武器伤害 +${v}%`, critX: (v) => `暴击伤害 +${v}倍`, combo: (v) => `本次出击每次命中 +${v}% 伤害`, execute: (v) => `斩杀线 +${v}% Boss 生命`,
    glob: (v) => `全部伤害 +${v}%`, echo: (v) => `${v}% 几率武器命中两次`, greed: (v) => `${v}% 几率：下个宝箱稀有度 +1`, okConv: (v) => `${v}% 溢出伤害 → 永久伤害` },
  effNote: { combo: '计算本次出击的全部命中（与顺序无关）', execute: '全部命中后：Boss 低于斩杀线立即死亡（最高 20%）', okConv: '每次击杀都会提高永久加成', greed: '开宝箱时判定' },
  synLv: (n, lv, nx) => `${n} 件 · ${lv} 级` + (nx ? `（${nx} 件升 ${lv + 1} 级）` : '（满级）'),
  synDesc: { Fire: '灼烧：火焰命中在出击后持续燃烧', Ice: '冻伤：所有命中被放大，冰霜武器暴击更多', Thunder: '连锁：每次雷电命中可能分叉出闪电（波动大）' },
  synFx: { Fire: (p, k) => `火焰命中灼烧 ${p}% × ${k} 跳`, Ice: (p, c) => `所有命中 +${p}% · 冰霜暴击 +${c}%`, Thunder: (c, n) => `雷电命中：${c}% → ${n} 道闪电` },
  lv3: { Fire: '炼狱：每多 3 件火焰装备 +1 跳灼烧', Ice: '碎冰：所有暴击伤害 +1 倍', Thunder: '风暴：连锁闪电也能暴击' },
  combosT: '元素反应', comboN: { melt: '融化', superconduct: '超导', overload: '超载' },
  comboD: { melt: '火 + 冰：灼烧 ×4，组合每升 1 级再 ×1.6（组合等级 = 两者较低等级）', superconduct: '冰 + 雷：暴击伤害 ×2.5，组合每升 1 级再 ×1.4', overload: '火 + 雷：爆炸追加全部命中的 100%，组合每升 1 级再 ×1.5' },
  comboOff: '需要两种元素都到 1 级（各 3 件）',
  weakT: '弱点', resistT: '抗性', nextBoss: '下一个', infWeakTag: (x) => `弱点 ×${x}`, hqTag: '高品质', infResTag: (x) => `被抵抗 ×${x}`,
  infNote: '你的出击会带上所开宝箱的元素', infPop: (el, x) => `${el} ×${x}！`,
  execPop: '斩杀！', execLine: (p) => `斩杀线 ${p}%`, echoTag: '回响', overloadPop: (v) => `超载 +${v}`, meltPop: '融化 ×3！', scPop: '超导！',
  permPop: (p) => `永久 +${p}%`, permLine: (p) => `永久溢出加成：伤害 +${p}%`, greedPop: '贪婪：稀有度 +1！',
  gemDesc: '普通宝箱有时会掉落。自动移除你最糟的诅咒装备；没有诅咒时先保存起来。',
  hitsCombo: (n, c) => `×${n} 连击 · 连段 ×${c}`,
  sub1: '无尽的 Boss。选一个元素宝箱，只砍一刀。',
},
/*</zh>*/
/*<ja>*/
ja: {
  statsT: 'ヒーロー能力', stExec: '処刑ライン', stEcho: '残響', stGreed: '強欲', stPerm: '永続ボーナス', stCurses: '呪い', stGems: '浄化の宝石', 
  statLine: (ex, ec, gr, pm) => `処刑 ${ex}% · 残響 ${ec}% · 強欲 ${gr}% · 永続 +${pm}%`, comboOn: '発動中', 
  chestEl: (el) => `${el}の宝箱`, darkChest: '闇の宝箱', darkHint: 'より良い戦利品…または呪いの装備', blackHint: 'より良い戦利品…または呪いの装備',
  rar: { COMMON: 'コモン', UNCOMMON: 'アンコモン', RARE: 'レア', EPIC: 'エピック', LEGENDARY: 'レジェンド', MYTHIC: 'ミシック', CURSED: '呪い' },
  eff: { elemB: (v, el) => `${el}武器ダメージ +${v}%`, critX: (v) => `会心ダメージ +${v}倍`, combo: (v) => `この攻撃のヒットごとに +${v}%`, execute: (v) => `処刑ライン +${v}%（ボスHP）`,
    glob: (v) => `全ダメージ +${v}%`, echo: (v) => `${v}% の確率で武器が2回ヒット`, greed: (v) => `${v}%：次の宝箱のレア度 +1`, okConv: (v) => `オーバーキルの ${v}% → 永続ダメージ` },
  effNote: { combo: '攻撃の全ヒット数で決まる（順番は関係なし）', execute: '全ヒット後、ボスHPがライン以下なら即死（最大20%）', okConv: '倒すたびに永続ボーナスが育つ', greed: '宝箱を開けた時に判定' },
  synLv: (n, lv, nx) => `${n} 個 · Lv${lv}` + (nx ? `（${nx} 個で Lv${lv + 1}）` : '（MAX）'),
  synDesc: { Fire: '燃焼：火のヒットが攻撃後も燃え続ける', Ice: '凍傷：全ヒットを増幅、氷の武器は会心しやすい', Thunder: '連鎖：雷のヒットが稲妻に分かれることがある（ムラあり）' },
  synFx: { Fire: (p, k) => `火のヒットの ${p}% を ${k} 回燃焼`, Ice: (p, c) => `全ヒット +${p}% · 氷の会心 +${c}%`, Thunder: (c, n) => `雷のヒット：${c}% で稲妻 ${n} 本` },
  lv3: { Fire: '業火：火の装備 3 個ごとに燃焼 +1 回', Ice: '粉砕：全ての会心ダメージ +1倍', Thunder: '嵐：連鎖の稲妻も会心する' },
  combosT: '元素反応', comboN: { melt: '溶解', superconduct: '超電導', overload: '過負荷' },
  comboD: { melt: '火 + 氷：燃焼 ×4、コンボLvごとに さらに×1.6（低い方のLv）', superconduct: '氷 + 雷：会心ダメージ ×2.5、コンボLvごとに ×1.4', overload: '火 + 雷：全ヒットの100%の爆発、コンボLvごとに ×1.5' },
  comboOff: '2つの元素を Lv1 に（各3個）',
  weakT: '弱点', resistT: '耐性', nextBoss: '次', infWeakTag: (x) => `弱点 ×${x}`, hqTag: '高品質', infResTag: (x) => `耐性 ×${x}`,
  infNote: '開けた宝箱の元素が攻撃に宿る', infPop: (el, x) => `${el} ×${x}！`,
  execPop: '処刑！', execLine: (p) => `処刑ライン ${p}%`, echoTag: '残響', overloadPop: (v) => `過負荷 +${v}`, meltPop: '溶解 ×3！', scPop: '超電導！',
  permPop: (p) => `永続 +${p}%`, permLine: (p) => `永続オーバーキル ボーナス +${p}%`, greedPop: '強欲：レア度 +1！',
  gemDesc: '通常の宝箱からときどき出る。最悪の呪い装備を自動で消す。呪いがなければ保管される。',
  hitsCombo: (n, c) => `×${n} HIT · コンボ ×${c}`,
  sub1: '終わらないボス。元素の宝箱を1つ選び、一撃で決めろ。',
},
/*</ja>*/
/*<ko>*/
ko: {
  statsT: '영웅 능력치', stExec: '처형선', stEcho: '메아리', stGreed: '탐욕', stPerm: '영구 보너스', stCurses: '저주', stGems: '정화 보석', 
  statLine: (ex, ec, gr, pm) => `처형 ${ex}% · 메아리 ${ec}% · 탐욕 ${gr}% · 영구 +${pm}%`, comboOn: '활성', 
  chestEl: (el) => `${el} 상자`, darkChest: '어둠의 상자', darkHint: '더 좋은 전리품… 또는 저주 장비', blackHint: '더 좋은 전리품… 또는 저주 장비',
  rar: { COMMON: '일반', UNCOMMON: '고급', RARE: '희귀', EPIC: '영웅', LEGENDARY: '전설', MYTHIC: '신화', CURSED: '저주' },
  eff: { elemB: (v, el) => `${el} 무기 피해 +${v}%`, critX: (v) => `치명타 피해 +${v}배`, combo: (v) => `이번 공격의 타격마다 +${v}%`, execute: (v) => `처형선 +${v}% (보스 HP)`,
    glob: (v) => `모든 피해 +${v}%`, echo: (v) => `${v}% 확률로 무기가 두 번 타격`, greed: (v) => `${v}%: 다음 상자 등급 +1`, okConv: (v) => `초과 피해의 ${v}% → 영구 피해` },
  effNote: { combo: '공격의 모든 타격 수로 계산 (순서 무관)', execute: '모든 타격 후 보스 HP가 선 아래면 즉사 (최대 20%)', okConv: '처치할 때마다 영구 보너스가 자란다', greed: '상자를 열 때 판정' },
  synLv: (n, lv, nx) => `${n}개 · Lv${lv}` + (nx ? ` (${nx}개에 Lv${lv + 1})` : ' (MAX)'),
  synDesc: { Fire: '화상: 불 타격이 공격 후에도 계속 불탄다', Ice: '동상: 모든 타격 증폭, 얼음 무기 치명타 증가', Thunder: '연쇄: 번개 타격이 번개로 갈라질 수 있다 (변동 큼)' },
  synFx: { Fire: (p, k) => `불 타격의 ${p}% × ${k}회 화상`, Ice: (p, c) => `모든 타격 +${p}% · 얼음 치명 +${c}%`, Thunder: (c, n) => `번개 타격: ${c}% → 번개 ${n}개` },
  lv3: { Fire: '연옥: 불 장비 3개마다 화상 +1회', Ice: '산산조각: 모든 치명타 피해 +1배', Thunder: '폭풍: 연쇄 번개도 치명타' },
  combosT: '원소 반응', comboN: { melt: '융해', superconduct: '초전도', overload: '과부하' },
  comboD: { melt: '불 + 얼음: 화상 ×4, 콤보 Lv마다 ×1.6 (둘 중 낮은 Lv)', superconduct: '얼음 + 번개: 치명타 피해 ×2.5, 콤보 Lv마다 ×1.4', overload: '불 + 번개: 모든 타격의 100% 폭발, 콤보 Lv마다 ×1.5' },
  comboOff: '두 원소를 Lv1로 (각 3개)',
  weakT: '약점', resistT: '저항', nextBoss: '다음', infWeakTag: (x) => `약점 ×${x}`, hqTag: '고품질', infResTag: (x) => `저항됨 ×${x}`,
  infNote: '연 상자의 원소가 공격에 깃든다', infPop: (el, x) => `${el} ×${x}!`,
  execPop: '처형!', execLine: (p) => `처형선 ${p}%`, echoTag: '메아리', overloadPop: (v) => `과부하 +${v}`, meltPop: '융해 ×3!', scPop: '초전도!',
  permPop: (p) => `영구 +${p}%`, permLine: (p) => `영구 초과 피해 보너스 +${p}%`, greedPop: '탐욕: 등급 +1!',
  gemDesc: '일반 상자에서 가끔 나온다. 가장 나쁜 저주 장비를 자동으로 없앤다. 저주가 없으면 보관된다.',
  hitsCombo: (n, c) => `×${n} HIT · 콤보 ×${c}`,
  sub1: '끝없는 보스. 원소 상자 하나를 고르고, 한 번에 베어라.',
},
/*</ko>*/
/*<pt>*/
pt: {
  statsT: 'ATRIBUTOS', stExec: 'Execução', stEcho: 'Eco', stGreed: 'Ganância', stPerm: 'Permanente', stCurses: 'Maldições', stGems: 'Gemas', 
  statLine: (ex, ec, gr, pm) => `Execução ${ex}% · Eco ${ec}% · Ganância ${gr}% · Perm. +${pm}%`, comboOn: 'ATIVO', 
  chestEl: (el) => `Baú de ${el}`, darkChest: 'BAÚ SOMBRIO', darkHint: 'Saque melhor… ou um item AMALDIÇOADO', blackHint: 'Saque melhor… ou um item AMALDIÇOADO',
  rar: { COMMON: 'COMUM', UNCOMMON: 'INCOMUM', RARE: 'RARO', EPIC: 'ÉPICO', LEGENDARY: 'LENDÁRIO', MYTHIC: 'MÍTICO', CURSED: 'AMALDIÇOADO' },
  eff: { elemB: (v, el) => `+${v}% dano de armas de ${el}`, critX: (v) => `+${v}× dano crítico`, combo: (v) => `+${v}% de dano por golpe no ataque`, execute: (v) => `Linha de execução +${v}% do HP`,
    glob: (v) => `+${v}% todo o dano`, echo: (v) => `${v}% de chance: a arma golpeia 2×`, greed: (v) => `${v}%: próximo baú +1 raridade`, okConv: (v) => `${v}% do excesso → dano permanente` },
  effNote: { combo: 'Conta todos os golpes do ataque (a ordem não importa)', execute: 'Após os golpes: chefe abaixo da linha morre na hora (máx. 20%)', okConv: 'Cada morte aumenta seu bônus permanente', greed: 'Sorteado ao abrir um baú' },
  synLv: (n, lv, nx) => `${n} itens · Nv${lv}` + (nx ? ` (Nv${lv + 1} com ${nx})` : ' (MÁX)'),
  synDesc: { Fire: 'Queimadura: seus golpes de Fogo continuam queimando', Ice: 'Congelamento: todo golpe é ampliado, armas de Gelo critam mais', Thunder: 'Cadeia: golpes de Trovão podem se dividir em raios (instável)' },
  synFx: { Fire: (p, k) => `golpes de Fogo queimam ${p}% × ${k}`, Ice: (p, c) => `todos os golpes +${p}% · crít. Gelo +${c}%`, Thunder: (c, n) => `golpes de Trovão: ${c}% → ${n} raios` },
  lv3: { Fire: 'INFERNO: +1 tique a cada 3 itens de Fogo extras', Ice: 'ESTILHAÇAR: +1× dano crítico para tudo', Thunder: 'TEMPESTADE: raios em cadeia podem critar' },
  combosT: 'COMBOS', comboN: { melt: 'DERRETER', superconduct: 'SUPERCONDUÇÃO', overload: 'SOBRECARGA' },
  comboD: { melt: 'Fogo + Gelo: queimadura ×4, e ×1.6 por Nv do combo (o menor dos dois)', superconduct: 'Gelo + Trovão: dano crítico ×2.5, e ×1.4 por Nv do combo', overload: 'Fogo + Trovão: explosão de +100% dos golpes, e ×1.5 por Nv do combo' },
  comboOff: 'precisa de dois elementos no Nv1 (3 itens cada)',
  weakT: 'FRACO', resistT: 'RESISTE', nextBoss: 'PRÓXIMO', infWeakTag: (x) => `FRAQUEZA ×${x}`, hqTag: 'ALTA QUALIDADE', infResTag: (x) => `RESISTIDO ×${x}`,
  infNote: 'Seu ataque assume o elemento do baú que você abrir', infPop: (el, x) => `${el} ×${x}!`,
  execPop: 'EXECUÇÃO!', execLine: (p) => `Linha de execução ${p}%`, echoTag: 'ECO', overloadPop: (v) => `SOBRECARGA +${v}`, meltPop: 'DERRETER ×3!', scPop: 'SUPERCONDUÇÃO!',
  permPop: (p) => `+${p}% PERMANENTE`, permLine: (p) => `Bônus permanente de excesso +${p}%`, greedPop: 'GANÂNCIA: +1 RARIDADE!',
  gemDesc: 'Baús normais às vezes soltam uma. Remove sozinha seu pior item amaldiçoado; sem maldição, fica guardada.',
  hitsCombo: (n, c) => `×${n} GOLPES · COMBO ×${c}`,
  sub1: 'Chefes sem fim. Escolha um baú elemental, golpeie uma vez.',
},
/*</pt>*/
/*<es>*/
es: {
  statsT: 'ATRIBUTOS', stExec: 'Ejecución', stEcho: 'Eco', stGreed: 'Codicia', stPerm: 'Permanente', stCurses: 'Maldiciones', stGems: 'Gemas', 
  statLine: (ex, ec, gr, pm) => `Ejecución ${ex}% · Eco ${ec}% · Codicia ${gr}% · Perm. +${pm}%`, comboOn: 'ACTIVO', 
  chestEl: (el) => `Cofre de ${el}`, darkChest: 'COFRE OSCURO', darkHint: 'Mejor botín… o un objeto MALDITO', blackHint: 'Mejor botín… o un objeto MALDITO',
  rar: { COMMON: 'COMÚN', UNCOMMON: 'POCO COMÚN', RARE: 'RARO', EPIC: 'ÉPICO', LEGENDARY: 'LEGENDARIO', MYTHIC: 'MÍTICO', CURSED: 'MALDITO' },
  eff: { elemB: (v, el) => `+${v}% daño de armas de ${el}`, critX: (v) => `+${v}× daño crítico`, combo: (v) => `+${v}% de daño por golpe del ataque`, execute: (v) => `Línea de ejecución +${v}% de PV`,
    glob: (v) => `+${v}% todo el daño`, echo: (v) => `${v}% de prob.: el arma golpea 2 veces`, greed: (v) => `${v}%: siguiente cofre +1 rareza`, okConv: (v) => `${v}% del exceso → daño permanente` },
  effNote: { combo: 'Cuenta todos los golpes del ataque (el orden no importa)', execute: 'Tras los golpes: si el jefe queda bajo la línea, muere al instante (máx. 20%)', okConv: 'Cada muerte aumenta tu bono permanente', greed: 'Se tira al abrir un cofre' },
  synLv: (n, lv, nx) => `${n} objetos · Nv${lv}` + (nx ? ` (Nv${lv + 1} con ${nx})` : ' (MÁX)'),
  synDesc: { Fire: 'Quemadura: tus golpes de Fuego siguen ardiendo', Ice: 'Congelación: todo golpe se amplifica, las armas de Hielo hacen más críticos', Thunder: 'Cadena: los golpes de Trueno pueden dividirse en rayos (variable)' },
  synFx: { Fire: (p, k) => `golpes de Fuego queman ${p}% × ${k}`, Ice: (p, c) => `todos los golpes +${p}% · crít. Hielo +${c}%`, Thunder: (c, n) => `golpes de Trueno: ${c}% → ${n} rayos` },
  lv3: { Fire: 'INFIERNO: +1 tic por cada 3 objetos de Fuego extra', Ice: 'ESTALLIDO: +1× daño crítico para todo', Thunder: 'TORMENTA: los rayos en cadena pueden ser críticos' },
  combosT: 'COMBOS', comboN: { melt: 'FUSIÓN', superconduct: 'SUPERCONDUCCIÓN', overload: 'SOBRECARGA' },
  comboD: { melt: 'Fuego + Hielo: quemadura ×4, y ×1.6 por Nv del combo (el menor de los dos)', superconduct: 'Hielo + Trueno: daño crítico ×2.5, y ×1.4 por Nv del combo', overload: 'Fuego + Trueno: explosión de +100% de los golpes, y ×1.5 por Nv del combo' },
  comboOff: 'necesita dos elementos en Nv1 (3 objetos cada uno)',
  weakT: 'DÉBIL', resistT: 'RESISTE', nextBoss: 'SIGUIENTE', infWeakTag: (x) => `DEBILIDAD ×${x}`, hqTag: 'ALTA CALIDAD', infResTag: (x) => `RESISTIDO ×${x}`,
  infNote: 'Tu ataque toma el elemento del cofre que abras', infPop: (el, x) => `¡${el} ×${x}!`,
  execPop: '¡EJECUCIÓN!', execLine: (p) => `Línea de ejecución ${p}%`, echoTag: 'ECO', overloadPop: (v) => `SOBRECARGA +${v}`, meltPop: '¡FUSIÓN ×3!', scPop: '¡SUPERCONDUCCIÓN!',
  permPop: (p) => `+${p}% PERMANENTE`, permLine: (p) => `Bono permanente de exceso +${p}%`, greedPop: '¡CODICIA: +1 RAREZA!',
  gemDesc: 'Los cofres normales a veces sueltan una. Quita sola tu peor objeto maldito; si no hay maldición, se guarda.',
  hitsCombo: (n, c) => `×${n} GOLPES · COMBO ×${c}`,
  sub1: 'Jefes sin fin. Elige un cofre elemental y golpea una vez.',
},
/*</es>*/
};
for (const l of LANGS) Object.assign(I18N[l], I18N8[l]);

// v7.2 build readability: next-level reward, combo condition/effect, chest build hints, level-up banners
const I18N9 = {
/*<en>*/
en: {
  rw: { Fire: (p, k) => `burn ${p}%×${k}`, Ice: (p, c) => `frost +${p}% crit +${c}%`, Thunder: (c, n) => `${c}% → ${n} bolts` }, rwMast: (x) => `dmg ×${x}`,
  lvUp: (el, n) => `${el} Lv${n}!`, comboNeed: (n) => `need ${n} more`, hintLv: (n) => `1 more to Lv${n}!`, hintCombo: (c) => `Unlocks ${c}!`,
  comboUp: (c, n) => `${c} Lv${n}!`, comboUnl: (c) => `${c} UNLOCKED!`,
  cfx: { melt: (x) => `burn ×${x}`, superconduct: (x) => `crit ×${x}`, overload: (p) => `boom +${p}%` },
},
/*</en>*/
/*<zh>*/
zh: {
  rw: { Fire: (p, k) => `灼烧 ${p}%×${k}`, Ice: (p, c) => `冰冻 +${p}% · 暴击 +${c}%`, Thunder: (c, n) => `${c}% → ${n} 道闪电` }, rwMast: (x) => `伤害 ×${x}`,
  lvUp: (el, n) => `${el} ${n} 级！`, comboNeed: (n) => `还差 ${n} 件`, hintLv: (n) => `再 1 件升 ${n} 级！`, hintCombo: (c) => `解锁${c}！`,
  comboUp: (c, n) => `${c} ${n} 级！`, comboUnl: (c) => `${c} 解锁！`,
  cfx: { melt: (x) => `灼烧 ×${x}`, superconduct: (x) => `暴伤 ×${x}`, overload: (p) => `爆炸 +${p}%` },
},
/*</zh>*/
/*<ja>*/
ja: {
  rw: { Fire: (p, k) => `燃焼 ${p}%×${k}`, Ice: (p, c) => `凍結 +${p}% · 会心 +${c}%`, Thunder: (c, n) => `${c}% → 稲妻${n}本` }, rwMast: (x) => `ダメージ ×${x}`,
  lvUp: (el, n) => `${el} Lv${n}！`, comboNeed: (n) => `あと${n}個`, hintLv: (n) => `あと1個でLv${n}！`, hintCombo: (c) => `${c} 解放！`,
  comboUp: (c, n) => `${c} Lv${n}！`, comboUnl: (c) => `${c} 解放！`,
  cfx: { melt: (x) => `燃焼 ×${x}`, superconduct: (x) => `会心 ×${x}`, overload: (p) => `爆発 +${p}%` },
},
/*</ja>*/
/*<ko>*/
ko: {
  rw: { Fire: (p, k) => `화상 ${p}%×${k}`, Ice: (p, c) => `빙결 +${p}% · 치명 +${c}%`, Thunder: (c, n) => `${c}% → 번개 ${n}개` }, rwMast: (x) => `피해 ×${x}`,
  lvUp: (el, n) => `${el} Lv${n}!`, comboNeed: (n) => `${n}개 더 필요`, hintLv: (n) => `1개 더 → Lv${n}!`, hintCombo: (c) => `${c} 해금!`,
  comboUp: (c, n) => `${c} Lv${n}!`, comboUnl: (c) => `${c} 해금!`,
  cfx: { melt: (x) => `화상 ×${x}`, superconduct: (x) => `치명 ×${x}`, overload: (p) => `폭발 +${p}%` },
},
/*</ko>*/
/*<pt>*/
pt: {
  rw: { Fire: (p, k) => `queima ${p}%×${k}`, Ice: (p, c) => `gelo +${p}% · crít +${c}%`, Thunder: (c, n) => `${c}% → ${n} raios` }, rwMast: (x) => `dano ×${x}`,
  lvUp: (el, n) => `${el} Nv${n}!`, comboNeed: (n) => `faltam ${n}`, hintLv: (n) => `+1 para Nv${n}!`, hintCombo: (c) => `Desbloqueia ${c}!`,
  comboUp: (c, n) => `${c} Nv${n}!`, comboUnl: (c) => `${c} DESBLOQUEADO!`,
  cfx: { melt: (x) => `queima ×${x}`, superconduct: (x) => `crít ×${x}`, overload: (p) => `explosão +${p}%` },
},
/*</pt>*/
/*<es>*/
es: {
  rw: { Fire: (p, k) => `quema ${p}%×${k}`, Ice: (p, c) => `hielo +${p}% · crít +${c}%`, Thunder: (c, n) => `${c}% → ${n} rayos` }, rwMast: (x) => `daño ×${x}`,
  lvUp: (el, n) => `¡${el} Nv${n}!`, comboNeed: (n) => `faltan ${n}`, hintLv: (n) => `¡+1 para Nv${n}!`, hintCombo: (c) => `¡Desbloquea ${c}!`,
  comboUp: (c, n) => `¡${c} Nv${n}!`, comboUnl: (c) => `¡${c} DESBLOQUEADO!`,
  cfx: { melt: (x) => `quema ×${x}`, superconduct: (x) => `crít ×${x}`, overload: (p) => `explosión +${p}%` },
},
/*</es>*/
};
for (const l of LANGS) Object.assign(I18N[l], I18N9[l]);
// v7.3: type-guarantee chest tag, boss drop source, overkill -> drop rarity, stats hint; intro no longer says "strike once"
const I18N10 = {
/*<en>*/
en: {
  sub1: 'Endless bosses. Pick ONE chest, then strike.', introLine: 'Pick 1 chest, then strike the boss.',
  kindTag: { weapon: 'GUARANTEED WEAPON', armor: 'GUARANTEED ARMOR', accessory: 'GUARANTEED ACCESSORY' },
  bossDrop: 'BOSS DROP', bossBadge: 'BOSS', okRare: (q, p, b) => `Overkill ×${q} → Rare+ ${p}% (normally ${b}%)`,
  statHint: 'Armor / accessories unlock Execute · Echo · Greed · Permanent', statNew: 'NEW!',
},
/*</en>*/
/*<zh>*/
zh: {
  sub1: '无尽 Boss。每关选一个宝箱，然后挥刀。', introLine: '选 1 个宝箱，然后砍向 Boss！',
  kindTag: { weapon: '必出武器', armor: '必出护甲', accessory: '必出饰品' },
  bossDrop: 'Boss 掉落', bossBadge: 'BOSS', okRare: (q, p, b) => `溢出 ×${q} → 稀有以上 ${p}%（平时 ${b}%）`,
  statHint: '护甲/饰品可解锁 斩杀·回响·贪婪·永久加成', statNew: '新！',
},
/*</zh>*/
/*<ja>*/
ja: {
  sub1: '終わりなきボス。宝箱を1つ選んで、斬りかかれ。', introLine: '宝箱を1つ選んで、ボスを斬れ！',
  kindTag: { weapon: '武器確定', armor: '防具確定', accessory: '装飾品確定' },
  bossDrop: 'ボスドロップ', bossBadge: 'BOSS', okRare: (q, p, b) => `オーバーキル ×${q} → レア以上 ${p}%（通常 ${b}%）`,
  statHint: '防具・装飾品で 処刑・残響・強欲・永続 が解放', statNew: 'NEW！',
},
/*</ja>*/
/*<ko>*/
ko: {
  sub1: '끝없는 보스. 상자 하나를 고르고, 베어라.', introLine: '상자 1개를 고르고, 보스를 베어라!',
  kindTag: { weapon: '무기 확정', armor: '방어구 확정', accessory: '장신구 확정' },
  bossDrop: '보스 드롭', bossBadge: 'BOSS', okRare: (q, p, b) => `오버킬 ×${q} → 레어 이상 ${p}% (평소 ${b}%)`,
  statHint: '방어구/장신구로 처형·메아리·탐욕·영구 보너스 해금', statNew: 'NEW!',
},
/*</ko>*/
/*<pt>*/
pt: {
  sub1: 'Chefões sem fim. Escolha UM baú e golpeie.', introLine: 'Escolha 1 baú e golpeie o chefão.',
  kindTag: { weapon: 'ARMA GARANTIDA', armor: 'ARMADURA GARANTIDA', accessory: 'ACESSÓRIO GARANTIDO' },
  bossDrop: 'DROP DO CHEFÃO', bossBadge: 'BOSS', okRare: (q, p, b) => `Overkill ×${q} → Raro+ ${p}% (normal ${b}%)`,
  statHint: 'Armaduras / acessórios liberam Execução · Eco · Ganância · Permanente', statNew: 'NOVO!',
},
/*</pt>*/
/*<es>*/
es: {
  sub1: 'Jefes sin fin. Elige UN cofre y golpea.', introLine: 'Elige 1 cofre y golpea al jefe.',
  kindTag: { weapon: 'ARMA GARANTIZADA', armor: 'ARMADURA GARANTIZADA', accessory: 'ACCESORIO GARANTIZADO' },
  bossDrop: 'BOTÍN DEL JEFE', bossBadge: 'JEFE', okRare: (q, p, b) => `Overkill ×${q} → Raro+ ${p}% (normal ${b}%)`,
  statHint: 'Armaduras / accesorios desbloquean Ejecución · Eco · Codicia · Permanente', statNew: '¡NUEVO!',
},
/*</es>*/
};
for (const l of LANGS) Object.assign(I18N[l], I18N10[l]);
// v8 (portrait UI): merged STATS + GEAR page
const I18N11 = {
/*<en>*/
en: { elemT: 'ELEMENTS', comboT: 'COMBOS', allT: 'All', cursedT: 'Cursed', noneT: 'Nothing here yet', pageT: 'HERO · STATS & GEAR' },
/*</en>*/
/*<zh>*/
zh: { elemT: '元素', comboT: '组合技', allT: '全部', cursedT: '诅咒', noneT: '还没有', pageT: '勇者 · 属性与装备' },
/*</zh>*/
/*<ja>*/
ja: { elemT: '属性', comboT: 'コンボ', allT: 'すべて', cursedT: '呪い', noneT: 'まだありません', pageT: '勇者・ステータスと装備' },
/*</ja>*/
/*<ko>*/
ko: { elemT: '원소', comboT: '콤보', allT: '전체', cursedT: '저주', noneT: '아직 없음', pageT: '용사 · 능력치와 장비' },
/*</ko>*/
/*<pt>*/
pt: { elemT: 'ELEMENTOS', comboT: 'COMBOS', allT: 'Tudo', cursedT: 'Amaldiçoado', noneT: 'Nada aqui ainda', pageT: 'HERÓI · STATUS E EQUIPAMENTO' },
/*</pt>*/
/*<es>*/
es: { elemT: 'ELEMENTOS', comboT: 'COMBOS', allT: 'Todo', cursedT: 'Maldito', noneT: 'Nada todavía', pageT: 'HÉROE · ESTADÍSTICAS Y EQUIPO' },
/*</es>*/
};
for (const l of LANGS) Object.assign(I18N[l], I18N11[l]);
// v8.1: small landscape frames (the X feed) show a readable cover instead of a shrunken portrait game
const I18N12 = {
/*<en>*/
en: { coverPlay: 'Tap to play', coverSub: 'Pick 1 of 3 chests · strike the boss', coverRotate: 'Turn your phone upright to play', coverOpen: 'Opened in a new tab' },
/*</en>*/
/*<zh>*/
zh: { coverPlay: '点击开玩', coverSub: '三选一开宝箱 · 挥刀砍向 Boss', coverRotate: '请竖屏游玩', coverOpen: '已在新标签页打开' },
/*</zh>*/
/*<ja>*/
ja: { coverPlay: 'タップでプレイ', coverSub: '3つの宝箱から1つ選んでボスを斬れ', coverRotate: 'スマホを縦向きにしてプレイ', coverOpen: '新しいタブで開きました' },
/*</ja>*/
/*<ko>*/
ko: { coverPlay: '탭해서 플레이', coverSub: '상자 3개 중 1개 선택 · 보스를 베어라', coverRotate: '휴대폰을 세로로 돌려 플레이하세요', coverOpen: '새 탭에서 열었습니다' },
/*</ko>*/
/*<pt>*/
pt: { coverPlay: 'Toque para jogar', coverSub: 'Escolha 1 de 3 baús · golpeie o chefe', coverRotate: 'Gire o celular na vertical para jogar', coverOpen: 'Aberto em uma nova aba' },
/*</pt>*/
/*<es>*/
es: { coverPlay: 'Toca para jugar', coverSub: 'Elige 1 de 3 cofres · golpea al jefe', coverRotate: 'Pon el móvil en vertical para jugar', coverOpen: 'Abierto en una pestaña nueva' },
/*</es>*/
};
for (const l of LANGS) Object.assign(I18N[l], I18N12[l]);
const NOUN_KEYS = ['Sword', 'Dagger', 'Mace', 'Bow', 'Axe', 'Blade', 'Staff', 'Spear', 'Armor', 'Boots', 'Helm', 'Amulet', 'Ring', 'Pendant', 'Medal', 'Talisman', 'Relic', 'Idol', 'Grimoire', 'Shard'];
const CJK_FONT = { zh: 'FusionZH', ja: 'FusionJA', ko: 'FusionKO' };
function detectLang() {
  try { const s = localStorage.getItem('dc_lang'); if (LANGS.includes(s)) return s; } catch (e) {}
  const navs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en']).map((l) => String(l).toLowerCase());
  for (const l of navs) { const c = l.slice(0, 2); if (LANGS.includes(c)) return c; }
  return 'en';
}
let LANG = detectLang();
// "PixelDigits" only covers 0-9 (unicode-range), so numbers get clean blocky digits where 2/3/5/8 never look alike
function fontFor(lang) { return CJK_FONT[lang] ? `"PixelDigits", "Pixelify Sans", "${CJK_FONT[lang]}", sans-serif` : '"PixelDigits", "Pixelify Sans", "Trebuchet MS", sans-serif'; }
function loadLangFont(lang) {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  const f = CJK_FONT[lang]; const sample = { zh: '屠龙', ja: 'ドラ', ko: '드래' }[lang];
  const ps = ['700 32px "Pixelify Sans"', '400 16px "Pixelify Sans"'].map((x) => document.fonts.load(x));
  ps.push(document.fonts.load('700 32px "PixelDigits"', '0123456789\uE000\uE001\uE002\uE003\uE004'));
  if (f) ps.push(document.fonts.load(`16px "${f}"`, sample));
  return Promise.race([Promise.all(ps), new Promise((r) => setTimeout(r, 3000))]);
}
function setLang(lang) { LANG = lang; try { localStorage.setItem('dc_lang', lang); } catch (e) {} document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : lang === 'pt' ? 'pt-BR' : lang; }
function t(key, ...a) { const d = I18N[LANG] || I18N.en; const v = d[key] !== undefined ? d[key] : I18N.en[key]; return typeof v === 'function' ? v(...a) : v; }
