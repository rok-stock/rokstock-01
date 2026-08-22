import { sendGTMEvent } from "@next/third-parties/google";

/**
 * 사용자 행동 이벤트 → GTM dataLayer.
 *
 * 이벤트·파라미터 이름은 GTM 컨테이너(GTM-5D6J39X9)의 구성과 계약이다:
 * - 트리거 "CE - App Events"가 이벤트 이름 `trade|achievement|share` 를 정규식 매칭
 * - 태그 "GA4 Event - App Events"가 아래 파라미터들을 GA4(G-72NP373Q8J)로 전달
 * 여기서 이름을 바꾸면 GTM 쪽도 같이 바꿔야 한다.
 *
 * dataLayer 는 이전 push 값이 유지(persist)되므로, 각 이벤트에서 쓰지 않는
 * 파라미터를 null 로 명시해 지운다 — 안 그러면 직전 매매의 종목코드가
 * share 이벤트에 딸려 가는 식으로 섞인다.
 *
 * GTM 스니펫이 없는 환경(로컬 개발 등)에서는 dataLayer 가 없어 조용히 무시된다.
 */

type GtmEvent = Record<string, string | number | null>;

const PARAM_KEYS = [
  "trade_side",
  "stock_code",
  "stock_name",
  "trade_quantity",
  "trade_value",
  "achievement_id",
  "share_method",
] as const;

function send(event: string, params: GtmEvent) {
  // 미사용 파라미터는 null 로 리셋 (stale 값 방지)
  const payload: GtmEvent & { event: string } = { event };
  for (const key of PARAM_KEYS) payload[key] = params[key] ?? null;
  sendGTMEvent(payload);
}

/** 매수/매도 체결 */
export function trackTrade(input: {
  side: "buy" | "sell";
  code: string;
  name: string;
  quantity: number;
  /** 체결 금액 (원) */
  value: number;
}) {
  send("trade", {
    trade_side: input.side,
    stock_code: input.code,
    stock_name: input.name,
    trade_quantity: input.quantity,
    trade_value: input.value,
  });
}

/** 업적 달성 */
export function trackAchievement(id: string) {
  send("achievement", { achievement_id: id });
}

/** 공유 버튼 사용 */
export function trackShare(method: "web_share" | "clipboard") {
  send("share", { share_method: method });
}
