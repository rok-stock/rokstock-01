import financialsJson from "@/data/financials.json";
import { SEED_CRNO_BY_CODE } from "./seed";

/**
 * 기업 재무·개요 로더 — 시드(`src/data/financials.json`) 기반.
 *
 * 재무는 연 단위로만 바뀌므로 런타임 API 호출 없이 시드를 빌드에 번들한다
 * (분기·연 결산 후 `npm run seed -- --only=financials` 로 재생성).
 * 종목코드 → 법인등록번호(crno) 조인은 종목 마스터가 제공한다 — 우선주도
 * 보통주의 법인 정보를 그대로 보여준다.
 */

/** 한 사업연도의 요약 재무 (단위: 원) */
export interface FinancialYear {
  bizYear: string;
  sale: number; // 매출액
  bzopPft: number; // 영업이익
  crtmNpf: number; // 당기순이익
  tast: number; // 자산총계
  tdbt: number; // 부채총계
  tcpt: number; // 자본총계
}

export interface CorpOutline {
  ceo: string;
  estbDt: string; // YYYYMMDD
  lstgDt: string;
  empeCnt: number;
  avgSlry: number; // 1인 평균 급여액 (원)
  auditOpnn: string; // 감사 의견
  hmpg: string;
}

/** 최근 1년 현금배당 요약 (보통주 기준) + 액면가 */
export interface DividendInfo {
  /** 최근 1년(370일) 현금배당 합계 — 주당 (원). 분기 배당은 합산됨 */
  annualDvdn: number;
  /** 가장 최근 배당 기준일 (YYYY-MM-DD, 없으면 빈 문자열) */
  lastBasDt: string;
  /** 액면가 (원) */
  parValue: number;
}

export interface CompanyReport {
  outline: CorpOutline | null;
  /** 최근 연도부터 내림차순 */
  years: FinancialYear[];
  dividend: DividendInfo | null;
}

type Row = (string | number)[];

function columnIndex(fields: string[]): Record<string, number> {
  return Object.fromEntries(fields.map((field, i) => [field, i]));
}

const sCol = columnIndex(financialsJson.summaryFields);
const oCol = columnIndex(financialsJson.outlineFields);
const dCol = columnIndex(financialsJson.dividendFields);

let summariesByCrno: Map<string, FinancialYear[]> | undefined;
let outlineByCrno: Map<string, CorpOutline> | undefined;
let dividendByCrno: Map<string, DividendInfo> | undefined;

function buildMaps(): void {
  summariesByCrno = new Map();
  for (const row of financialsJson.summaries as Row[]) {
    const crno = String(row[sCol.crno]);
    const list = summariesByCrno.get(crno) ?? [];
    list.push({
      bizYear: String(row[sCol.bizYear]),
      sale: Number(row[sCol.sale]),
      bzopPft: Number(row[sCol.bzopPft]),
      crtmNpf: Number(row[sCol.crtmNpf]),
      tast: Number(row[sCol.tast]),
      tdbt: Number(row[sCol.tdbt]),
      tcpt: Number(row[sCol.tcpt]),
    });
    summariesByCrno.set(crno, list);
  }
  for (const list of summariesByCrno.values()) {
    list.sort((a, b) => b.bizYear.localeCompare(a.bizYear));
  }

  outlineByCrno = new Map(
    (financialsJson.outlines as Row[]).map((row) => [
      String(row[oCol.crno]),
      {
        ceo: String(row[oCol.ceo]),
        estbDt: String(row[oCol.estbDt]),
        lstgDt: String(row[oCol.lstgDt]),
        empeCnt: Number(row[oCol.empeCnt]),
        avgSlry: Number(row[oCol.avgSlry]),
        auditOpnn: String(row[oCol.auditOpnn]),
        hmpg: String(row[oCol.hmpg]),
      },
    ]),
  );

  dividendByCrno = new Map(
    (financialsJson.dividends as Row[]).map((row) => [
      String(row[dCol.crno]),
      {
        annualDvdn: Number(row[dCol.annualDvdn]),
        lastBasDt: String(row[dCol.lastBasDt]),
        parValue: Number(row[dCol.parValue]),
      },
    ]),
  );
}

/** 종목코드의 기업 리포트. 아무 정보도 없으면 null */
export function getCompanyReport(code: string): CompanyReport | null {
  const crno = SEED_CRNO_BY_CODE.get(code);
  if (!crno) return null;
  if (!summariesByCrno || !outlineByCrno || !dividendByCrno) buildMaps();

  const years = summariesByCrno!.get(crno) ?? [];
  const outline = outlineByCrno!.get(crno) ?? null;
  const dividend = dividendByCrno!.get(crno) ?? null;
  if (years.length === 0 && !outline && !dividend) return null;
  return { outline, years, dividend };
}
