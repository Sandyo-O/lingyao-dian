// 八字命理計算：使用 lunar-javascript 精確排出四柱、十神、五行、大運
const { parseBirth, s2t } = require('./calendar');

function computeBaZi({ birthDate, birthTime, gender }) {
  const { solar, lunar, timeKnown } = parseBirth(birthDate, birthTime);
  const bz = lunar.getEightChar();
  const genderCode = gender === 'male' ? 1 : 0;

  const yun = bz.getYun(genderCode);
  const rawDaYun = yun.getDaYun(9); // 第一筆為出生到起運前的童限
  const childhood = rawDaYun[0]
    ? { startAge: rawDaYun[0].getStartAge(), endAge: rawDaYun[0].getEndAge() }
    : null;
  const daYunList = rawDaYun.slice(1).map((dy) => ({
    startAge: dy.getStartAge(),
    endAge: dy.getEndAge(),
    startYear: dy.getStartYear(),
    endYear: dy.getEndYear(),
    ganZhi: dy.getGanZhi(),
  }));

  return {
    solarDate: solar.toYmdHms(),
    lunarDate: lunar.toString(),
    shengxiao: s2t(lunar.getYearShengXiao()),
    xingzuo: `${s2t(solar.getXingZuo())}座`,
    timeKnown,
    pillars: {
      year: bz.getYear(),
      month: bz.getMonth(),
      day: bz.getDay(),
      time: timeKnown ? bz.getTime() : null,
    },
    wuxing: {
      year: bz.getYearWuXing(),
      month: bz.getMonthWuXing(),
      day: bz.getDayWuXing(),
      time: timeKnown ? bz.getTimeWuXing() : null,
    },
    shishen: {
      year: s2t(bz.getYearShiShenGan()),
      month: s2t(bz.getMonthShiShenGan()),
      time: timeKnown ? s2t(bz.getTimeShiShenGan()) : null,
    },
    dayMaster: bz.getDayGan(),
    childhood,
    daYun: daYunList,
  };
}

module.exports = { computeBaZi };
