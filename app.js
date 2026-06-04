const LOTTERIES = {
  ssq: {
    name: "双色球",
    short: "双色球",
    supportsCompound: true,
    basePrice: 2,
    areas: [
      { key: "red", label: "红球", min: 1, max: 33, pick: 6, color: "red", ordered: false },
      { key: "blue", label: "蓝球", min: 1, max: 16, pick: 1, color: "blue", ordered: false }
    ]
  },
  dlt: {
    name: "大乐透",
    short: "大乐透",
    supportsCompound: true,
    supportsAddOn: true,
    basePrice: 2,
    addOnPrice: 3,
    areas: [
      { key: "front", label: "前区", min: 1, max: 35, pick: 5, color: "red", ordered: false },
      { key: "back", label: "后区", min: 1, max: 12, pick: 2, color: "blue", ordered: false }
    ]
  },
  sd: {
    name: "3D",
    short: "3D",
    supportsPositionCompound: true,
    basePrice: 2,
    digits: ["百位", "十位", "个位"]
  },
  p3: {
    name: "排列3",
    short: "排列3",
    supportsPositionCompound: true,
    basePrice: 2,
    digits: ["百位", "十位", "个位"]
  },
  p5: {
    name: "排列5",
    short: "排列5",
    basePrice: 2,
    digits: ["万位", "千位", "百位", "十位", "个位"]
  }
};

const DRAW_INFO = {
  ssq: {
    provider: "中国福彩网",
    schedule: "周二、周四、周日 21:15",
    note: "开奖日优先以官方开奖公告为准。",
    resultUrl: "https://www.cwl.gov.cn/",
    apiUrls: [
      "https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice?name=ssq&issueCount=30"
    ]
  },
  dlt: {
    provider: "中国体彩网",
    schedule: "周一、周三、周六 21:25",
    note: "开奖信息以中国体彩网发布为准。",
    resultUrl: "https://m.lottery.gov.cn/",
    apiUrls: [
      "https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry?gameNo=85&provinceId=0&pageSize=30&isVerify=1&pageNo=1"
    ]
  },
  sd: {
    provider: "中国福彩网",
    schedule: "每天 21:15",
    note: "开奖信息以中国福彩网发布为准。",
    resultUrl: "https://www.cwl.gov.cn/",
    apiUrls: [
      "https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice?name=3d&issueCount=30"
    ]
  },
  p3: {
    provider: "中国体彩网",
    schedule: "每天 21:25",
    note: "开奖信息以中国体彩网发布为准。",
    resultUrl: "https://m.lottery.gov.cn/",
    apiUrls: [
      "https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry?gameNo=35&provinceId=0&pageSize=30&isVerify=1&pageNo=1",
      "https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry?gameNo=350133&provinceId=0&pageSize=30&isVerify=1&pageNo=1"
    ]
  },
  p5: {
    provider: "中国体彩网",
    schedule: "每天 21:25",
    note: "开奖信息以中国体彩网发布为准。",
    resultUrl: "https://m.lottery.gov.cn/",
    apiUrls: [
      "https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry?gameNo=350133&provinceId=0&pageSize=30&isVerify=1&pageNo=1",
      "https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry?gameNo=35&provinceId=0&pageSize=30&isVerify=1&pageNo=1"
    ]
  }
};

const DRAW_STORAGE_KEY = "lottery-draw-history-v1";
const DRAW_META_STORAGE_KEY = "lottery-draw-meta-v1";
const DRAW_DATA_FILES = {
  ssq: "data/ssq.json",
  dlt: "data/dlt.json",
  sd: "data/sd.json",
  p3: "data/p3.json",
  p5: "data/p5.json"
};

const app = document.querySelector("#app");
const state = {
  lottery: "ssq",
  mode: "random",
  play: "single",
  count: 1,
  multiple: 1,
  addOn: false,
  selections: {},
  positionSelections: {},
  randomSizes: {},
  inputDrafts: {},
  drawHistory: loadDrawHistory(),
  drawMeta: loadDrawMeta(),
  drawLoading: false,
  drawError: "",
  showDrawHistory: false,
  results: [],
  toast: ""
};

function loadDrawHistory() {
  try {
    return JSON.parse(localStorage.getItem(DRAW_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveDrawHistory() {
  localStorage.setItem(DRAW_STORAGE_KEY, JSON.stringify(state.drawHistory));
}

function loadDrawMeta() {
  try {
    return JSON.parse(localStorage.getItem(DRAW_META_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveDrawMeta() {
  localStorage.setItem(DRAW_META_STORAGE_KEY, JSON.stringify(state.drawMeta));
}

function applyDrawData(lotteryKey, data) {
  const draws = data.draws || data;
  if (!Array.isArray(draws) || !draws.length) return false;
  state.drawHistory[lotteryKey] = draws.slice(0, 30);
  state.drawMeta[lotteryKey] = {
    updatedAt: data.updatedAt || new Date().toISOString(),
    checkedAt: data.checkedAt || "",
    lastError: data.lastError || ""
  };
  saveDrawHistory();
  saveDrawMeta();
  return true;
}

function initSelections() {
  Object.values(LOTTERIES).forEach((lottery) => {
    if (lottery.areas) {
      state.selections[lottery.short] = Object.fromEntries(lottery.areas.map((area) => [area.key, []]));
      lottery.areas.forEach((area) => {
        const defaultSize =
          lottery.short === "双色球" && area.key === "red"
            ? 7
            : lottery.short === "大乐透" && area.key === "front"
              ? 6
              : area.pick;
        state.randomSizes[`${lottery.short}-${area.key}`] = defaultSize;
      });
    }
    if (lottery.digits) {
      state.positionSelections[lottery.short] = Object.fromEntries(lottery.digits.map((digit) => [digit, []]));
      lottery.digits.forEach((digit) => {
        state.randomSizes[`${lottery.short}-${digit}`] = 1;
      });
    }
  });
  state.randomSizes["3D-百位"] = 2;
  state.randomSizes["3D-十位"] = 2;
  state.randomSizes["3D-个位"] = 2;
  state.randomSizes["排列3-百位"] = 2;
  state.randomSizes["排列3-十位"] = 2;
  state.randomSizes["排列3-个位"] = 2;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function range(min, max) {
  return Array.from({ length: max - min + 1 }, (_, index) => min + index);
}

function sample(min, max, size, sorted = true) {
  const values = range(min, max);
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  const picked = values.slice(0, size);
  return sorted ? picked.sort((a, b) => a - b) : picked;
}

function combination(n, k) {
  if (n < k) return 0;
  let result = 1;
  for (let i = 1; i <= k; i += 1) {
    result = (result * (n - k + i)) / i;
  }
  return Math.round(result);
}

function currentLottery() {
  return LOTTERIES[state.lottery];
}

function availablePlays(lottery) {
  const plays = [{ key: "single", label: "单式" }];
  if (lottery.supportsCompound) plays.push({ key: "compound", label: "复式" });
  if (lottery.supportsPositionCompound) plays.push({ key: "position", label: "定位复式" });
  return plays;
}

function setLottery(key) {
  state.lottery = key;
  state.count = 1;
  state.multiple = 1;
  state.showDrawHistory = false;
  const plays = availablePlays(currentLottery()).map((item) => item.key);
  state.play = plays.includes(state.play) ? state.play : "single";
  state.results = [];
  render();
  loadDrawForLottery(key);
}

function setPlay(key) {
  state.play = key;
  state.count = Math.min(state.count, countLimit());
  state.results = [];
  render();
}

function setMode(key) {
  state.mode = key;
  state.results = [];
  render();
}

function clampInput(value, min, max) {
  const numeric = Number(value || min);
  return Math.max(min, Math.min(max, Math.floor(numeric)));
}

function normalizeNumberInput(action, value) {
  const lottery = currentLottery();
  if (action === "count") return clampInput(value, 1, countLimit());
  if (action === "multiple") return clampInput(value, 1, 999);
  if (action.startsWith("size:")) {
    const area = lottery.areas.find((item) => item.key === action.slice(5));
    return clampInput(value, area.pick, area.max);
  }
  if (action.startsWith("digitSize:")) return clampInput(value, 1, 3);
  return clampInput(value, 1, 999);
}

function setNumericState(action, value) {
  const lottery = currentLottery();
  if (action === "count") state.count = value;
  if (action === "multiple") state.multiple = value;
  if (action.startsWith("size:")) {
    const area = lottery.areas.find((item) => item.key === action.slice(5));
    state.randomSizes[`${lottery.short}-${area.key}`] = value;
  }
  if (action.startsWith("digitSize:")) {
    const digit = action.slice(10);
    state.randomSizes[`${lottery.short}-${digit}`] = value;
  }
}

function getNumericState(action) {
  const lottery = currentLottery();
  if (action === "count") return state.count;
  if (action === "multiple") return state.multiple;
  if (action.startsWith("size:")) {
    const areaKey = action.slice(5);
    return state.randomSizes[`${lottery.short}-${areaKey}`];
  }
  if (action.startsWith("digitSize:")) {
    const digit = action.slice(10);
    return state.randomSizes[`${lottery.short}-${digit}`];
  }
  return 1;
}

function stepNumberInput(action, delta) {
  commitInput(action);
  const current = getNumericState(action);
  const next = normalizeNumberInput(action, current + delta);
  setNumericState(action, next);
  state.results = [];
  render();
}

function commitInput(action) {
  if (!action || !(action in state.inputDrafts)) return;
  const value = normalizeNumberInput(action, state.inputDrafts[action]);
  setNumericState(action, value);
  delete state.inputDrafts[action];
}

function commitAllInputs() {
  Object.keys(state.inputDrafts).forEach(commitInput);
}

function countLimit() {
  return state.play === "compound" ? 25 : 50;
}

function toggleArea(areaKey, number) {
  const lottery = currentLottery();
  const bucket = state.selections[lottery.short][areaKey];
  const exists = bucket.includes(number);
  const area = lottery.areas.find((item) => item.key === areaKey);
  const maxPick = state.play === "single" ? area.pick : area.max;
  if (exists) {
    state.selections[lottery.short][areaKey] = bucket.filter((item) => item !== number);
  } else if (bucket.length < maxPick) {
    state.selections[lottery.short][areaKey] = [...bucket, number].sort((a, b) => a - b);
  }
  render();
}

function toggleDigit(digit, number) {
  const lottery = currentLottery();
  const bucket = state.positionSelections[lottery.short][digit];
  const exists = bucket.includes(number);
  const maxPick = state.play === "position" ? 3 : 1;
  if (exists) {
    state.positionSelections[lottery.short][digit] = bucket.filter((item) => item !== number);
  } else if (bucket.length < maxPick) {
    state.positionSelections[lottery.short][digit] = [...bucket, number].sort((a, b) => a - b);
  }
  render();
}

function getUnitPrice(lottery) {
  return lottery.supportsAddOn && state.addOn ? lottery.addOnPrice : lottery.basePrice;
}

function calcBetCount(result) {
  const lottery = currentLottery();
  if (!result) return 0;
  if (result.type === "single") return result.tickets.length;
  if (result.type === "compound") {
    const groups = result.groups || [result.areas];
    return groups.reduce(
      (sum, group) =>
        sum + lottery.areas.reduce((total, area) => total * combination(group[area.key].length, area.pick), 1),
      0
    );
  }
  if (result.type === "position") {
    return lottery.digits.reduce((total, digit) => total * result.positions[digit].length, 1);
  }
  return 0;
}

function calcCost(result) {
  return calcBetCount(result) * getUnitPrice(currentLottery()) * state.multiple;
}

function makeSingleTicket() {
  const lottery = currentLottery();
  if (lottery.areas) {
    return {
      kind: "areas",
      areas: Object.fromEntries(
        lottery.areas.map((area) => [area.key, sample(area.min, area.max, area.pick, !area.ordered)])
      )
    };
  }
  return {
    kind: "digits",
    digits: Object.fromEntries(lottery.digits.map((digit) => [digit, sample(0, 9, 1, false)[0]]))
  };
}

function makeCompoundAreas(lottery) {
  return Object.fromEntries(
    lottery.areas.map((area) => {
      const requested = clampInput(state.randomSizes[`${lottery.short}-${area.key}`], area.pick, area.max);
      return [area.key, sample(area.min, area.max, requested, true)];
    })
  );
}

function generateRandom() {
  commitAllInputs();
  const lottery = currentLottery();
  if (state.play === "single") {
    state.results = [
      {
        type: "single",
        tickets: Array.from({ length: state.count }, () => makeSingleTicket())
      }
    ];
  } else if (state.play === "compound") {
    state.count = clampInput(state.count, 1, 25);
    state.results = [
      {
        type: "compound",
        groups: Array.from({ length: state.count }, () => makeCompoundAreas(lottery))
      }
    ];
  } else {
    const positions = Object.fromEntries(
      lottery.digits.map((digit) => {
        const requested = clampInput(state.randomSizes[`${lottery.short}-${digit}`], 1, 3);
        return [digit, sample(0, 9, requested, true)];
      })
    );
    state.results = [{ type: "position", positions }];
  }
  render();
}

function addManual() {
  const lottery = currentLottery();
  if (state.play === "single") {
    if (lottery.areas) {
      const ready = lottery.areas.every((area) => state.selections[lottery.short][area.key].length === area.pick);
      if (!ready) return showToast("请按规则选满一注号码");
      const ticket = {
        kind: "areas",
        areas: Object.fromEntries(lottery.areas.map((area) => [area.key, [...state.selections[lottery.short][area.key]]]))
      };
      appendSingle(ticket);
    } else {
      const ready = lottery.digits.every((digit) => state.positionSelections[lottery.short][digit].length === 1);
      if (!ready) return showToast("请每一位选择 1 个号码");
      const ticket = {
        kind: "digits",
        digits: Object.fromEntries(lottery.digits.map((digit) => [digit, state.positionSelections[lottery.short][digit][0]]))
      };
      appendSingle(ticket);
    }
  } else if (state.play === "compound") {
    const ready = lottery.areas.every((area) => state.selections[lottery.short][area.key].length >= area.pick);
    if (!ready) return showToast("复式号码还未达到最低选择数量");
    state.results = [
      {
        type: "compound",
        groups: [
          Object.fromEntries(lottery.areas.map((area) => [area.key, [...state.selections[lottery.short][area.key]]]))
        ]
      }
    ];
  } else {
    const ready = lottery.digits.every((digit) => state.positionSelections[lottery.short][digit].length >= 1);
    if (!ready) return showToast("定位复式每一位至少选择 1 个号码");
    state.results = [
      {
        type: "position",
        positions: Object.fromEntries(lottery.digits.map((digit) => [digit, [...state.positionSelections[lottery.short][digit]]]))
      }
    ];
  }
  render();
}

function appendSingle(ticket) {
  const current = state.results[0]?.type === "single" ? state.results[0].tickets : [];
  if (current.length >= 50) return showToast("自选最多保留 50 注");
  state.results = [{ type: "single", tickets: [...current, ticket] }];
}

function clearCurrentSelection() {
  const lottery = currentLottery();
  if (lottery.areas) {
    lottery.areas.forEach((area) => {
      state.selections[lottery.short][area.key] = [];
    });
  }
  if (lottery.digits) {
    lottery.digits.forEach((digit) => {
      state.positionSelections[lottery.short][digit] = [];
    });
  }
  state.results = [];
  render();
}

function showToast(message) {
  state.toast = message;
  render();
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    state.toast = "";
    render();
  }, 1800);
}

function formatTicket(ticket) {
  const lottery = currentLottery();
  if (ticket.kind === "areas") {
    return lottery.areas.map((area) => ticket.areas[area.key].map(pad).join(" ")).join(" - ");
  }
  return lottery.digits.map((digit) => ticket.digits[digit]).join(",");
}

function formatAreaGroup(group) {
  return currentLottery().areas.map((area) => group[area.key].map(pad).join(" ")).join(" - ");
}

function formatResultHeader(result) {
  const lottery = currentLottery();
  const parts = [lottery.name];
  if (result.type === "compound") {
    const group = (result.groups || [result.areas])[0];
    parts.push(lottery.areas.map((area) => group[area.key].length).join("+"));
  }
  if (lottery.supportsAddOn && state.addOn) parts.push("追加");
  parts.push(`${state.multiple}倍`);
  return parts.join(" ");
}

function formatDrawNumbers(draw) {
  if (!draw) return "暂无开奖数据";
  const trimDigit = (value) => String(Number(value));
  if (["sd", "p3", "p5"].includes(state.lottery)) return draw.front.map(trimDigit).join(",");
  if (draw.back?.length) return `${draw.front.join(" ")} - ${draw.back.join(" ")}`;
  return draw.front.join(",");
}

function formatDateTime(value) {
  if (!value) return "暂无更新时间";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "暂无更新时间";
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function isDrawDataStale(meta) {
  if (!meta?.updatedAt) return false;
  const updatedAt = new Date(meta.updatedAt).getTime();
  if (Number.isNaN(updatedAt)) return false;
  return Date.now() - updatedAt > 36 * 60 * 60 * 1000;
}

function normalizeNumberList(value) {
  if (Array.isArray(value)) return value.map(String);
  return String(value || "")
    .replace(/[+,，|]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function normalizeIssueDate(row) {
  return row.lotteryDrawNum || row.issue || row.code || row.expect || "";
}

function normalizeDrawDate(row) {
  return row.lotteryDrawTime || row.date || row.kjDate || row.time || "";
}

function normalizeCwlDraws(data, lotteryKey) {
  const rows = data.result || data.data || [];
  return rows
    .slice(0, 30)
    .map((row) => {
      const red = normalizeNumberList(row.red || row.frontWinningNum || row.winNumber || row.number);
      const blue = normalizeNumberList(row.blue || row.backWinningNum);
      return {
        issue: normalizeIssueDate(row),
        date: normalizeDrawDate(row),
        front: lotteryKey === "sd" ? red.slice(0, 3) : red,
        back: blue
      };
    })
    .filter((item) => item.issue && item.front.length);
}

function normalizeSportDraws(data, lotteryKey) {
  const rows = data.value?.list || data.result || data.data || [];
  return rows
    .slice(0, 30)
    .map((row) => {
      const nums = normalizeNumberList(row.lotteryDrawResult || row.result || row.number);
      let front = nums;
      let back = [];
      if (lotteryKey === "dlt") {
        front = nums.slice(0, 5);
        back = nums.slice(5, 7);
      }
      if (lotteryKey === "p3") front = nums.slice(0, 3);
      if (lotteryKey === "p5") front = nums.slice(0, 5);
      return {
        issue: normalizeIssueDate(row),
        date: normalizeDrawDate(row),
        front,
        back
      };
    })
    .filter((item) => item.issue && item.front.length);
}

function normalizeDraws(data, lotteryKey) {
  if (lotteryKey === "ssq" || lotteryKey === "sd") return normalizeCwlDraws(data, lotteryKey);
  return normalizeSportDraws(data, lotteryKey);
}

async function refreshDrawResults() {
  const lotteryKey = state.lottery;
  state.drawLoading = true;
  state.drawError = "";
  render();
  try {
    const response = await fetch(`${DRAW_DATA_FILES[lotteryKey]}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("not-found");
    const data = await response.json();
    if (!applyDrawData(lotteryKey, data)) throw new Error("empty");
    showToast("开奖数据已更新");
  } catch {
    state.drawError = "暂时没有可用开奖数据，请稍后重试或打开官方查询。";
  } finally {
    state.drawLoading = false;
    render();
  }
}

async function loadDrawForLottery(lotteryKey) {
  if (state.drawHistory[lotteryKey]?.length) return;
  try {
    const response = await fetch(`${DRAW_DATA_FILES[lotteryKey]}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    if (applyDrawData(lotteryKey, data)) render();
  } catch {
    // Static draw data is optional; keep the picker usable when it is unavailable.
  }
}

function formatResult(result) {
  const lottery = currentLottery();
  if (!result) return "";

  if (result.type === "single") {
    return [formatResultHeader(result), ...result.tickets.map((ticket) => formatTicket(ticket))].join("\n");
  }
  if (result.type === "compound") {
    const groups = result.groups || [result.areas];
    return [formatResultHeader(result), ...groups.map((group) => formatAreaGroup(group))].join("\n");
  }
  return [formatResultHeader(result), ...lottery.digits.map((digit) => `${digit}：${result.positions[digit].join(" ")}`)].join("\n");
}

async function copyResult() {
  if (!state.results[0]) return showToast("请先生成或添加号码");
  const text = formatResult(state.results[0]);
  try {
    await navigator.clipboard.writeText(text);
    showToast("已复制选号信息");
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
    showToast("已复制选号信息");
  }
}

function playLabel() {
  if (state.play === "compound") return "复式";
  if (state.play === "position") return "定位复式";
  return "单式";
}

function renderTabs() {
  return `
    <div class="lottery-tabs" role="tablist">
      ${Object.entries(LOTTERIES)
        .map(([key, lottery]) => `
          <button class="tab ${state.lottery === key ? "active" : ""}" data-action="lottery" data-key="${key}" type="button">
            ${lottery.short}
          </button>
        `)
        .join("")}
    </div>
  `;
}

function renderSegment(name, items, selected) {
  return `
    <div class="segment">
      ${items
        .map((item) => `
          <button class="${selected === item.key ? "active" : ""}" data-action="${name}" data-key="${item.key}" type="button">
            ${item.label}
          </button>
        `)
        .join("")}
    </div>
  `;
}

function renderNumberInput(label, value, min, max, action, suffix = "") {
  const displayValue = action in state.inputDrafts ? state.inputDrafts[action] : value;
  return `
    <div class="field step-field">
      <button class="step-btn" data-action="stepInput" data-target="${action}" data-delta="-1" type="button" aria-label="${label}减少">-</button>
      <label>
        <span>${label}</span>
        <input data-action="${action}" min="${min}" max="${max}" inputmode="numeric" pattern="[0-9]*" type="text" value="${displayValue}" />
        <em>${suffix}</em>
      </label>
      <button class="step-btn" data-action="stepInput" data-target="${action}" data-delta="1" type="button" aria-label="${label}增加">+</button>
    </div>
  `;
}

function renderDrawPanel() {
  const info = DRAW_INFO[state.lottery];
  const lottery = currentLottery();
  const history = state.drawHistory[state.lottery] || [];
  const meta = state.drawMeta[state.lottery] || {};
  const latest = history[0];
  const stale = isDrawDataStale(meta);
  return `
    <section class="panel draw-panel">
      <div class="panel-title">开奖结果</div>
      <div class="draw-card">
        <div>
          <strong>${lottery.name}</strong>
          <span>${info.provider}</span>
        </div>
        <b>${info.schedule}</b>
      </div>
      <div class="latest-draw">
        <span>${latest ? `第${latest.issue}期 ${latest.date || ""}` : "暂无当期开奖"}</span>
        <strong>${formatDrawNumbers(latest)}</strong>
      </div>
      <p class="hint">${info.note} 本地最多保存近 30 期。</p>
      <p class="draw-update-time">最后更新时间：${formatDateTime(meta.updatedAt)}</p>
      ${stale ? `<p class="draw-warning">开奖数据超过 36 小时未更新，可能不是最新。</p>` : ""}
      ${state.drawError ? `<p class="draw-error">${state.drawError}</p>` : ""}
      <div class="draw-actions">
        <button data-action="refreshDraw" type="button">${state.drawLoading ? "更新中..." : "更新开奖"}</button>
        <button data-action="toggleDrawHistory" type="button">${state.showDrawHistory ? "收起历史" : "历史开奖"}</button>
      </div>
      ${
        state.showDrawHistory
          ? `<div class="draw-history">
              ${
                history.length
                  ? history
                      .slice(0, 30)
                      .map((draw) => `
                        <div class="draw-history-row">
                          <span>第${draw.issue}期</span>
                          <strong>${formatDrawNumbers(draw)}</strong>
                        </div>
                      `)
                      .join("")
                  : `<p>暂无历史开奖数据</p>`
              }
            </div>`
          : ""
      }
    </section>
  `;
}

function renderSettings() {
  const lottery = currentLottery();
  return `
    <section class="panel settings">
      <div class="panel-title">选号设置</div>
      ${renderSegment("mode", [
        { key: "random", label: "随机选号" },
        { key: "manual", label: "自选号码" }
      ], state.mode)}
      ${renderSegment("play", availablePlays(lottery), state.play)}
      <div class="fields">
        ${
          (state.play === "single" || state.play === "compound") && state.mode === "random"
            ? renderNumberInput("注数", Math.min(state.count, countLimit()), 1, countLimit(), "count", "注")
            : ""
        }
        ${renderNumberInput("倍投", state.multiple, 1, 999, "multiple", "倍")}
      </div>
      ${
        lottery.supportsAddOn
          ? `<button class="switch" data-action="toggleAddon" type="button" aria-pressed="${state.addOn}">
              <span></span><b>大乐透追加</b><small>${state.addOn ? "3元/注" : "2元/注"}</small>
            </button>`
          : ""
      }
    </section>
  `;
}

function renderRandomPanel() {
  const lottery = currentLottery();
  if (state.play === "single") {
    return `
      <section class="panel">
        <div class="panel-title">随机生成</div>
        <p class="hint">按当前彩种规则生成 ${state.count} 注单式号码。</p>
        <button class="primary" data-action="generate" type="button">生成号码</button>
      </section>
    `;
  }
  if (state.play === "compound") {
    return `
      <section class="panel">
        <div class="panel-title">随机复式</div>
        <p class="hint">按当前复式设置生成 ${Math.min(state.count, 25)} 注，每注单独计算组合数。</p>
        <div class="fields">
          ${lottery.areas
            .map((area) => renderNumberInput(`${area.label}个数`, state.randomSizes[`${lottery.short}-${area.key}`], area.pick, area.max, `size:${area.key}`, "个"))
            .join("")}
        </div>
        <button class="primary" data-action="generate" type="button">生成复式</button>
      </section>
    `;
  }
  return `
    <section class="panel">
      <div class="panel-title">随机定位复式</div>
      <div class="fields position-fields">
        ${lottery.digits
          .map((digit) => renderNumberInput(`${digit}个数`, state.randomSizes[`${lottery.short}-${digit}`], 1, 3, `digitSize:${digit}`, "个"))
          .join("")}
      </div>
      <p class="hint">每位最多 3 个号码，最大组合为 3 x 3 x 3。</p>
      <button class="primary" data-action="generate" type="button">生成定位复式</button>
    </section>
  `;
}

function renderAreaPicker() {
  const lottery = currentLottery();
  if (lottery.areas) {
    return lottery.areas
      .map((area) => {
        const selected = state.selections[lottery.short][area.key];
        const target = state.play === "single" ? `选 ${area.pick} 个` : `至少 ${area.pick} 个`;
        return `
          <div class="picker-group">
            <div class="picker-head">
              <strong>${area.label}</strong>
              <span>${selected.length}/${target}</span>
            </div>
            <div class="balls">
              ${range(area.min, area.max)
                .map((number) => `
                  <button class="ball ${area.color} ${selected.includes(number) ? "selected" : ""}" data-action="area" data-area="${area.key}" data-number="${number}" type="button">
                    ${pad(number)}
                  </button>
                `)
                .join("")}
            </div>
          </div>
        `;
      })
      .join("");
  }
  return lottery.digits
    .map((digit) => {
      const selected = state.positionSelections[lottery.short][digit];
      const target = state.play === "position" ? "1-3 个" : "1 个";
      return `
        <div class="picker-group">
          <div class="picker-head">
            <strong>${digit}</strong>
            <span>${selected.length}/${target}</span>
          </div>
          <div class="balls digit-balls">
            ${range(0, 9)
              .map((number) => `
                <button class="ball digit ${selected.includes(number) ? "selected" : ""}" data-action="digit" data-digit="${digit}" data-number="${number}" type="button">
                  ${number}
                </button>
              `)
              .join("")}
          </div>
        </div>
      `;
    })
    .join("");
}

function renderManualPanel() {
  return `
    <section class="panel">
      <div class="panel-title">${state.play === "single" ? "自选号码" : playLabel()}</div>
      ${renderAreaPicker()}
      <div class="action-row">
        <button class="secondary" data-action="clear" type="button">清空</button>
        <button class="primary" data-action="addManual" type="button">${state.play === "single" ? "确认加入" : "生成结果"}</button>
      </div>
    </section>
  `;
}

function renderResult() {
  const result = state.results[0];
  const lottery = currentLottery();
  if (!result) {
    return `
      <section class="result empty">
        <div class="result-top">
          <strong>选号结果</strong>
          <span>待生成</span>
        </div>
        <p>生成或自选号码后，这里会显示注数、倍投和自动结算金额。</p>
      </section>
    `;
  }
  return `
    <section class="result">
      <div class="result-top">
        <strong>${lottery.name} · ${playLabel()}</strong>
        <button data-action="copy" type="button">复制</button>
      </div>
      <div class="summary">
        <div><span>计费注数</span><b>${calcBetCount(result)}注</b></div>
        <div><span>倍投</span><b>${state.multiple}倍</b></div>
        <div><span>单注</span><b>${getUnitPrice(lottery)}元</b></div>
        <div><span>金额</span><b>${calcCost(result)}元</b></div>
      </div>
      <pre>${formatResult(result)}</pre>
    </section>
  `;
}

function render() {
  app.innerHTML = `
    <main class="shell">
      <header class="hero">
        <div>
          <h1>彩票模拟选号器</h1>
          <p>仅作模拟选号与金额计算</p>
        </div>
      </header>
      ${renderTabs()}
      ${renderDrawPanel()}
      ${renderSettings()}
      ${state.mode === "random" ? renderRandomPanel() : renderManualPanel()}
      ${renderResult()}
      <footer class="site-footer">
        <strong>作者：林广波</strong>
        <span>彩票有风险，参与需理性，量力而行。</span>
      </footer>
    </main>
    ${state.toast ? `<div class="toast">${state.toast}</div>` : ""}
  `;
}

app.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  if (action === "lottery") setLottery(target.dataset.key);
  if (action === "mode") setMode(target.dataset.key);
  if (action === "play") setPlay(target.dataset.key);
  if (action === "generate") generateRandom();
  if (action === "addManual") addManual();
  if (action === "clear") clearCurrentSelection();
  if (action === "copy") copyResult();
  if (action === "area") toggleArea(target.dataset.area, Number(target.dataset.number));
  if (action === "digit") toggleDigit(target.dataset.digit, Number(target.dataset.number));
  if (action === "stepInput") stepNumberInput(target.dataset.target, Number(target.dataset.delta));
  if (action === "refreshDraw") refreshDrawResults();
  if (action === "toggleDrawHistory") {
    state.showDrawHistory = !state.showDrawHistory;
    render();
  }
  if (action === "toggleAddon") {
    state.addOn = !state.addOn;
    render();
  }
});

app.addEventListener("input", (event) => {
  const target = event.target;
  const action = target.dataset.action;
  if (!action) return;
  state.inputDrafts[action] = target.value.replace(/\D/g, "");
  target.value = state.inputDrafts[action];
});

app.addEventListener("blur", (event) => {
  const target = event.target;
  const action = target.dataset.action;
  if (!action) return;
  commitInput(action);
  render();
}, true);

app.addEventListener("keydown", (event) => {
  const target = event.target;
  const action = target.dataset.action;
  if (!action || event.key !== "Enter") return;
  commitInput(action);
  target.blur();
});

initSelections();
render();
loadDrawForLottery(state.lottery);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
