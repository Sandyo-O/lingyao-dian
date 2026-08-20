// 紫微斗數排盤：使用 iztro 精確計算十二宮、主星、大限
const { astro } = require('iztro');
const { timeIndexFromHour } = require('./calendar');

function computeZiWei({ birthDate, birthTime, gender }) {
  const [y, m, d] = birthDate.split('-').map(Number);
  let hour = 12;
  let timeKnown = false;
  if (birthTime && /^\d{1,2}:\d{2}$/.test(birthTime)) {
    hour = Number(birthTime.split(':')[0]);
    timeKnown = true;
  }
  const timeIndex = timeIndexFromHour(hour);
  const genderCn = gender === 'male' ? '男' : '女';
  const solarDateStr = `${y}-${m}-${d}`;

  const astrolabe = astro.bySolar(solarDateStr, timeIndex, genderCn, true, 'zh-TW');

  const formatStar = (s) => {
    let label = s.name;
    if (s.brightness) label += `(${s.brightness})`;
    if (s.mutagen) label += `[${s.mutagen}]`;
    return label;
  };

  const palaces = astrolabe.palaces.map((p) => ({
    name: p.name,
    stem: p.heavenlyStem,
    branch: p.earthlyBranch,
    isBodyPalace: p.isBodyPalace,
    majorStars: p.majorStars.map(formatStar),
    minorStars: p.minorStars.map(formatStar),
    adjectiveStars: (p.adjectiveStars || []).map((s) => s.name),
    decadalRange: p.decadal ? p.decadal.range : null,
  }));

  return {
    solarDate: astrolabe.solarDate,
    lunarDate: astrolabe.lunarDate,
    time: astrolabe.time,
    timeRange: astrolabe.timeRange,
    sign: astrolabe.sign,
    zodiac: astrolabe.zodiac,
    fiveElementsClass: astrolabe.fiveElementsClass,
    soul: astrolabe.soul,
    body: astrolabe.body,
    timeKnown,
    palaces,
  };
}

module.exports = { computeZiWei };
