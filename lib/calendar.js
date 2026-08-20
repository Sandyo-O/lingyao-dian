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

/**
 * 解析出生日期時間字串，回傳 Solar 物件與是否已知確切時辰
 * @param {string} birthDate 'YYYY-MM-DD'
 * @param {string|null|undefined} birthTime 'HH:mm'
 */
function parseBirth(birthDate, birthTime) {
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
  const solar = Solar.fromYmdHms(y, m, d, hour, minute, 0);
  return { solar, lunar: solar.getLunar(), hour, minute, timeKnown };
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

module.exports = { timeIndexFromHour, parseBirth, s2t };
