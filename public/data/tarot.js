// 78 張塔羅牌完整資料（大阿爾克那 22 張 + 小阿爾克那 56 張）
// 每張牌提供正位／逆位關鍵字，實際的深入解讀交由後端 Claude 產生
const TAROT_DECK = [
  // ---------------- 大阿爾克那 Major Arcana ----------------
  { name: '愚者', symbol: '🃏', arcana: 'major', upright: '新開始、冒險、天真、自由', reversed: '魯莽、猶豫不決、風險失控' },
  { name: '魔術師', symbol: '🪄', arcana: 'major', upright: '創造力、行動力、資源整合', reversed: '操弄、才華未發揮、投機取巧' },
  { name: '女祭司', symbol: '🌙', arcana: 'major', upright: '直覺、內在智慧、神秘、靜觀', reversed: '忽視直覺、表裡不一、秘密曝光' },
  { name: '皇后', symbol: '👑', arcana: 'major', upright: '豐盛、母性、創造、滋養', reversed: '過度依賴、停滯、忽略自我' },
  { name: '皇帝', symbol: '🏛️', arcana: 'major', upright: '權威、秩序、穩定、掌控', reversed: '固執、專制、失去掌控' },
  { name: '教皇', symbol: '⛪', arcana: 'major', upright: '傳統、信念、指導、學習', reversed: '教條主義、叛逆、質疑體制' },
  { name: '戀人', symbol: '💞', arcana: 'major', upright: '選擇、和諧、深刻連結', reversed: '關係失衡、抉擇困難、價值衝突' },
  { name: '戰車', symbol: '🏎️', arcana: 'major', upright: '意志力、勝利、堅定前進', reversed: '失控、方向迷失、內耗' },
  { name: '力量', symbol: '🦁', arcana: 'major', upright: '溫柔堅韌、內在力量、勇氣', reversed: '自我懷疑、濫用力量、脆弱' },
  { name: '隱士', symbol: '🏮', arcana: 'major', upright: '內省、獨處、尋找答案', reversed: '孤立、逃避、封閉自己' },
  { name: '命運之輪', symbol: '🎡', arcana: 'major', upright: '轉機、循環、命運變化', reversed: '停滯、抗拒改變、時運不濟' },
  { name: '正義', symbol: '⚖️', arcana: 'major', upright: '公平、因果、理性判斷', reversed: '不公、逃避責任、偏見' },
  { name: '吊人', symbol: '🙃', arcana: 'major', upright: '換位思考、犧牲、暫停等待', reversed: '徒勞的犧牲、停滯不前' },
  { name: '死神', symbol: '🦋', arcana: 'major', upright: '結束、轉化、重生（並非實際死亡）', reversed: '抗拒改變、停滯、拖延結束' },
  { name: '節制', symbol: '🕊️', arcana: 'major', upright: '平衡、調和、耐心整合', reversed: '失衡、極端、缺乏耐性' },
  { name: '惡魔', symbol: '⛓️', arcana: 'major', upright: '束縛、慾望、物質誘惑', reversed: '掙脫束縛、覺察執念、解放' },
  { name: '高塔', symbol: '🌩️', arcana: 'major', upright: '劇變、崩解、突發真相', reversed: '延遲的崩壞、逃避必要的改變' },
  { name: '星星', symbol: '⭐', arcana: 'major', upright: '希望、療癒、信念、靈感', reversed: '失望、信心動搖、迷失方向' },
  { name: '月亮', symbol: '🌕', arcana: 'major', upright: '潛意識、幻象、不安、直覺考驗', reversed: '真相漸明、走出恐懼、誤解澄清' },
  { name: '太陽', symbol: '☀️', arcana: 'major', upright: '喜悅、成功、活力、清晰', reversed: '過度樂觀、短暫的陰霾、能量受阻' },
  { name: '審判', symbol: '📯', arcana: 'major', upright: '覺醒、重生、重要決定、召喚', reversed: '自我批判、猶豫不決、逃避覺醒' },
  { name: '世界', symbol: '🌍', arcana: 'major', upright: '圓滿、完成、整合、成就', reversed: '未竟之事、缺乏終點感、延宕' },
];

const SUITS = [
  { key: 'wands', name: '權杖', symbol: '🔥', theme: '熱情、事業、行動力' },
  { key: 'cups', name: '聖杯', symbol: '🌊', theme: '情感、關係、內心世界' },
  { key: 'swords', name: '寶劍', symbol: '⚔️', theme: '思想、衝突、決策' },
  { key: 'pentacles', name: '錢幣', symbol: '🪙', theme: '物質、財務、現實層面' },
];

const RANK_MEANINGS = [
  { rank: 'Ace／首牌', upright: '全新的能量與契機萌芽', reversed: '機會延遲、能量受阻、起步不順' },
  { rank: '2', upright: '抉擇、夥伴、平衡的開端', reversed: '猶豫、失衡、關係卡關' },
  { rank: '3', upright: '成長、合作、初步成果', reversed: '團隊摩擦、成果延遲' },
  { rank: '4', upright: '穩定、休整、暫時的安定', reversed: '停滯太久、故步自封' },
  { rank: '5', upright: '衝突、競爭、變動的壓力', reversed: '衝突緩和或內耗加劇（視情境）' },
  { rank: '6', upright: '和解、支持、階段性勝利', reversed: '自滿、舊事重演、單方付出' },
  { rank: '7', upright: '堅持、評估、面對挑戰', reversed: '半途而廢、過度猶豫' },
  { rank: '8', upright: '快速進展、行動、專注', reversed: '延誤、方向錯置、心力分散' },
  { rank: '9', upright: '接近完成、堅韌、戒備心', reversed: '疲憊、過度防衛、快撐不住' },
  { rank: '10', upright: '完成、收穫、階段的終點', reversed: '負擔過重、收尾拖泥帶水' },
  { rank: '侍者／侍衛', upright: '學習、初心、傳遞訊息', reversed: '不成熟、消息延遲、三分鐘熱度' },
  { rank: '騎士', upright: '行動派、追求目標、衝勁', reversed: '魯莽、方向不明、半途而廢' },
  { rank: '皇后', upright: '成熟、滋養、掌握該領域的智慧', reversed: '情緒化、過度控制、能量耗竭' },
  { rank: '國王', upright: '掌控全局、權威、該領域的大師', reversed: '獨裁、濫權、僵化固執' },
];

const MINOR_ARCANA = [];
SUITS.forEach((suit) => {
  RANK_MEANINGS.forEach((r) => {
    MINOR_ARCANA.push({
      name: `${suit.name}${r.rank}`,
      symbol: suit.symbol,
      arcana: 'minor',
      suit: suit.name,
      upright: `${r.upright}（${suit.theme}）`,
      reversed: `${r.reversed}（${suit.theme}）`,
    });
  });
});

const FULL_DECK = [...TAROT_DECK, ...MINOR_ARCANA];

const SPREADS = {
  single: { label: '單張牌｜今日指引', positions: ['當下的訊息'] },
  three: { label: '三張牌｜過去・現在・未來', positions: ['過去', '現在', '未來'] },
  celtic: {
    label: '凱爾特十字｜完整深度解讀',
    positions: [
      '現況核心', '當前的挑戰', '意識層面／目標', '潛意識／根源',
      '過去的影響', '即將到來', '你自己的態度', '外在環境／他人',
      '希望與恐懼', '最終結果',
    ],
  },
};

function drawCards(spreadKey) {
  const spread = SPREADS[spreadKey] || SPREADS.three;
  const deck = [...FULL_DECK];
  const drawn = [];
  for (const position of spread.positions) {
    const idx = Math.floor(Math.random() * deck.length);
    const card = deck.splice(idx, 1)[0];
    const reversed = Math.random() < 0.45;
    drawn.push({ position, name: card.name, symbol: card.symbol, reversed, meaning: reversed ? card.reversed : card.upright });
  }
  return drawn;
}
