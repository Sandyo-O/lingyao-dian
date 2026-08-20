// 紫微斗數排盤：使用 iztro 精確計算十二宮、主星、大限
const { astro } = require('iztro');
const { timeIndexFromHour, correctedBirthDateTime } = require('./calendar');

function computeZiWei({ birthDate, birthTime, gender, birthPlace }) {
  const c = correctedBirthDateTime(birthDate, birthTime, birthPlace);
  const timeIndex = timeIndexFromHour(c.hour);
  const genderCn = gender === 'male' ? '男' : '女';
  const solarDateStr = `${c.year}-${c.month}-${c.day}`;

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
    timeKnown: c.timeKnown,
    offsetMinutes: c.offsetMinutes,
    birthPlace: c.birthPlace,
    palaces,
  };
}

module.exports = { computeZiWei };
