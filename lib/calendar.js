// 共用的曆法輔助工具：處理國曆日期/時辰字串轉換
const { Solar } = require('lunar-javascript');

/**
 * 將 24 小時制的小時數，轉換成紫微斗數所需的時辰序號（0~12）
 * 0=早子時(23) 1=丑(01-03) 2=寅(03-05) ... 11=亥(21-23) 12=晚子時(00)
 */
function timeIndexFromHour(hour) {
  if (hour === 23) return 0;
  if (hour === 0) return 12;
  return Math.floor((hour + 1) / 2);
}

// 台澎金馬各縣市經度（度），用於真太陽時校正。全台統一以東經120度為標準時區基準。
const TW_LONGITUDES = {
  台北市: 121.5654, 新北市: 121.4628, 基隆市: 121.7392, 桃園市: 121.3010,
  新竹市: 120.9647, 新竹縣: 121.0177, 苗栗縣: 120.8214, 台中市: 120.6736,
  彰化縣: 120.5161, 南投縣: 120.6850, 雲林縣: 120.4313, 嘉義市: 120.4473,
  嘉義縣: 120.5586, 台南市: 120.2270, 高雄市: 120.3014, 屏東縣: 120.4890,
  宜蘭縣: 121.7536, 花蓮縣: 121.6068, 台東縣: 121.1439, 澎湖縣: 119.5763,
  金門縣: 118.3181, 連江縣: 119.9515,
};

// 每偏離標準經線（120°E）1 度，時間相差 4 分鐘
function trueSolarOffsetMinutes(longitude) {
  if (typeof longitude !== 'number' || Number.isNaN(longitude)) return 0;
  return Math.round((longitude - 120) * 4);
}

/**
 * 解析出生日期/時辰，並依出生地做真太陽時校正（僅在已知確切時辰且出生地在對照表中才校正）
 * @param {string} birthDate 'YYYY-MM-DD'
 * @param {string|null|undefined} birthTime 'HH:mm'
 * @param {string|null|undefined} birthPlace 對照表中的縣市名稱
 */
function correctedBirthDateTime(birthDate, birthTime, birthPlace) {
  const [y, m, d] = birthDate.split('-').map(Number);
  let hour = 12;
  let minute = 0;
  let timeKnown = false;
  if (birthTime && /^\d{1,2}:\d{2}$/.test(birthTime)) {
    const [hh, mm] = birthTime.split(':').map(Number);
    hour = hh;
    minute = mm;
    timeKnown = true;
  }

  let offsetMinutes = 0;
  if (timeKnown && birthPlace && TW_LONGITUDES[birthPlace] !== undefined) {
    offsetMinutes = trueSolarOffsetMinutes(TW_LONGITUDES[birthPlace]);
  }

  let dt = new Date(Date.UTC(y, m - 1, d, hour, minute));
  if (offsetMinutes) dt = new Date(dt.getTime() + offsetMinutes * 60000);

  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
    hour: dt.getUTCHours(),
    minute: dt.getUTCMinutes(),
    timeKnown,
    offsetMinutes,
    birthPlace: offsetMinutes !== 0 ? birthPlace : null,
  };
}

/**
 * 解析出生日期時間字串，回傳 Solar 物件與是否已知確切時辰
 * @param {string} birthDate 'YYYY-MM-DD'
 * @param {string|null|undefined} birthTime 'HH:mm'
 * @param {string|null|undefined} birthPlace 對照表中的縣市名稱
 */
function parseBirth(birthDate, birthTime, birthPlace) {
  const c = correctedBirthDateTime(birthDate, birthTime, birthPlace);
  const solar = Solar.fromYmdHms(c.year, c.month, c.day, c.hour, c.minute, 0);
  return {
    solar,
    lunar: solar.getLunar(),
    hour: c.hour,
    minute: c.minute,
    timeKnown: c.timeKnown,
    offsetMinutes: c.offsetMinutes,
    birthPlace: c.birthPlace,
  };
}

// lunar-javascript 僅提供簡體／英文輸出，這裡針對生肖、星座、十神會用到的少數
// 簡體字做對應轉換，讓顯示與其餘繁體中文內容一致（干支、五行用字兩岸相同，無需轉換）
const S2T_MAP = {
  龙: '龍', 马: '馬', 鸡: '雞',
  双: '雙', 狮: '獅', 处: '處', 蝎: '蠍', 鱼: '魚',
  财: '財', 伤: '傷', 杀: '殺',
};

function s2t(str) {
  if (!str) return str;
  return str.replace(/./g, (ch) => S2T_MAP[ch] || ch);
}

module.exports = { timeIndexFromHour, parseBirth, correctedBirthDateTime, trueSolarOffsetMinutes, TW_LONGITUDES, s2t };
