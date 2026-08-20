require('dotenv').config();
const path = require('path');
const express = require('express');
const multer = require('multer');
const { GoogleGenAI } = require('@google/genai');

const { computeBaZi } = require('./lib/bazi');
const { computeZiWei } = require('./lib/ziwei');

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

if (!process.env.GEMINI_API_KEY) {
  console.error('缺少 GEMINI_API_KEY，請在 .env 檔案中設定。');
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = 'gemini-2.5-flash';

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// 簡易流量防護：公開分享時避免單一來源把 API 額度耗盡（非帳號機制，只是止血用）
const RATE_LIMIT_MAX = 20; // 每個 IP 每小時最多幾次占卜請求
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const rateBuckets = new Map();

function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  let bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.start > RATE_LIMIT_WINDOW_MS) {
    bucket = { start: now, count: 0 };
    rateBuckets.set(ip, bucket);
  }
  bucket.count += 1;
  if (bucket.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ error: '這個小時的占卜次數已經用完囉，請稍後再試一次（避免服務被過度使用）。' });
  }
  next();
}

// ---------------------------------------------------------------------------
// 通用占卜師人設
// ---------------------------------------------------------------------------
const PERSONA = `你是「靈曜殿」的資深占卜師，精通塔羅牌、紫微斗數、八字命理、西洋占星、姓名學與面相手相等多種東西方玄學。
你的語氣溫暖、有智慧、帶點神秘感，善於用生動的譬喻說故事，但不會危言聳聽。

規則：
- 一律使用繁體中文回覆。
- 全程定位為「娛樂與自我探索用途」，即使使用者沒問，也不需要每段都重複免責聲明，但絕對不要做出攸關生死、絕症、精準壽命、慫恿使用者做出傷害自己或他人決定的斷言。
- 避免對外貌、身材做出關於智力、道德、健康的武斷評價；面相手相僅作為個性與運勢的趣味詮釋，不做醫療或歧視性論斷。
- 回答時使用 Markdown 格式，適當使用「## 標題」分段（例如 性格解析、感情、事業與財運、健康與身心、人生大事、給你的提醒），並可使用條列與粗體，但不要輸出程式碼區塊。
- 如果系統提供了精確排盤的結構化資料（八字四柱、紫微十二宮等），必須以該資料為準進行推論，不要自行編造干支或星曜。
- 語氣像是一位真心關心提問者的長輩／朋友，會針對使用者提出的問題給予具體、有畫面感、可行動的建議，而不是空泛的套話。`;

// 把 Anthropic 風格的 messages（role: user/assistant，content 可為字串或 blocks）
// 轉成 Gemini 的 contents 格式（role: user/model，parts 陣列）。
function toGeminiContents(messages) {
  return messages.map((m) => {
    const role = m.role === 'assistant' ? 'model' : 'user';
    const parts = Array.isArray(m.content)
      ? m.content.map((block) => (
        block.type === 'image'
          ? { inlineData: { mimeType: block.source.media_type, data: block.source.data } }
          : { text: block.text }
      ))
      : [{ text: m.content }];
    return { role, parts };
  });
}

async function askGemini({ system, messages, maxTokens = 6000 }) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: toGeminiContents(messages),
    config: {
      systemInstruction: system,
      maxOutputTokens: maxTokens,
    },
  });

  const finishReason = response.candidates?.[0]?.finishReason;
  if (finishReason === 'SAFETY' || finishReason === 'PROHIBITED_CONTENT' || finishReason === 'BLOCKLIST') {
    return {
      text: '這位占卜師這次沈默了一下……似乎有些話題超出了他願意談論的範圍，可以換個方式再問一次嗎？',
      refusal: true,
    };
  }

  return { text: response.text || '（占卜師陷入了沉思，暫時說不出話來，請稍後再試一次。）', refusal: false };
}

function formatOffset(offsetMinutes) {
  if (!offsetMinutes) return '0 分鐘';
  return `${offsetMinutes > 0 ? '+' : ''}${offsetMinutes} 分鐘`;
}

function baziPromptBlock(label, gender, data) {
  const genderLabel = gender === 'male' ? '男性' : '女性';
  return `【${label}】（${genderLabel}）
出生：國曆 ${data.solarDate}（農曆 ${data.lunarDate}），生肖${data.shengxiao}，星座${data.xingzuo}
${data.timeKnown ? '' : '（未提供確切時辰，時柱僅供參考）'}${data.birthPlace ? `（已依出生地「${data.birthPlace}」校正真太陽時 ${formatOffset(data.offsetMinutes)}）` : ''}
四柱：年柱 ${data.pillars.year}（五行${data.wuxing.year}，十神${data.shishen.year}）／月柱 ${data.pillars.month}（五行${data.wuxing.month}，十神${data.shishen.month}）／日柱 ${data.pillars.day}（五行${data.wuxing.day}，日主天干${data.dayMaster}）／時柱 ${data.pillars.time || '未知'}（五行${data.wuxing.time || '未知'}${data.shishen.time ? `，十神${data.shishen.time}` : ''}）`;
}

function ziweiPromptBlock(label, gender, data) {
  const genderLabel = gender === 'male' ? '男性' : '女性';
  return `【${label}】（${genderLabel}）
出生：國曆 ${data.solarDate}，農曆 ${data.lunarDate}
${data.timeKnown ? '' : '（未提供確切時辰，本盤以中午12點暫代排出，僅供參考）'}${data.birthPlace ? `（已依出生地「${data.birthPlace}」校正真太陽時 ${formatOffset(data.offsetMinutes)}）` : ''}
西洋星座：${data.sign}　生肖：${data.zodiac}　五行局：${data.fiveElementsClass}　命宮主星：${data.soul}　身宮主星：${data.body}
十二宮：
${fmtPalaces(data.palaces)}`;
}

function fmtDaYun(list) {
  if (!list || !list.length) return '（無大運資料）';
  return list
    .slice(0, 6)
    .map((d) => `${d.startAge}-${d.endAge}歲（${d.startYear}-${d.endYear}）：${d.ganZhi}`)
    .join('\n');
}

function fmtPalaces(palaces) {
  return palaces
    .map((p) => {
      const stars = [...p.majorStars, ...p.minorStars].join('、') || '（空宮，無主星）';
      const body = p.isBodyPalace ? '（身宮）' : '';
      const decadal = p.decadalRange ? `　大限：${p.decadalRange[0]}-${p.decadalRange[1]}歲` : '';
      return `${p.name}${body}〔${p.stem}${p.branch}〕：${stars}${decadal}`;
    })
    .join('\n');
}

// ---------------------------------------------------------------------------
// /api/reading — 塔羅、紫微、八字、星座、姓名學（皆為 JSON 請求）
// ---------------------------------------------------------------------------
app.post('/api/reading', rateLimit, async (req, res) => {
  try {
    const { method, question } = req.body;
    let userText = '';
    let chart = null;

    if (method === 'tarot') {
      const { spread, cards } = req.body;
      const cardLines = (cards || [])
        .map((c) => `- ${c.position}：《${c.name}》（${c.reversed ? '逆位' : '正位'}）`)
        .join('\n');
      userText = `我使用「${spread}」牌陣進行占卜。\n我想問的問題是：「${question || '未特別設定問題，請綜合解讀近期整體運勢'}」\n\n抽出的牌卡如下：\n${cardLines}\n\n請你以塔羅牌師的身分，先簡述每張牌在該位置的意義，接著綜合整體給出一段有故事感、具體可行動的解讀。`;
      chart = { spread, cards };
    } else if (method === 'bazi') {
      const { name, gender, birthDate, birthTime, birthPlace } = req.body;
      const data = computeBaZi({ birthDate, birthTime, gender, birthPlace });
      chart = data;
      userText = `請幫「${name || '這位朋友'}」（${gender === 'male' ? '男性' : '女性'}）進行八字命理解讀。
出生資料：國曆 ${data.solarDate}（農曆 ${data.lunarDate}），生肖屬${data.shengxiao}，西洋星座為${data.xingzuo}。
${data.timeKnown ? '' : '（注意：使用者未提供確切出生時辰，時柱僅供參考，請在回覆中提醒此點。）'}
${data.birthPlace ? `（已依出生地「${data.birthPlace}」做真太陽時校正，時辰調整了 ${formatOffset(data.offsetMinutes)}）` : ''}

已排出的四柱（年柱/月柱/日柱/時柱）：
年柱：${data.pillars.year}（五行：${data.wuxing.year}，十神：${data.shishen.year}）
月柱：${data.pillars.month}（五行：${data.wuxing.month}，十神：${data.shishen.month}）
日柱：${data.pillars.day}（五行：${data.wuxing.day}，日主天干為 ${data.dayMaster}）
時柱：${data.pillars.time || '未知'}（五行：${data.wuxing.time || '未知'}${data.shishen.time ? `，十神：${data.shishen.time}` : ''}）

大運（每步約十年）：
${fmtDaYun(data.daYun)}

使用者想問的問題：「${question || '未特別設定問題，請綜合解讀個性、事業、感情、財運與健康'}」

請以八字命理師的身分，依照上述精確排出的四柱與十神五行資料進行分析，不要另外編造干支。`;
    } else if (method === 'ziwei') {
      const { name, gender, birthDate, birthTime, birthPlace } = req.body;
      const data = computeZiWei({ birthDate, birthTime, gender, birthPlace });
      chart = data;
      userText = `請幫「${name || '這位朋友'}」（${gender === 'male' ? '男性' : '女性'}）進行紫微斗數命盤解讀。
出生資料：國曆 ${data.solarDate}，農曆 ${data.lunarDate}，${data.timeRange || ''}${data.timeKnown ? '' : '（注意：使用者未提供確切出生時辰，本盤以中午12點暫代排出，命宮與各宮位僅供參考，請在回覆中提醒此點。）'}
${data.birthPlace ? `（已依出生地「${data.birthPlace}」做真太陽時校正，時辰調整了 ${formatOffset(data.offsetMinutes)}）` : ''}
西洋星座：${data.sign}　生肖：${data.zodiac}　五行局：${data.fiveElementsClass}
命宮主星：${data.soul}　身宮主星：${data.body}

十二宮完整排盤：
${fmtPalaces(data.palaces)}

使用者想問的問題：「${question || '未特別設定問題，請綜合解讀性格、事業、感情、財運與健康，並點出人生的大限重點'}」

請以紫微斗數命理師的身分，依照上述精確排出的宮位與星曜資料進行分析，不要另外編造星曜配置。`;
    } else if (method === 'astro') {
      const { name, gender, birthDate, birthTime } = req.body;
      const { parseBirth, s2t } = require('./lib/calendar');
      const { solar, lunar, timeKnown } = parseBirth(birthDate, birthTime);
      chart = { xingzuo: `${s2t(solar.getXingZuo())}座`, shengxiao: s2t(lunar.getYearShengXiao()), timeKnown };
      userText = `請幫「${name || '這位朋友'}」（${gender === 'male' ? '男性' : '女性'}）進行西洋占星解讀。
出生日期：${birthDate}${birthTime ? `，出生時間：${birthTime}` : '（未提供出生時間）'}
太陽星座：${chart.xingzuo}

${timeKnown ? '使用者有提供出生時間，你可以合理推測上升星座可能落在的範圍並說明這只是概略推估，並非精準星盤定位（因無出生地經緯度）。' : '使用者未提供出生時間，僅能以太陽星座進行解讀，請說明月亮／上升星座需要精確時間與地點才能定位。'}

使用者想問的問題：「${question || '未特別設定問題，請綜合解讀性格特質、感情觀、事業傾向與近期整體運勢'}」

請以西洋占星師的身分進行解讀。`;
    } else if (method === 'compat') {
      const { system, relation, personA, personB, question } = req.body;
      if (!personA || !personB || !personA.birthDate || !personB.birthDate) {
        return res.status(400).json({ error: '請填寫兩人的出生日期' });
      }
      const RELATION_LABELS = { love: '愛情／婚姻', work: '合作／事業夥伴', friend: '朋友', family: '家人' };
      const relationLabel = RELATION_LABELS[relation] || '關係';
      const labelA = personA.name || 'A';
      const labelB = personB.name || 'B';

      if (system === 'ziwei') {
        const dataA = computeZiWei(personA);
        const dataB = computeZiWei(personB);
        chart = { system: 'ziwei', personALabel: labelA, personBLabel: labelB, personA: dataA, personB: dataB };
        userText = `請幫「${labelA}」與「${labelB}」進行紫微斗數合盤分析，兩人關係為：${relationLabel}。

${ziweiPromptBlock(labelA, personA.gender, dataA)}

${ziweiPromptBlock(labelB, personB.gender, dataB)}

使用者想問的問題：「${question || `未特別設定問題，請綜合分析兩人個性契合度、相處模式、優缺點與互動建議`}」

請以紫微斗數合盤老師的身分，比較兩人命盤特質的異同、互補與磨合之處，並針對「${relationLabel}」關係給出具體、有畫面感、可行動的建議，不要另外編造星曜配置。`;
      } else {
        const dataA = computeBaZi(personA);
        const dataB = computeBaZi(personB);
        chart = { system: 'bazi', personALabel: labelA, personBLabel: labelB, personA: dataA, personB: dataB };
        userText = `請幫「${labelA}」與「${labelB}」進行八字合盤分析，兩人關係為：${relationLabel}。

${baziPromptBlock(labelA, personA.gender, dataA)}

${baziPromptBlock(labelB, personB.gender, dataB)}

使用者想問的問題：「${question || `未特別設定問題，請綜合分析兩人個性契合度、相處模式、優缺點與互動建議`}」

請以八字合盤老師的身分，比較兩人四柱五行、十神的生剋與互補之處，並針對「${relationLabel}」關係給出具體、有畫面感、可行動的建議，不要另外編造干支。`;
      }
    } else if (method === 'name') {
      const { surname, givenName, gender, birthDate } = req.body;
      chart = { surname, givenName };
      userText = `請幫「${surname || ''}${givenName || ''}」（${gender === 'male' ? '男性' : '女性'}）進行姓名學解讀。
${birthDate ? `出生日期：${birthDate}（可作為輔助參考）` : ''}

注意：系統並未提供康熙字典精確筆畫資料庫，請不要聲稱做出精確的「五格剖象」筆畫分析或編造具體筆畫數字。請改以：
1. 姓名用字本身的字義、部首意象與五行聯想
2. 字音、聲調唸起來給人的感受
3. 整體姓名給人的第一印象與可能呼應的性格特質
進行質性、趣味性的姓名學解讀，並誠實說明這是簡化版的娛樂性解讀。

使用者想問的問題：「${question || '未特別設定問題，請綜合解讀姓名給人的印象、可能呼應的個性與整體運勢建議'}」`;
    } else {
      return res.status(400).json({ error: '未知的占卜方式' });
    }

    const messages = [{ role: 'user', content: userText }];
    const result = await askGemini({ system: PERSONA, messages });

    messages.push({ role: 'assistant', content: result.text });

    res.json({ reading: result.text, chart, seed: messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '占卜過程發生了一點意外，請稍後再試一次。', detail: String(err.message || err) });
  }
});

// ---------------------------------------------------------------------------
// /api/face — 面相／手相（可選擇上傳照片，走 multipart/form-data）
// ---------------------------------------------------------------------------
app.post('/api/face', rateLimit, upload.single('photo'), async (req, res) => {
  try {
    const { gender, question, description } = req.body;
    const who = gender === 'male' ? '男性' : gender === 'female' ? '女性' : '這位朋友';

    const introText = `請幫這位「${who}」進行面相／手相風格的趣味解讀。
使用時請務必遵守：不做醫療診斷、不做智力或道德的武斷評價、不涉及種族或民族刻板印象，僅作為個性特質與運勢的趣味詮釋。

使用者想問的問題：「${question || '未特別設定問題，請綜合解讀給人的第一印象、個性特質與整體運勢建議'}」`;

    let content;
    if (req.file) {
      const base64 = req.file.buffer.toString('base64');
      content = [
        { type: 'image', source: { type: 'base64', media_type: req.file.mimetype, data: base64 } },
        { type: 'text', text: `${introText}\n\n請直接根據這張照片中的五官、臉型、氣色（若有手部也可一併觀察手相紋路）進行解讀。` },
      ];
    } else {
      content = `${introText}\n\n使用者自行描述的五官／手相特徵如下：\n${description || '（使用者沒有特別描述，請以一般性、鼓勵性的方式回覆，並邀請對方之後補充更多細節）'}`;
    }

    const messages = [{ role: 'user', content }];
    const result = await askGemini({ system: PERSONA, messages });

    // 若是圖片訊息，之後接續聊天時改用純文字摘要，避免每次都重送整張圖片
    const seedUserText = req.file
      ? `[已於本回合分析過一張面相／手相照片，重點如下——請延續此上下文回答後續問題]\n${introText}`
      : introText;
    const seed = [
      { role: 'user', content: seedUserText },
      { role: 'assistant', content: result.text },
    ];

    res.json({ reading: result.text, chart: { hasPhoto: !!req.file }, seed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '占卜過程發生了一點意外，請稍後再試一次。', detail: String(err.message || err) });
  }
});

// ---------------------------------------------------------------------------
// /api/chat — 針對某次解讀的延伸追問（無狀態，前端每次帶完整歷史）
// ---------------------------------------------------------------------------
app.post('/api/chat', rateLimit, async (req, res) => {
  try {
    const { history, message } = req.body;
    if (!Array.isArray(history) || !message) {
      return res.status(400).json({ error: '缺少對話歷史或訊息內容' });
    }
    const messages = [...history, { role: 'user', content: message }];
    const result = await askGemini({ system: PERSONA, messages, maxTokens: 3000 });
    res.json({ reply: result.text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '占卜師暫時斷線了，請稍後再試一次。', detail: String(err.message || err) });
  }
});

app.listen(PORT, () => {
  console.log(`✨ 靈曜殿算命網站已啟動： http://localhost:${PORT}`);
});
