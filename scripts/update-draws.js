import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const lotteries = {
  ssq: {
    sinaType: "101",
    source: "cwl",
    cwlName: "ssq",
    aa1Name: "ssq",
    huiniaoType: "ssq",
    split: [6, 1]
  },
  dlt: {
    sinaType: "201",
    source: "sporttery",
    gameNo: "85",
    aa1Name: "dlt",
    huiniaoType: "dlt",
    split: [5, 2]
  },
  sd: {
    sinaType: "102",
    source: "cwl",
    cwlName: "3d",
    aa1Name: "fcsd",
    huiniaoType: "fcsd",
    split: [3, 0]
  },
  p3: {
    sinaType: "202",
    source: "sporttery",
    gameNo: "35",
    aa1Name: "pls",
    huiniaoType: "pls",
    split: [3, 0]
  },
  p5: {
    sinaType: "203",
    source: "sporttery",
    gameNo: "350133",
    aa1Name: "plw",
    huiniaoType: "plw",
    split: [5, 0]
  }
};

function numberList(value) {
  if (Array.isArray(value)) return value.map(String);
  return String(value || "")
    .replace(/[+,，|]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function cleanDraws(draws) {
  const seen = new Set();
  return draws
    .filter((draw) => draw.issue && draw.front?.length)
    .filter((draw) => {
      if (seen.has(draw.issue)) return false;
      seen.add(draw.issue);
      return true;
    })
    .slice(0, 30);
}

async function getJson(url, options) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "user-agent": "Mozilla/5.0 lottery-picker",
      accept: "application/json,text/plain,*/*",
      ...(options?.headers || {})
    }
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

function sinaSign(params) {
  const raw = Object.keys(params)
    .filter((key) => key !== "sign")
    .sort()
    .map((key) => params[key])
    .join("|");
  return crypto.createHash("md5").update(raw).digest("hex");
}

async function getSinaJson(params) {
  const query = {
    format: "json",
    __caller__: "web",
    __version__: "1.0.0",
    __verno__: 1,
    ...params
  };
  query.sign = sinaSign(query);
  const search = new URLSearchParams(query);
  const urls = [
    `https://alpha.lottery.sina.com.cn/gateway/index/entry?${search}`,
    `https://mix.lottery.sina.com.cn/gateway/index/entry?${search}`
  ];
  const errors = [];
  for (const url of urls) {
    try {
      const data = await getJson(url, { headers: { "x-requested-with": "XMLHttpRequest" } });
      const result = data.result || data;
      if (result.status?.code === 0) return result;
      errors.push(`${result.status?.code || "bad-status"} ${result.status?.msg || url}`);
    } catch (error) {
      errors.push(error.message);
    }
  }
  throw new Error(errors.join("; "));
}

function sinaDrawFromRow(row, config) {
  const nums = numberList(row.redResults || row.openResults || row.openResult || row.number);
  const back = numberList(row.blueResults || row.blueResult);
  const [frontSize, backSize] = config.split;
  return {
    issue: row.issueNo || row.issue || "",
    date: String(row.openTime || row.openDate || "").slice(0, 10),
    front: nums.slice(0, frontSize),
    back: backSize ? (back.length ? back : nums.slice(frontSize, frontSize + backSize)) : []
  };
}

async function fetchSina(config) {
  const listResult = await getSinaJson({
    cat1: "gameOpenList",
    lottoType: config.sinaType,
    page: 1,
    pageSize: 30,
    paginationType: 1
  });
  const list = cleanDraws((listResult.data || []).map((row) => sinaDrawFromRow(row, config)));
  if (list.length >= 30) return list;

  const latestResult = await getSinaJson({
    cat1: "gameOpenInfo",
    lottoType: config.sinaType,
    issueNo: ""
  });
  const latest = sinaDrawFromRow(latestResult.data || {}, config);
  return cleanDraws([latest, ...list]);
}

function huiniaoNumbers(row) {
  const named = ["one", "two", "three", "four", "five", "six", "seven", "eight"].map((key) => row[key]);
  const nums = named.filter((value) => value !== undefined && value !== null && value !== "").map(String);
  if (nums.length) return nums.map((value) => value.padStart(2, "0"));
  return numberList(row.open_code || row.number || row.result || row.code_number);
}

async function fetchHuiniao(config) {
  const url = `https://api.huiniao.top/interface/home/lotteryHistory?type=${config.huiniaoType}&page=1&limit=30`;
  const data = await getJson(url);
  const list = data.data?.data?.list || data.data?.list || [];
  return cleanDraws(
    list.map((row) => {
      const nums = huiniaoNumbers(row);
      const [frontSize, backSize] = config.split;
      return {
        issue: row.code || row.issue || "",
        date: row.day || row.open_time || "",
        front: nums.slice(0, frontSize),
        back: backSize ? nums.slice(frontSize, frontSize + backSize) : []
      };
    })
  );
}

async function fetchCwl(config, lotteryKey) {
  const url = `https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice?name=${config.cwlName}&issueCount=30`;
  const data = await getJson(url);
  const rows = data.result || data.data || [];
  return cleanDraws(
    rows.map((row) => {
      const front = numberList(row.red || row.frontWinningNum || row.winNumber || row.number);
      const back = numberList(row.blue || row.backWinningNum);
      return {
        issue: row.lotteryDrawNum || row.issue || row.code || "",
        date: row.lotteryDrawTime || row.date || row.kjDate || "",
        front: lotteryKey === "sd" ? front.slice(0, 3) : front,
        back
      };
    })
  );
}

async function fetchSporttery(config) {
  const url = `https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry?gameNo=${config.gameNo}&provinceId=0&pageSize=30&isVerify=1&pageNo=1`;
  const data = await getJson(url);
  const rows = data.value?.list || data.result || data.data || [];
  return cleanDraws(
    rows.map((row) => {
      const nums = numberList(row.lotteryDrawResult || row.result || row.number);
      const [frontSize, backSize] = config.split;
      return {
        issue: row.lotteryDrawNum || row.issue || row.code || "",
        date: row.lotteryDrawTime || row.date || row.kjDate || "",
        front: nums.slice(0, frontSize),
        back: backSize ? nums.slice(frontSize, frontSize + backSize) : []
      };
    })
  );
}

async function fetchAa1(config, lotteryKey) {
  const body = new URLSearchParams({ search_lottery: config.aa1Name });
  const data = await getJson("https://tools.mgtv100.com/external/v1/pear/lottery", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body
  });
  const rows = data.data || [];
  return cleanDraws(
    rows.map((row) => {
      const front = numberList(row.drawnumber || row.number || row.result);
      const back = numberList(row.trailnumber);
      if (lotteryKey === "p3") return { issue: row.issue, date: row.opentime, front: front.slice(0, 3), back: [] };
      if (lotteryKey === "p5") return { issue: row.issue, date: row.opentime, front: front.slice(0, 5), back: [] };
      return { issue: row.issue, date: row.opentime, front, back };
    })
  );
}

async function fetchDraws(lotteryKey, config) {
  const attempts = [
    ["sina", () => fetchSina(config)],
    ["huiniao", () => fetchHuiniao(config)],
    [
      config.source === "cwl" ? "official-cwl" : "official-sporttery",
      config.source === "cwl" ? () => fetchCwl(config, lotteryKey) : () => fetchSporttery(config)
    ],
    ["aa1", () => fetchAa1(config, lotteryKey)]
  ];
  const errors = [];
  for (const [source, attempt] of attempts) {
    try {
      const draws = await attempt();
      if (draws.length) return { draws, source };
    } catch (error) {
      errors.push(`${source}: ${error.message}`);
    }
  }
  throw new Error(errors.join("; ") || "no draw data");
}

await mkdir(join(root, "data"), { recursive: true });

async function readExistingData(filePath, lotteryKey) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return { lottery: lotteryKey, updatedAt: "", draws: [] };
  }
}

for (const [lotteryKey, config] of Object.entries(lotteries)) {
  const filePath = join(root, "data", `${lotteryKey}.json`);
  try {
    const { draws, source } = await fetchDraws(lotteryKey, config);
    await writeFile(
      filePath,
      `${JSON.stringify(
        {
          lottery: lotteryKey,
          source,
          updatedAt: new Date().toISOString(),
          checkedAt: new Date().toISOString(),
          lastError: "",
          draws
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    console.log(`${lotteryKey}: ${draws.length} draws from ${source}`);
  } catch (error) {
    const existing = await readExistingData(filePath, lotteryKey);
    await writeFile(
      filePath,
      `${JSON.stringify(
        {
          ...existing,
          lottery: lotteryKey,
          checkedAt: new Date().toISOString(),
          lastError: error.message,
          draws: Array.isArray(existing.draws) ? existing.draws.slice(0, 30) : []
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    console.warn(`${lotteryKey}: kept existing data after error: ${error.message}`);
  }
}
