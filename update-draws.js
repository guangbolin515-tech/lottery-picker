import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const root = process.cwd();
const lotteries = {
  ssq: {
    source: "cwl",
    cwlName: "ssq",
    aa1Name: "ssq"
  },
  dlt: {
    source: "sporttery",
    gameNo: "85",
    aa1Name: "dlt",
    split: [5, 2]
  },
  sd: {
    source: "cwl",
    cwlName: "3d",
    aa1Name: "fcsd",
    split: [3, 0]
  },
  p3: {
    source: "sporttery",
    gameNo: "35",
    aa1Name: "pls",
    split: [3, 0]
  },
  p5: {
    source: "sporttery",
    gameNo: "350133",
    aa1Name: "plw",
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

async function fetchSporttery(config, lotteryKey) {
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
    config.source === "cwl" ? () => fetchCwl(config, lotteryKey) : () => fetchSporttery(config, lotteryKey),
    () => fetchAa1(config, lotteryKey)
  ];
  const errors = [];
  for (const attempt of attempts) {
    try {
      const draws = await attempt();
      if (draws.length) return draws;
    } catch (error) {
      errors.push(error.message);
    }
  }
  throw new Error(errors.join("; ") || "no draw data");
}

await mkdir(join(root, "data"), { recursive: true });

let failed = false;
for (const [lotteryKey, config] of Object.entries(lotteries)) {
  try {
    const draws = await fetchDraws(lotteryKey, config);
    const filePath = join(root, "data", `${lotteryKey}.json`);
    await writeFile(
      filePath,
      `${JSON.stringify({ lottery: lotteryKey, updatedAt: new Date().toISOString(), draws }, null, 2)}\n`,
      "utf8"
    );
    console.log(`${lotteryKey}: ${draws.length} draws`);
  } catch (error) {
    failed = true;
    console.error(`${lotteryKey}: ${error.message}`);
  }
}

if (failed) process.exitCode = 1;
