# 공공데이터포털 금융위 API 레퍼런스 (실사용 검증본)

이 프로젝트가 사용하는 **공공데이터포털(data.go.kr) 금융위원회 API 6종**의 실전 명세.
공식 문서가 아니라 **2026-08-15에 실제 호출로 검증한 내용**이며, 공식 문서에 없는
함정(경로 편차, 우선주 누락, 에러 구분법 등)을 포함한다. 다른 프로젝트/에이전트가
이 문서만 보고 연동할 수 있는 것을 목표로 한다.

> 이 저장소에서의 사용처: 시드 생성 `scripts/build-seed.ts`, 런타임 `src/lib/market/`.
> 아키텍처 관점 설명은 [market-data.md](./market-data.md) 참조.

---

## 0. 공통 규약 (전 API 동일)

### 베이스 URL 과 경로 함정 ⚠️

```
https://apis.data.go.kr/1160100/service/{서비스명}/{오퍼레이션}   ← 대부분
https://apis.data.go.kr/1160100/{서비스명}/{오퍼레이션}           ← 주식배당정보 V2 만 (service/ 없음!)
```

**같은 기관의 API 인데 경로 규칙이 다르다.** 이 때문에 "배당 API 가 미등록"으로 오인하고
하루를 허비할 수 있다(실화). 새 API 연동 시 두 경로를 모두 시도해 볼 것.

### 인증 (serviceKey)

- 회원가입 → **API 마다 개별 활용신청** 필요 (여기 나온 6종은 전부 **자동승인**, 반영까지 최대 1시간).
- 키는 계정당 하나로 전 API 공용. **Encoding / Decoding 두 형태**로 제공됨.
- ⚠️ **이중 인코딩 함정**: 키에 `%2B` 등이 이미 있으면 `URLSearchParams` 에 넣지 말 것
  (`%252B` 로 재인코딩되어 인증 실패). **쿼리 문자열에 직접 이어붙이는 게 안전**:
  ```ts
  const url = new URL(endpoint);
  url.searchParams.set("resultType", "json"); // 다른 파라미터는 searchParams 로
  const requestUrl = `${url}&serviceKey=${key}`; // 키만 직접 결합
  ```

### 응답 형식

`resultType=json` 을 반드시 붙인다(기본은 XML). 정상 응답 구조:

```jsonc
{
  "response": {
    "header": { "resultCode": "00", "resultMsg": "NORMAL SERVICE." }, // 생략되는 API 도 있음
    "body": {
      "numOfRows": 10, "pageNo": 1, "totalCount": 943,
      "items": { "item": [ { /* 레코드 */ } ] }   // ⚠️ 1건이면 배열이 아닐 수 있음 — 방어 필요
    }
  }
}
```

- **모든 값이 문자열**이다 (`"clpr": "268000"`). 쉼표가 낀 숫자도 있으므로
  `Number(String(v).replace(/,/g, ""))` 류의 변환 유틸을 거칠 것.
- 종목코드 `srtnCd` 는 서비스에 따라 `"A005930"` 처럼 접두사가 붙기도 한다 → **뒤 6자리 정규화**.

### 에러 3형태 구분법 (중요)

| 형태 | HTTP | 본문 | 뜻 |
|---|---|---|---|
| 업무 오류 | 200 | `response.header.resultCode ≠ "00"` | 파라미터 오류 등 |
| **키 미등록** | 403 | `OpenAPI_ServiceResponse.cmmMsgHeader.errMsg = "SERVICE_KEY_IS_NOT_REGISTERED_ERROR"` (코드 30) | 이 API 에 활용신청 안 됨 / 반영 대기 |
| **경로 오류** | 400 | `errMsg = "NO_OPENAPI_SERVICE_ERROR"` (코드 12) | 서비스/오퍼레이션 경로가 틀림 |

⚠️ **미등록(30)과 경로오류(12)를 반드시 구분하라.** "미등록"이 나와도 실제로는
다른 경로에 등록된 버전(V2 등)이 있을 수 있다. 또한 인증 문제 시 `resultType=json` 인데도
**XML 에러 문서**가 오기도 하므로 JSON 파싱 실패도 인증 오류 신호로 다룬다.

### 갱신 주기·트래픽

- **T+1 갱신**: 기준일 데이터는 **다음 영업일 13:00경** 공개 (금요일 데이터 → 월요일 13시).
  "오늘 날짜로 조회 → 비면 직전 평일로 역탐색" 패턴이 필수다.
- 트래픽: **개발계정 10,000건/일**, 운영계정 100,000건/일 (운영 전환도 자동승인).
- `numOfRows` 최대 10,000이지만 **응답 1분 타임아웃**이 있어 1,000 이하 권장.
  대량 순회 시 호출 간 120~300ms 지연을 둘 것.
- 페이지네이션: `totalCount` 를 보고 `pageNo` 증가.

---

## 1. 주식시세정보 — 일별 OHLCV·시가총액

| | |
|---|---|
| 데이터 번호 | [15094808](https://www.data.go.kr/data/15094808/openapi.do) |
| 엔드포인트 | `…/1160100/service/GetStockSecuritiesInfoService/getStockPriceInfo` |
| 라이선스 | 이용허락범위 제한 없음 (상업 가능) |

**요청 파라미터**: `basDt`(YYYYMMDD), `beginBasDt`/`endBasDt`(기간), `likeSrtnCd`(코드 부분일치),
`itmsNm`/`likeItmsNm`(종목명), `mrktCls`(KOSPI|KOSDAQ|KONEX)

**응답 필드**: `basDt`, `srtnCd`, `isinCd`, `itmsNm`, `mrktCtg`, `clpr`(종가), `vs`(전일대비),
`fltRt`(등락률%), `mkp`(시가), `hipr`(고가), `lopr`(저가), `trqu`(거래량), `trPrc`(거래대금),
`lstgStCnt`(상장주식수), `mrktTotAmt`(시가총액)

**핵심 활용 패턴 — 전 종목 스냅샷 1호출**:
```
?basDt=20260813&mrktCls=KOSPI&numOfRows=1000&pageNo=1&resultType=json
```
KOSPI 는 약 943종목이라 **한 번의 호출로 전 시장 하루치**가 온다 (개별 종목 반복 호출 금지 —
이 구조 덕에 일일 API 사용량이 종목 수와 무관해진다). 휴장일이면 빈 응답.

**개별 종목 일봉**: `likeSrtnCd=005930&beginBasDt=…&endBasDt=…` — 주말·공휴일 결측을 감안해
`영업일수 × 1.6 + 10` 일 정도 넉넉히 잡고 최신순 정렬 후 자를 것.

---

## 2. KRX상장종목정보 — 종목 마스터 + 법인등록번호

| | |
|---|---|
| 데이터 번호 | [15094775](https://www.data.go.kr/data/15094775/openapi.do) |
| 엔드포인트 | `…/1160100/service/GetKrxListedInfoService/getItemInfo` |
| 라이선스 | 제한 없음 |

**요청**: `basDt` 기준 전 시장 목록 (전체 약 2,800건 → `mrktCtg==="KOSPI"` 필터)

**응답 필드**: `basDt`, `srtnCd`, `isinCd`, `mrktCtg`, `itmsNm`, **`crno`(법인등록번호)**, `corpNm`

- **`crno` 가 존재 이유다** — 기업재무·기업개요·배당 API 의 조인 키.
- ⚠️ **우선주가 없다.** KOSPI 기준 831건(법인 단위)만 와서 시세 API 의 943종목과 안 맞는다.
  → 우선주(삼성전자우 005935 등)는 시세 응답의 코드·종목명으로 보충하고, crno 는
  **보통주 코드(앞 5자리 + "0")에서 상속**시키는 것이 실전 해법.

---

## 3. 지수시세정보 — KOSPI/KOSDAQ 지수

| | |
|---|---|
| 데이터 번호 | [15094807](https://www.data.go.kr/data/15094807/openapi.do) |
| 엔드포인트 | `…/1160100/service/GetMarketIndexInfoService/getStockMarketIndex` |
| 라이선스 | 제한 없음. **2020-01-01 이후 데이터만** 제공 |

**요청**: `idxNm=코스피`, `beginBasDt`/`endBasDt`. 1년치 ≈ 245행이라 `numOfRows=500` 한 번이면 됨.

**응답 필드**: `basDt`, `idxNm`, `clpr`, `vs`, `fltRt` (시가·고저 등도 있음)

- ⚠️ `idxNm=코스피` 로 조회해도 유사 지수가 섞일 수 있으니 **응답에서 `idxNm === "코스피"` 재필터**.

---

## 4. 기업재무정보 — 요약재무제표 (V2)

| | |
|---|---|
| 데이터 번호 | [15043459](https://www.data.go.kr/data/15043459/openapi.do) |
| 엔드포인트 | `…/1160100/service/GetFinaStatInfoService_V2/getSummFinaStat_V2` |
| 라이선스 | 제한 없음. 재무 데이터는 연 단위 갱신 |

**요청**: `crno`(법인등록번호). **`bizYear` 를 생략하면 2015년부터 전 연도**가 온다
(연도 × 연결/별도 → 삼성전자 기준 22행) — `numOfRows=200` 한 번이면 충분.

**응답 필드**: `bizYear`, `fnclDcd`(**110=연결, 120=별도**)/`fnclDcdNm`, `enpSaleAmt`(매출액),
`enpBzopPft`(영업이익), `iclsPalClcAmt`(법인세차감전이익), `enpCrtmNpf`(당기순이익),
`enpTastAmt`(자산총계), `enpTdbtAmt`(부채총계), `enpTcptAmt`(자본총계), `fnclDebtRto`(부채비율%),
`curCd`. **단위: 원** (삼성전자 2025 매출 `333605938000000` = 333.6조).

- 실전 패턴: 연도별로 **연결(110) 우선, 없으면 별도(120)** 를 골라 최근 3개년만 사용.

---

## 5. 기업기본정보 — 기업개요 (V2)

| | |
|---|---|
| 데이터 번호 | [15043184](https://www.data.go.kr/data/15043184/openapi.do) |
| 엔드포인트 | `…/1160100/service/GetCorpBasicInfoService_V2/getCorpOutline_V2` |
| 라이선스 | 제한 없음 |

**요청**: `crno` (또는 `corpNm`)

**응답 주요 필드** (실측): `corpNm`, `enpPbanCmpyNm`(공시회사명), `enpRprFnm`(대표자 — "전영현, 노태문"처럼 복수),
`enpEstbDt`(설립일 YYYYMMDD), `enpXchgLstgDt`(유가증권 상장일 — ⚠️ `"75/06/11"` 형식 편차!),
`enpEmpeCnt`(종업원수), `empeAvgCnwkTermCtt`(평균 근속연수), `enpPn1AvgSlryAmt`(1인 평균 급여, 원),
`actnAudpnNm`(감사인), `audtRptOpnnCtt`(감사의견), `enpHmpgUrl`, `enpBsadr`(주소), `enpStacMm`(결산월),
**`fssCorpUnqNo`(DART 고유번호 — OpenDART 연동 시 조인 키로 쓸 수 있음)**

- ⚠️ **동일 레코드가 중복으로 오는 경우**가 있다 → 첫 건만 사용.
- `sicNm`(업종)·`enpMainBizNm`(주요사업)은 비어 있는 회사가 많다 (삼성전자도 빈 값).

---

## 6. 주식배당정보 — 배당 이력 + 액면가 (V2) ⚠️ 특이 경로

| | |
|---|---|
| 데이터 번호 | [15043284](https://www.data.go.kr/data/15043284/openapi.do) |
| 엔드포인트 | `…/1160100/GetStocDiviInfoService_V2/getDiviInfo_V2` — **`service/` 가 없다!** |
| 라이선스 | ⚠️ **공공누리 제2유형 — 상업적 이용 금지** (수익화하려면 한국예탁결제원 계약 필요) |

**요청**: `crno` (또는 `stckIssuCmpyNm`). **역대 배당 이력 전체**가 온다
(삼성전자 170건, 1987년부터, 오래된 순) — `numOfRows=1000` 한 번이면 됨.

**응답 주요 필드**: `crno`, `stckIssuCmpyNm`, `scrsItmsKcd`(**"0101"=보통주**)/`scrsItmsKcdNm`,
**`stckParPrc`(액면가!)**, `stckStacMd`(결산월), `dvdnBasDt`(배당기준일), `cashDvdnPayDt`(지급일),
`stckDvdnRcdNm`(현금배당|주식배당), `stckGenrDvdnAmt`(주당 일반배당금, 원),
`stckGenrCashDvdnRt`(액면가 기준 현금배당률%)

실전 패턴:
- **연간 주당배당금** = `scrsItmsKcd==="0101"` && 현금배당 && `dvdnBasDt` 가 최근 370일 이내인
  레코드의 `stckGenrDvdnAmt` **합산** (분기 배당 대응). 배당수익률 = 이 값 ÷ 현재가.
- ⚠️ 1990년대 이전 레코드는 `stckGenrDvdnAmt=0` 이고 배당률(%)만 있음 — 최근 데이터만 쓰면 무관.
- 🎁 **액면가가 이 API 에 들어 있어서 "주식발행정보" API 는 신청할 필요가 없다**
  (상장일은 기업개요에, 발행주식수는 시세의 lstgStCnt/시총에 이미 있음).

---

## 7. 검토했지만 사용하지 않는 것

| API | 사유 |
|---|---|
| 주식발행정보 (15043423) | 불필요 — 위 6번 참조. 참고로 존재하는 경로는 `service/GetStocIssuInfoService_V2/getItemBasiInfo_V2`·`getStocIssuInfo_V2` |
| 증권상품시세정보 (15094806) | ETF/ETN 시세 — ETF 지원할 때 신청 (자동승인) |
| OpenDART (opendart.fss.or.kr) | 공공데이터포털과 별개 시스템(별도 키). 전체 재무제표·공시가 필요할 때. 기업개요의 `fssCorpUnqNo` 로 조인 가능 |
| KRX Data Marketplace OPEN API | 관리자 수동 승인 필요. 2010년 이후 지수 등 백필 범위가 넓음 |

## 8. 빠른 시작 (다른 프로젝트/에이전트용 체크리스트)

1. data.go.kr 가입 → 필요한 API 각각 **활용신청** (자동승인, 반영 최대 1시간, PC 웹에서만)
2. 연결 확인: 키 없이 호출해 **401/에러 문서가 오면 네트워크는 정상**
3. 키 등록 확인: `SERVICE_KEY_IS_NOT_REGISTERED`(30) 이 나오면 → ① 신청 여부 ② **경로(V2/`service/` 유무)** 순으로 의심
4. 파서는 처음부터: 문자열 숫자 변환 · item 단건 비배열 · srtnCd 6자리 정규화 · XML 에러 감지를 넣고 시작
5. 시세는 "전 종목 1일 1호출" 구조로 설계 — T+1 13시 갱신이라 실시간 폴링은 무의미
6. curl 스모크 테스트 예시 (KEY 는 발급 키로 치환):
   ```bash
   curl "https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService/getStockPriceInfo?resultType=json&numOfRows=1&basDt=20260813&mrktCls=KOSPI&serviceKey=KEY"
   ```
