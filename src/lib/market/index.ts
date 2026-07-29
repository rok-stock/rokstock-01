import { dataGoKrProvider } from "./datagokr-provider";
import { mockProvider } from "./mock-provider";
import type { MarketDataProvider } from "./types";

/**
 * 환경변수로 시세 공급자를 고른다.
 *
 * - `MARKET_DATA_PROVIDER=mock`     (기본) API 키 없이 동작하는 가짜 시세
 * - `MARKET_DATA_PROVIDER=datagokr` 공공데이터포털 실제 시세 (DATA_GO_KR_SERVICE_KEY 필요)
 *
 * 자세한 설정법은 `docs/market-data.md` 참고.
 */
function selectProvider(): MarketDataProvider {
  const selected = process.env.MARKET_DATA_PROVIDER?.trim().toLowerCase();

  if (selected === "datagokr") {
    if (!process.env.DATA_GO_KR_SERVICE_KEY) {
      console.warn(
        "[market] MARKET_DATA_PROVIDER=datagokr 이지만 DATA_GO_KR_SERVICE_KEY 가 없어 목업으로 대체합니다.",
      );
      return mockProvider;
    }
    return dataGoKrProvider;
  }

  return mockProvider;
}

export const marketProvider: MarketDataProvider = selectProvider();

export * from "./types";
