/**
 * 시드 데이터 생성 스크립트.
 *
 * 공공데이터포털에서 KOSPI 종목 마스터·최근 시세·KOSPI 지수를 받아
 * `src/data/*.json` 으로 저장한다. 실행:
 *
 *   npm run seed                      # 전체 생성 (.env.local 의 DATA_GO_KR_SERVICE_KEY 필요)
 *   npm run seed -- --only=snapshot   # 일부만 재생성 (master | snapshot | index)
 *   npm run seed -- --days=5          # 시세 스냅샷 영업일 수 (기본 5)
 *   npm run seed -- --placeholder     # 인증키 없이 개발용 가짜 시드 생성
 *
 * 결과물은 저장소에 커밋한다 — 배포/프리뷰가 API 키·API 장애와 무관하게 뜨게 하는 안전망이다.
 */

import {
  callApi,
  DataGoKrAuthError,
  fetchAllPages,
  normalizeCode,
  recentWeekdaysYmd,
  requireServiceKey,
  toNumber,
  ymdToIso,
} from "./lib/datagokr.ts";
import { stringifyRows, writeSeedFile } from "./lib/seed-io.ts";

const OUT_DIR = "src/data";
const SEED_VERSION = 1;

/** KOSPI 종목 수가 이 범위를 벗어나면 비정상 응답으로 보고 실패시킨다 */
const MIN_KOSPI_ROWS = 800;
const MAX_KOSPI_ROWS = 1200;

// ---- 마스터 ----

interface RawListedItem {
  basDt: string;
  srtnCd: string;
  itmsNm: string;
  mrktCtg: string;
  crno: string;
}

/** 최근 날짜 후보를 돌며 데이터가 있는 첫 영업일을 찾는다 (13시 이전엔 전일이 나온다) */
async function findLatestDate(probe: (ymd: string) => Promise<number>): Promise<string> {
  for (const ymd of recentWeekdaysYmd(10)) {
    if ((await probe(ymd)) > 0) return ymd;
  }
  throw new Error("최근 10영업일 안에 데이터가 있는 날짜를 찾지 못했습니다.");
}

async function buildMaster(
  snapshot: SnapshotResult,
): Promise<{ asOf: string; rows: [string, string, string][] }> {
  console.log("[2/3] KOSPI 종목 마스터 (KRX상장종목정보)");
  try {
    const basDt = await findLatestDate(async (ymd) => {
      const page = await callApi<RawListedItem>("GetKrxListedInfoService/getItemInfo", {
        basDt: ymd,
        numOfRows: "1",
        pageNo: "1",
      });
      return page.totalCount;
    });

    const all = await fetchAllPages<RawListedItem>("GetKrxListedInfoService/getItemInfo", {
      basDt,
    });
    const kospi = all.filter((item) => item.mrktCtg?.toUpperCase() === "KOSPI");
    assertRowCount("종목 마스터", kospi.length);

    const rows = kospi
      .map((item): [string, string, string] => [
        normalizeCode(item.srtnCd),
        item.itmsNm.trim(),
        item.crno?.trim() ?? "",
      ])
      .sort((a, b) => a[0].localeCompare(b[0]));
    console.log(`  기준일 ${ymdToIso(basDt)}, KOSPI ${rows.length}종목 (전체 ${all.length}건)`);
    return { asOf: ymdToIso(basDt), rows };
  } catch (error) {
    if (!(error instanceof DataGoKrAuthError)) throw error;
    // KRX상장종목정보 미승인 시: 시세 응답에도 코드·종목명은 있으므로 그걸로 마스터를 만든다.
    // 법인등록번호(crno)만 비는데, 이는 기업 리포트(G6) 전까지는 쓰지 않는다.
    console.warn(`  ⚠ ${error.message}`);
    console.warn("  ⚠ 시세 스냅샷에서 마스터를 유도합니다 (crno 없음 — 승인 후 재실행 권장).");
    const rows = [...snapshot.nameByCode.entries()]
      .map(([code, name]): [string, string, string] => [code, name, ""])
      .sort((a, b) => a[0].localeCompare(b[0]));
    assertRowCount("종목 마스터(시세 유도)", rows.length);
    return { asOf: snapshot.latestDate, rows };
  }
}

// ---- 시세 스냅샷 ----

interface RawPriceItem {
  basDt: string;
  srtnCd: string;
  itmsNm: string;
  clpr: string;
  vs: string;
  fltRt: string;
  mkp: string;
  hipr: string;
  lopr: string;
  trqu: string;
  mrktTotAmt: string;
}

const SNAPSHOT_FIELDS = ["code", "clpr", "vs", "fltRt", "mkp", "hipr", "lopr", "trqu", "mrktTotAmt"];

interface SnapshotDay {
  date: string;
  rows: (string | number)[][];
}

interface SnapshotResult {
  days: SnapshotDay[];
  /** 최신일 기준 종목코드 → 종목명 (마스터 API 미승인 시 폴백 재료) */
  nameByCode: Map<string, string>;
  latestDate: string;
}

async function buildSnapshot(businessDays: number): Promise<SnapshotResult> {
  console.log(`[1/3] KOSPI 전 종목 시세 스냅샷 (최근 ${businessDays}영업일)`);
  const days: SnapshotDay[] = [];
  const nameByCode = new Map<string, string>();

  for (const ymd of recentWeekdaysYmd(businessDays + 10)) {
    if (days.length >= businessDays) break;
    const items = await fetchAllPages<RawPriceItem>(
      "GetStockSecuritiesInfoService/getStockPriceInfo",
      { basDt: ymd, mrktCls: "KOSPI" },
    );
    if (items.length === 0) continue; // 휴장일 (또는 아직 미공개인 오늘)

    assertRowCount(`시세 ${ymdToIso(ymd)}`, items.length);
    const rows = items
      .map((item) => {
        const code = normalizeCode(item.srtnCd);
        // 날짜를 최신부터 돌므로 먼저 넣은(=최신) 종목명이 남는다
        if (!nameByCode.has(code)) nameByCode.set(code, item.itmsNm.trim());
        return [
          code,
          toNumber(item.clpr),
          toNumber(item.vs),
          toNumber(item.fltRt),
          toNumber(item.mkp),
          toNumber(item.hipr),
          toNumber(item.lopr),
          toNumber(item.trqu),
          toNumber(item.mrktTotAmt),
        ];
      })
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    days.push({ date: ymdToIso(ymd), rows });
    console.log(`  ${ymdToIso(ymd)}: ${rows.length}종목`);
  }

  if (days.length === 0) throw new Error("시세 데이터를 하루도 받지 못했습니다.");
  return { days: days.reverse(), nameByCode, latestDate: days[days.length - 1].date };
}

// ---- KOSPI 지수 ----

interface RawIndexItem {
  basDt: string;
  idxNm: string;
  clpr: string;
  vs: string;
  fltRt: string;
}

async function buildIndex(): Promise<(string | number)[][]> {
  console.log("[3/3] KOSPI 지수 (지수시세정보, 최근 1년)");
  const [begin] = recentWeekdaysYmd(1);
  const beginBasDt = `${Number(begin.slice(0, 4)) - 1}${begin.slice(4)}`;

  let items: RawIndexItem[];
  try {
    items = await fetchAllPages<RawIndexItem>("GetMarketIndexInfoService/getStockMarketIndex", {
      idxNm: "코스피",
      beginBasDt,
    });
  } catch (error) {
    if (!(error instanceof DataGoKrAuthError)) throw error;
    // 지수시세정보 미승인 시: 지수는 벤치마크 비교(G7)에서야 쓰므로 빈 파일로 두고 넘어간다.
    console.warn(`  ⚠ ${error.message}`);
    console.warn("  ⚠ 빈 지수 파일을 만듭니다 — G7 전에 승인 확인 후 재실행하세요.");
    return [];
  }

  const rows = items
    .filter((item) => item.idxNm === "코스피")
    .map((item) => [
      ymdToIso(item.basDt),
      toNumber(item.clpr),
      toNumber(item.vs),
      toNumber(item.fltRt),
    ])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));

  if (rows.length < 200) {
    throw new Error(`KOSPI 지수가 ${rows.length}건뿐입니다 (1년치면 240건 이상이어야 정상).`);
  }
  console.log(`  ${rows[0][0]} ~ ${rows[rows.length - 1][0]}, ${rows.length}건`);
  return rows;
}

// ---- 플레이스홀더 (인증키 없이 개발용) ----

/** 실제 시드가 나오기 전까지 빌드를 깨지 않기 위한 소수 종목 가짜 데이터 */
const PLACEHOLDER_STOCKS: [code: string, name: string, basePrice: number][] = [
  ["005930", "삼성전자", 74000],
  ["000660", "SK하이닉스", 178000],
  ["373220", "LG에너지솔루션", 402000],
  ["207940", "삼성바이오로직스", 782000],
  ["005380", "현대차", 235000],
  ["000270", "기아", 108000],
  ["068270", "셀트리온", 189000],
  ["005490", "POSCO홀딩스", 385000],
  ["035420", "NAVER", 187000],
  ["035720", "카카오", 45000],
  ["105560", "KB금융", 72000],
  ["055550", "신한지주", 48000],
  ["012330", "현대모비스", 232000],
  ["051910", "LG화학", 385000],
  ["006400", "삼성SDI", 372000],
  ["028260", "삼성물산", 142000],
  ["015760", "한국전력", 21000],
  ["032830", "삼성생명", 78000],
  ["003670", "포스코퓨처엠", 285000],
];

function seedFrom(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildPlaceholder(businessDays: number): {
  master: { asOf: string; rows: [string, string, string][] };
  snapshot: SnapshotDay[];
  index: (string | number)[][];
} {
  const dates = recentWeekdaysYmd(businessDays).reverse().map(ymdToIso);

  const master = {
    asOf: dates[dates.length - 1],
    rows: PLACEHOLDER_STOCKS.map(([code, name]): [string, string, string] => [code, name, ""]),
  };

  const snapshot: SnapshotDay[] = dates.map((date) => ({ date, rows: [] }));
  for (const [code, , base] of PLACEHOLDER_STOCKS) {
    const random = createRandom(seedFrom(code));
    let close = base;
    let prev = base;
    for (const day of snapshot) {
      const open = close;
      close = Math.round(open * (1 + (random() - 0.5) * 0.04));
      const high = Math.max(open, close) + Math.round(random() * open * 0.01);
      const low = Math.min(open, close) - Math.round(random() * open * 0.01);
      const volume = Math.round((0.5 + random()) * 1_000_000);
      const change = close - prev;
      day.rows.push([
        code,
        close,
        change,
        Number(((change / prev) * 100).toFixed(2)),
        open,
        high,
        low,
        volume,
        close * 10_000_000,
      ]);
      prev = close;
    }
  }

  const indexDates = recentWeekdaysYmd(260).reverse().map(ymdToIso);
  const random = createRandom(seedFrom("KOSPI"));
  let level = 2600;
  const index = indexDates.map((date) => {
    const prevLevel = level;
    level = Number((level * (1 + (random() - 0.5) * 0.02)).toFixed(2));
    const change = Number((level - prevLevel).toFixed(2));
    return [date, level, change, Number(((change / prevLevel) * 100).toFixed(2))];
  });

  return { master, snapshot, index };
}

// ---- 파일 쓰기 ----

function writeMaster(master: { asOf: string; rows: [string, string, string][] }): void {
  writeSeedFile(
    `${OUT_DIR}/stock-master.json`,
    `{
"version": ${SEED_VERSION},
"asOf": "${master.asOf}",
"market": "KOSPI",
"fields": ["code", "name", "crno"],
"rows": ${stringifyRows(master.rows)}
}`,
  );
}

function writeSnapshot(days: SnapshotDay[]): void {
  const dayBlocks = days
    .map(
      (day) => `{
"date": "${day.date}",
"fields": ${JSON.stringify(SNAPSHOT_FIELDS)},
"rows": ${stringifyRows(day.rows)}
}`,
    )
    .join(",\n");
  writeSeedFile(
    `${OUT_DIR}/market-snapshot.json`,
    `{
"version": ${SEED_VERSION},
"days": [
${dayBlocks}
]
}`,
  );
}

function writeIndex(rows: (string | number)[][]): void {
  writeSeedFile(
    `${OUT_DIR}/index-kospi.json`,
    `{
"version": ${SEED_VERSION},
"name": "코스피",
"fields": ["date", "clpr", "vs", "fltRt"],
"rows": ${stringifyRows(rows)}
}`,
  );
}

// ---- 메인 ----

function assertRowCount(label: string, count: number): void {
  if (count < MIN_KOSPI_ROWS || count > MAX_KOSPI_ROWS) {
    throw new Error(
      `${label}: ${count}건 — 정상 범위(${MIN_KOSPI_ROWS}~${MAX_KOSPI_ROWS})를 벗어났습니다. 비정상 응답을 커밋하지 않도록 중단합니다.`,
    );
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const days = Number(args.find((a) => a.startsWith("--days="))?.slice(7) ?? 5);
  const only = args.find((a) => a.startsWith("--only="))?.slice(7)?.split(",");
  const run = (step: string) => !only || only.includes(step);

  if (args.includes("--placeholder")) {
    console.log("플레이스홀더 시드 생성 (인증키 불필요, 실제 데이터 아님)");
    const placeholder = buildPlaceholder(days);
    writeMaster(placeholder.master);
    writeSnapshot(placeholder.snapshot);
    writeIndex(placeholder.index);
    console.log("완료. 실제 시드는 인증키 설정 후 `npm run seed` 로 다시 생성하세요.");
    return;
  }

  requireServiceKey();
  if (run("snapshot") || run("master")) {
    // 마스터는 KRX상장종목정보 미승인 시 시세 스냅샷에서 유도하므로 스냅샷을 먼저 받는다
    const snapshot = await buildSnapshot(days);
    if (run("snapshot")) writeSnapshot(snapshot.days);
    if (run("master")) writeMaster(await buildMaster(snapshot));
  }
  if (run("index")) writeIndex(await buildIndex());
  console.log("완료. src/data/ 산출물을 확인하고 커밋하세요.");
}

main().catch((error) => {
  console.error("시드 생성 실패:", error instanceof Error ? error.message : error);
  process.exit(1);
});
