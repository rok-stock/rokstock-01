# notes — 학습·연구 탐색 노트북

`docs/learning/`이 개념을 설명하는 **정적 문서**라면, 여기는 **직접 실행하며 확인하는
동적 노트북**이다. 목적은 세 가지가 겹친다.

1. **Python 개발자가 TypeScript/Deno 에 익숙해지기** — 코드 셀마다 Python 과 대조되는
   지점을 짚는다.
2. **주알못이 주식 개념을 데이터로 체감하기** — [`docs/learning/`](../docs/learning/README.md)의
   `stock-*.md` 문서에 정리된 개념을 실제 숫자로 확인한다.
3. **주식 데이터를 시각화하고, 변수 간 관계·흐름을 파악하기** — 이 프로젝트가 이미 갖춘
   실데이터(`src/data/*.json`, 커밋된 시드)를 재사용한다.

## 실행 방법

```bash
jupyter-lab   # uv tool로 이미 설치돼 있음 (uv tool install jupyterlab)
```

브라우저가 열리면 이 폴더(`notes/`) 안의 `.ipynb` 파일을 열고, 커널로 **Deno**를 선택한다
(`deno jupyter --install`로 이미 등록돼 있음). 노트북은 자신이 있는 폴더를 작업 디렉터리로
삼으므로, `../src/data/...` 같은 상대경로는 **`notes/` 안에서 열었을 때**를 전제로 한다.

첫 실행 시 `npm:d3`를 내려받느라 몇 초 걸릴 수 있다 — `deno.json`의 `nodeModulesDir: "auto"`
덕분에 `notes/node_modules/`에만 격리되어 설치되고, 메인 Next.js 앱의 `node_modules`/
`package-lock.json`과는 완전히 무관하다.

> `deno jupyter` 커널은 Deno 스스로 "실험적(unstable)"이라 표시하는 기능이다. 드물게 셀
> 출력(차트뿐 아니라 `console.log` 텍스트도)이 에러 없이 비어 보일 때가 있다(전송 중 메시지가
> 누락되는 알려진 문제) — **그 셀만 다시 실행**하면 대부분 바로 나온다.

## 재사용 모듈

- `lib/chart.ts` — 라인·막대·산점도 SVG를 그리는 순수 함수 3개. `npm:d3`의 scale/shape
  서브모듈만 쓰고(DOM 불필요), 색상은 이 저장소의 기존 관례(`src/lib/market/format.ts`의
  `CANDLE_COLORS` — 국내 증시식 상승 빨강/하락 파랑)를 그대로 따른다.

## 노트북 목록 (로드맵)

| 노트북 | 상태 | 내용 |
|---|---|---|
| [`01-kospi-market-explorer.ipynb`](./01-kospi-market-explorer.ipynb) | ✅ 완성 | 시드 데이터 로드, JS 기초 워밍업, 시장 폭·등락률 분포, 시가총액과 등락률의 관계, KOSPI 지수 1년 흐름 |
| [`02-per-pbr-value-screen.ipynb`](./02-per-pbr-value-screen.ipynb) | ✅ 완성 | `Object.groupBy`로 종목코드↔법인등록번호↔재무제표 조인, PER/PBR 계산·분포, 가치주 스크리닝과 이익 추세로 보는 가치 함정 → [`stock-financials-per-pbr.md`](../docs/learning/stock-financials-per-pbr.md) |
| `03-single-stock-deep-dive.ipynb` | 계획 | 실 API(`DATA_GO_KR_SERVICE_KEY`)로 종목 하나의 1년 일봉을 받아 캔들·이동평균·거래량 시각화 → [`stock-price-basics.md`](../docs/learning/stock-price-basics.md), [`stock-order-execution.md`](../docs/learning/stock-order-execution.md). 01번과 달리 여기서만 실 API를 쓴다(01번은 오프라인 재현성을 위해 시드만 사용) |
| `04-dividends-and-fees.ipynb` | 계획 | 배당수익률 분포, 수수료·세금이 수익률에 미치는 영향 시뮬레이션(`src/lib/game/rules.ts`의 정수 연산 `commissionOf`/`sellTaxOf` 패턴 재사용) → [`stock-dividends.md`](../docs/learning/stock-dividends.md), [`stock-fees-and-taxes.md`](../docs/learning/stock-fees-and-taxes.md) |

## 데이터 출처

노트북은 실시간 API 대신 **저장소에 커밋된 시드**(`src/data/*.json`)를 우선 쓴다 — 몇 달
뒤에 다시 열어도 항상 같은 결과가 나와야 학습에 쓸모가 있어서다. API 명세는
[`docs/api-reference.md`](../docs/api-reference.md), 데이터 계층 구조는
[`docs/market-data.md`](../docs/market-data.md) 참고.
