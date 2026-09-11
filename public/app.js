// 星曆 前端邏輯
(() => {
  const views = {};
  document.querySelectorAll('.view').forEach((v) => { views[v.id] = v; });

  function showView(id) {
    Object.values(views).forEach((v) => v.classList.remove('active'));
    views[id].classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.querySelectorAll('.back-btn').forEach((btn) => {
    btn.addEventListener('click', () => showView('view-select'));
  });

  // -------------------------------------------------------------------
  // 出生地下拉選單（共用同一份縣市清單，需與 lib/calendar.js 的
  // TW_LONGITUDES 保持一致）
  // -------------------------------------------------------------------
  const TW_CITIES = [
    '台北市', '新北市', '基隆市', '桃園市', '新竹市', '新竹縣', '苗栗縣', '台中市',
    '彰化縣', '南投縣', '雲林縣', '嘉義市', '嘉義縣', '台南市', '高雄市', '屏東縣',
    '宜蘭縣', '花蓮縣', '台東縣', '澎湖縣', '金門縣', '連江縣',
  ];
  document.querySelectorAll('.city-select').forEach((sel) => {
    TW_CITIES.forEach((city) => {
      const opt = document.createElement('option');
      opt.value = city;
      opt.textContent = city;
      sel.appendChild(opt);
    });
  });

  // -------------------------------------------------------------------
  // 方式選擇
  // -------------------------------------------------------------------
  const BIRTH_TITLES = {
    ziwei: '紫微斗數解讀',
    bazi: '八字命理解讀',
    astro: '星座占星解讀',
  };
  let currentBirthMethod = null;

  document.querySelectorAll('.method-card').forEach((card) => {
    card.addEventListener('click', () => {
      const method = card.dataset.method;
      if (method === 'tarot') {
        resetTarot();
        showView('view-tarot');
      } else if (method === 'name') {
        showView('view-name');
      } else if (method === 'face') {
        showView('view-face');
      } else if (method === 'compat') {
        showView('view-compat');
      } else {
        currentBirthMethod = method;
        document.getElementById('birth-title').textContent = BIRTH_TITLES[method];
        document.getElementById('birth-place-group').classList.toggle('hidden', method === 'astro');
        showView('view-birth');
      }
    });
  });

  // -------------------------------------------------------------------
  // 塔羅
  // -------------------------------------------------------------------
  let drawnCards = [];

  function resetTarot() {
    drawnCards = [];
    document.getElementById('tarot-cards').innerHTML = '';
    document.getElementById('btn-tarot-interpret').classList.add('hidden');
  }

  document.getElementById('btn-draw').addEventListener('click', () => {
    const spreadKey = document.querySelector('input[name="spread"]:checked').value;
    drawnCards = drawCards(spreadKey);
    const container = document.getElementById('tarot-cards');
    container.innerHTML = '';
    drawnCards.forEach((c, i) => {
      const div = document.createElement('div');
      div.className = 'tarot-card' + (c.reversed ? ' reversed' : '');
      div.style.animationDelay = `${i * 0.12}s`;
      div.innerHTML = `
        <div class="position">${c.position}</div>
        <div class="symbol">${c.symbol}</div>
        <div class="card-name">${c.name}</div>
        <div class="orientation">${c.reversed ? '逆位' : '正位'}</div>
      `;
      container.appendChild(div);
    });
    document.getElementById('btn-tarot-interpret').classList.remove('hidden');
  });

  document.getElementById('btn-tarot-interpret').addEventListener('click', async () => {
    const spreadKey = document.querySelector('input[name="spread"]:checked').value;
    const spread = SPREADS[spreadKey] || SPREADS.three;
    const question = document.getElementById('tarot-question').value.trim();

    showResultView('占卜師正在洗牌，感應牌陣中的訊息……');
    try {
      const data = await postJSON('/api/reading', {
        method: 'tarot',
        spread: spread.label,
        question,
        cards: drawnCards,
      });
      renderResult(data, buildTarotChartHtml(drawnCards));
    } catch (e) {
      renderError(e);
    }
  });

  function buildTarotChartHtml(cards) {
    const rows = cards.map((c) => `${c.position}：${c.symbol} ${c.name}（${c.reversed ? '逆位' : '正位'}） — ${c.meaning}`);
    return `<strong>本次抽牌紀錄</strong>\n${rows.join('\n')}`;
  }

  // -------------------------------------------------------------------
  // 紫微 / 八字 / 星座（共用出生資料表單）
  // -------------------------------------------------------------------
  const timeInput = document.getElementById('birth-time');
  const timeUnknown = document.getElementById('birth-time-unknown');
  timeUnknown.addEventListener('change', () => {
    timeInput.disabled = timeUnknown.checked;
    if (timeUnknown.checked) timeInput.value = '';
  });

  document.getElementById('btn-birth-submit').addEventListener('click', async () => {
    const birthDate = document.getElementById('birth-date').value;
    if (!birthDate) { alert('請選擇出生日期'); return; }

    const payload = {
      method: currentBirthMethod,
      name: document.getElementById('birth-name').value.trim(),
      gender: document.querySelector('input[name="birth-gender"]:checked').value,
      birthDate,
      birthTime: timeUnknown.checked ? null : (timeInput.value || null),
      birthPlace: document.getElementById('birth-place').value || null,
      question: document.getElementById('birth-question').value.trim(),
    };

    const loadingTexts = {
      ziwei: '占卜師正在起紫微命盤，安十二宮諸星……',
      bazi: '占卜師正在排四柱八字，論五行生剋……',
      astro: '占卜師正在對照星軌，尋找你的太陽星座……',
    };
    showResultView(loadingTexts[currentBirthMethod] || '占卜師正在推演命盤……');

    try {
      const data = await postJSON('/api/reading', payload);
      renderResult(data, buildBirthChartHtml(currentBirthMethod, data.chart));
    } catch (e) {
      renderError(e);
    }
  });

  function buildBirthChartHtml(method, chart) {
    if (!chart) return '';
    if (method === 'bazi') return buildBaziChartHtml(chart);
    if (method === 'ziwei') return buildZiweiChartHtml(chart);
    if (method === 'astro') {
      return `<strong>太陽星座：${chart.xingzuo}　生肖：${chart.shengxiao}</strong>`;
    }
    return '';
  }

  function correctionNoteHtml(chart) {
    if (!chart.birthPlace) return '';
    const sign = chart.offsetMinutes > 0 ? '+' : '';
    return `<div class="chart-correction-note">已依出生地「${chart.birthPlace}」校正真太陽時：${sign}${chart.offsetMinutes} 分鐘</div>`;
  }

  function buildBaziChartHtml(chart) {
    const cols = [
      { label: '年柱', pillar: chart.pillars.year, wx: chart.wuxing.year, ss: null },
      { label: '月柱', pillar: chart.pillars.month, wx: chart.wuxing.month, ss: chart.shishen.month },
      { label: '日柱', pillar: chart.pillars.day, wx: chart.wuxing.day, ss: null },
      { label: '時柱', pillar: chart.pillars.time, wx: chart.wuxing.time, ss: chart.shishen.time },
    ];
    const cells = cols.map((c) => `
      <div class="bazi-col">
        <div class="bazi-col-label">${c.label}</div>
        <div class="bazi-pillar">${c.pillar || '未知'}</div>
        <div class="bazi-wx">${c.wx || ''}</div>
        ${c.ss ? `<div class="bazi-ss">十神：${c.ss}</div>` : ''}
      </div>`).join('');

    return `
      <div class="rich-chart bazi-chart">${cells}</div>
      <div class="chart-meta">生肖：${chart.shengxiao}　西洋星座：${chart.xingzuo}　農曆：${chart.lunarDate}</div>
      ${chart.timeKnown ? '' : '<div class="chart-correction-note">未提供確切出生時辰，時柱僅供參考</div>'}
      ${correctionNoteHtml(chart)}
    `;
  }

  const ZIWEI_GRID = {
    巳: [1, 1], 午: [1, 2], 未: [1, 3], 申: [1, 4],
    辰: [2, 1], 酉: [2, 4],
    卯: [3, 1], 戌: [3, 4],
    寅: [4, 1], 丑: [4, 2], 子: [4, 3], 亥: [4, 4],
  };

  function buildZiweiChartHtml(chart) {
    const cells = chart.palaces.map((p) => {
      const [row, col] = ZIWEI_GRID[p.branch] || [1, 1];
      const stars = [...p.majorStars, ...p.minorStars];
      const starsHtml = stars.length
        ? stars.map((s) => `<span class="ziwei-star">${s}</span>`).join('')
        : '<span class="ziwei-star empty">（空宮）</span>';
      const tags = [];
      if (p.name === '命宮') tags.push('<span class="ziwei-tag">命</span>');
      if (p.isBodyPalace) tags.push('<span class="ziwei-tag">身</span>');
      return `
        <div class="ziwei-cell" style="grid-row:${row};grid-column:${col};">
          <div class="ziwei-cell-head">
            <span class="ziwei-palace-name">${p.name}</span>
            ${tags.join('')}
          </div>
          <div class="ziwei-ganzhi">${p.stem}${p.branch}</div>
          <div class="ziwei-stars">${starsHtml}</div>
        </div>`;
    }).join('');

    const center = `
      <div class="ziwei-center">
        <div class="ziwei-center-title">命盤總覽</div>
        <div>命主：${chart.soul}</div>
        <div>身主：${chart.body}</div>
        <div>五行局：${chart.fiveElementsClass}</div>
        <div>生肖：${chart.zodiac}</div>
        <div>星座：${chart.sign}</div>
      </div>`;

    return `
      <div class="rich-chart ziwei-chart">${cells}${center}</div>
      ${chart.timeKnown ? '' : '<div class="chart-correction-note">未提供確切出生時辰，本盤以中午 12 點暫代排出，僅供參考</div>'}
      ${correctionNoteHtml(chart)}
    `;
  }

  // -------------------------------------------------------------------
  // 合盤配對
  // -------------------------------------------------------------------
  function wireTimeUnknown(timeId, unknownId) {
    const timeEl = document.getElementById(timeId);
    const unknownEl = document.getElementById(unknownId);
    unknownEl.addEventListener('change', () => {
      timeEl.disabled = unknownEl.checked;
      if (unknownEl.checked) timeEl.value = '';
    });
  }
  wireTimeUnknown('compat-a-time', 'compat-a-time-unknown');
  wireTimeUnknown('compat-b-time', 'compat-b-time-unknown');

  function collectCompatPerson(prefix) {
    const timeUnknown = document.getElementById(`${prefix}-time-unknown`).checked;
    return {
      name: document.getElementById(`${prefix}-name`).value.trim(),
      gender: document.querySelector(`input[name="${prefix}-gender"]:checked`).value,
      birthDate: document.getElementById(`${prefix}-date`).value,
      birthTime: timeUnknown ? null : (document.getElementById(`${prefix}-time`).value || null),
      birthPlace: document.getElementById(`${prefix}-place`).value || null,
    };
  }

  document.getElementById('btn-compat-submit').addEventListener('click', async () => {
    const system = document.querySelector('input[name="compat-system"]:checked').value;
    const relation = document.querySelector('input[name="compat-relation"]:checked').value;
    const personA = collectCompatPerson('compat-a');
    const personB = collectCompatPerson('compat-b');
    if (!personA.birthDate || !personB.birthDate) { alert('請填寫兩人的出生日期'); return; }

    const payload = {
      method: 'compat',
      system,
      relation,
      personA,
      personB,
      question: document.getElementById('compat-question').value.trim(),
    };

    showResultView('占卜師正在比對兩人的命盤，尋找緣分的軌跡……');
    try {
      const data = await postJSON('/api/reading', payload);
      renderResult(data, buildCompatChartHtml(system, data.chart));
    } catch (e) {
      renderError(e);
    }
  });

  function buildCompatChartHtml(system, chart) {
    if (!chart) return '';
    const builder = system === 'ziwei' ? buildZiweiChartHtml : buildBaziChartHtml;
    return `
      <div class="compat-person">
        <div class="compat-person-title">${chart.personALabel}</div>
        ${builder(chart.personA)}
      </div>
      <div class="compat-divider">與</div>
      <div class="compat-person">
        <div class="compat-person-title">${chart.personBLabel}</div>
        ${builder(chart.personB)}
      </div>
    `;
  }

  // -------------------------------------------------------------------
  // 姓名學
  // -------------------------------------------------------------------
  document.getElementById('btn-name-submit').addEventListener('click', async () => {
    const surname = document.getElementById('name-surname').value.trim();
    const givenName = document.getElementById('name-given').value.trim();
    if (!surname && !givenName) { alert('請至少輸入姓氏或名字'); return; }

    const payload = {
      method: 'name',
      surname,
      givenName,
      gender: document.querySelector('input[name="name-gender"]:checked').value,
      birthDate: document.getElementById('name-birthdate').value || null,
      question: document.getElementById('name-question').value.trim(),
    };

    showResultView('占卜師正在細細品味這個名字的字義與音韻……');
    try {
      const data = await postJSON('/api/reading', payload);
      renderResult(data, `<strong>解讀對象：</strong>${surname}${givenName}`);
    } catch (e) {
      renderError(e);
    }
  });

  // -------------------------------------------------------------------
  // 面相手相
  // -------------------------------------------------------------------
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`face-tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  const facePhotoInput = document.getElementById('face-photo');
  facePhotoInput.addEventListener('change', () => {
    const file = facePhotoInput.files[0];
    const preview = document.getElementById('face-preview');
    if (file) {
      preview.src = URL.createObjectURL(file);
      preview.classList.remove('hidden');
    } else {
      preview.classList.add('hidden');
    }
  });

  document.getElementById('btn-face-submit').addEventListener('click', async () => {
    const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
    const gender = document.querySelector('input[name="face-gender"]:checked').value;
    const question = document.getElementById('face-question').value.trim();

    const form = new FormData();
    form.append('gender', gender);
    form.append('question', question);

    if (activeTab === 'photo') {
      const file = facePhotoInput.files[0];
      if (!file) { alert('請上傳一張照片，或切換到「文字描述」分頁'); return; }
      form.append('photo', file);
    } else {
      const description = document.getElementById('face-description').value.trim();
      if (!description) { alert('請描述一下五官或手相特徵，或切換到「上傳照片」分頁'); return; }
      form.append('description', description);
    }

    showResultView('占卜師正在端詳你的面容與紋路……');
    try {
      const res = await fetch('/api/face', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '解讀失敗');
      renderResult(data, '');
    } catch (e) {
      renderError(e);
    }
  });

  // -------------------------------------------------------------------
  // 結果顯示 + Markdown 簡易渲染
  // -------------------------------------------------------------------
  let chatHistory = [];

  function showResultView(loadingMsg) {
    showView('view-result');
    document.getElementById('loading-text').textContent = loadingMsg;
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('chart-panel').classList.add('hidden');
    document.getElementById('reading-output').innerHTML = '';
    document.getElementById('chat-box').classList.add('hidden');
    document.getElementById('chat-log').innerHTML = '';
    chatHistory = [];
  }

  function renderResult(data, chartHtml) {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('reading-output').innerHTML = renderMarkdown(data.reading);

    const chartPanel = document.getElementById('chart-panel');
    if (chartHtml) {
      chartPanel.innerHTML = chartHtml;
      chartPanel.classList.remove('hidden');
    } else {
      chartPanel.classList.add('hidden');
    }

    chatHistory = data.seed || [];
    document.getElementById('chat-box').classList.remove('hidden');
  }

  function renderError(e) {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('reading-output').innerHTML =
      `<p style="color:#ff8a8a">${e.message}</p>`;
  }

  function renderMarkdown(text) {
    if (!text) return '';
    const lines = text.split('\n');
    let html = '';
    let inList = false;
    for (let line of lines) {
      line = line.trim();
      if (!line) { if (inList) { html += '</ul>'; inList = false; } continue; }
      const headerMatch = line.match(/^#{2,3}\s*(.+)/);
      if (headerMatch) {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<h3>${inlineMd(headerMatch[1])}</h3>`;
        continue;
      }
      if (/^[-*]\s+/.test(line)) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += `<li>${inlineMd(line.replace(/^[-*]\s+/, ''))}</li>`;
        continue;
      }
      if (inList) { html += '</ul>'; inList = false; }
      html += `<p>${inlineMd(line)}</p>`;
    }
    if (inList) html += '</ul>';
    return html;
  }

  function inlineMd(s) {
    return s
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  // -------------------------------------------------------------------
  // 追問聊天
  // -------------------------------------------------------------------
  function appendChatBubble(role, text) {
    const log = document.getElementById('chat-log');
    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  async function sendChat() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    appendChatBubble('user', msg);

    const sendBtn = document.getElementById('chat-send');
    sendBtn.disabled = true;
    try {
      const data = await postJSON('/api/chat', { history: chatHistory, message: msg });
      chatHistory.push({ role: 'user', content: msg });
      chatHistory.push({ role: 'assistant', content: data.reply });
      appendChatBubble('assistant', data.reply);
    } catch (e) {
      appendChatBubble('assistant', `（${e.message}）`);
    } finally {
      sendBtn.disabled = false;
    }
  }

  document.getElementById('chat-send').addEventListener('click', sendChat);
  document.getElementById('chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChat();
  });

  // -------------------------------------------------------------------
  // 共用工具
  // -------------------------------------------------------------------
  async function postJSON(url, payload) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '請求失敗');
    return data;
  }
})();
