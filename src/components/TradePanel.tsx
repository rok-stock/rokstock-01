"use client";

import AchievementModal from "@/components/AchievementModal";
import ConceptTip from "@/components/ConceptTip";
import { useGame } from "@/hooks/useGame";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import type { AchievementDef } from "@/lib/game/achievements";
import { COMMISSION_RATE, commissionOf, sellTaxOf } from "@/lib/game/rules";
import { formatPrice } from "@/lib/market/format";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * 종목 상세 하단의 매수/매도 바 + 주문 바텀시트.
 *
 * 조회 시점의 최신 종가로 **그 자리에서 즉시 체결**된다 (docs/game-design.md 2절) — 체결가가
 * 화면에 뜬 가격 그대로라 매도는 수량을 바로 지정하고, 매수도 예산(금액) 안에서 살 수 있는
 * 최대 수량이 즉시 확정된다. 바텀시트는 라이브러리 없이 fixed 오버레이로 만든다 —
 * 모바일 웹 UX 학습 겸.
 */

interface TradePanelProps {
  code: string;
  name: string;
  /** 조회 시점 최신 종가 — 그대로 체결가가 된다 */
  price: number;
  /** 종가 기준일 */
  date: string;
}

type SheetMode = "buy" | "sell" | null;

/** 숫자 입력값(콤마 제거) → 정수. 비었거나 이상하면 0 */
function parseInput(raw: string): number {
  const n = Number(raw.replace(/[^0-9]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function withComma(n: number): string {
  return n === 0 ? "" : n.toLocaleString("ko-KR");
}

export default function TradePanel({ code, name, price, date }: TradePanelProps) {
  const { state, ready, placeBuyOrder, placeSellOrder } = useGame();
  const [mode, setMode] = useState<SheetMode>(null);
  const [rawValue, setRawValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [earned, setEarned] = useState<AchievementDef[]>([]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const position = state.positions.find((p) => p.code === code);
  const sellable = position?.quantity ?? 0;

  const value = parseInput(rawValue);

  const openSheet = (next: Exclude<SheetMode, null>) => {
    setMode(next);
    setRawValue("");
    setError(null);
  };

  const close = useCallback(() => setMode(null), []);
  useEscapeClose(mode !== null, close);

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  const submit = () => {
    const base = { code, name, price, date };
    const result =
      mode === "buy"
        ? placeBuyOrder({ ...base, amount: value })
        : placeSellOrder({ ...base, quantity: value });

    if (result.ok) {
      close();
      const { trade } = result;
      showToast(
        trade.side === "buy"
          ? `✅ ${trade.quantity}주 매수 체결! ${formatPrice(trade.price)}원 × ${trade.quantity}주 (수수료 ${formatPrice(trade.fee)}원)`
          : `✅ ${trade.quantity}주 매도 체결! 실현손익 ${
              (trade.realizedPnl ?? 0) >= 0 ? "+" : ""
            }${formatPrice(trade.realizedPnl ?? 0)}원`,
      );
      if (result.earned.length > 0) setEarned(result.earned);
      return;
    }
    setError(
      {
        invalid_amount: "주문 금액을 입력해 주세요.",
        insufficient_cash: "주문 가능 현금이 부족합니다.",
        amount_too_small: "주문 금액이 1주 가격에도 못 미칩니다.",
        invalid_quantity: "주문 수량을 입력해 주세요.",
        insufficient_quantity: "보유 수량을 넘었습니다.",
      }[result.reason],
    );
  };

  // 매수: 살 수 있는 수량 (금액 안에서 수수료 포함 최대로 살 수 있는 주 수, 조회가 기준 — 이 값 그대로 체결된다)
  const buyQty = Math.floor(value / (price * (1 + COMMISSION_RATE)));
  // 매도: 정산 금액 (조회가 기준 — 이 값 그대로 체결된다)
  const sellGross = value * price;
  const sellFee = commissionOf(sellGross);
  const sellTax = sellTaxOf(sellGross);
  const sellNet = sellGross - sellFee - sellTax;
  const sellPnl = position ? sellNet - value * position.avgPrice : 0;

  return (
    <>
      {/* 모바일: 하단 고정 매수/매도 바 — TabBar(3.5rem) 바로 위. 데스크톱(lg): 사이드바 인라인 카드 */}
      <div className="fixed inset-x-0 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur bottom-[calc(3.5rem+env(safe-area-inset-bottom))] lg:static lg:mt-6 lg:rounded-2xl lg:border lg:bg-transparent lg:backdrop-blur-none dark:border-zinc-800 dark:bg-zinc-950/95 dark:lg:bg-transparent">
        <div className="mx-auto flex max-w-3xl gap-2 px-6 py-3 lg:px-4">
          <button
            type="button"
            onClick={() => openSheet("buy")}
            className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white hover:bg-red-700"
          >
            매수
          </button>
          <button
            type="button"
            onClick={() => openSheet("sell")}
            disabled={!ready || sellable === 0}
            className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-35"
          >
            매도{sellable > 0 ? ` (${sellable}주)` : ""}
          </button>
        </div>
      </div>

      {/* 체결 결과 토스트 — 포털: 데스크톱에서 sticky 사이드바(스태킹 컨텍스트)에 갇히지 않도록 body 로 탈출 */}
      {toast &&
        createPortal(
          <div
            role="status"
            className="fixed inset-x-4 z-50 mx-auto max-w-md rounded-xl bg-zinc-900 px-4 py-3 text-center text-sm text-white shadow-lg bottom-[calc(8rem+env(safe-area-inset-bottom))] lg:bottom-10 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {toast}
          </div>,
          document.body,
        )}

      <AchievementModal achievements={earned} onClose={() => setEarned([])} />

      {/* 주문 시트 — 모바일: 하단 바텀시트 / 데스크톱(lg): 중앙 모달.
          포털로 body 에 렌더 — sticky 사이드바의 스태킹 컨텍스트에 갇히면 차트 캔버스가 위로 비친다.
          ⚠️ 시트는 lg:static 이 아니라 lg:relative 여야 딤(absolute) 위에 그려진다 */}
      {mode &&
        createPortal(
          <div
            className="fixed inset-0 z-50 lg:grid lg:place-items-center lg:p-6"
            role="dialog"
            aria-modal="true"
            aria-label="주문"
          >
          <button
            type="button"
            aria-label="닫기"
            onClick={close}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-3xl rounded-t-2xl bg-white p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] lg:relative lg:inset-auto lg:w-full lg:max-w-lg lg:rounded-2xl lg:p-6 lg:pb-6 lg:shadow-xl dark:bg-zinc-900">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">
                {name}{" "}
                <span className={mode === "buy" ? "text-red-600" : "text-blue-600"}>
                  {mode === "buy" ? "매수" : "매도"}
                </span>
              </h2>
              <span className="text-sm tabular-nums text-zinc-500">
                {formatPrice(price)}원 · {date} 종가
              </span>
            </div>

            {/* 금액/수량 입력 */}
            <label className="mt-5 block">
              <span className="text-sm text-zinc-500">
                {mode === "buy" ? "주문 금액 (원)" : "주문 수량 (주)"}
              </span>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                autoFocus
                value={withComma(value)}
                onChange={(e) => {
                  setRawValue(e.target.value);
                  setError(null);
                }}
                placeholder={mode === "buy" ? "얼마어치 살까요?" : "몇 주 팔까요?"}
                className="mt-1 w-full rounded-xl border border-zinc-300 px-4 py-3 text-right text-2xl tabular-nums outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>

            {/* 퍼센트 칩 */}
            <div className="mt-3 flex gap-2">
              {(mode === "buy" ? [10, 25, 50, 100] : [25, 50, 75, 100]).map((pct) => {
                const target =
                  mode === "buy"
                    ? Math.floor((state.cash * pct) / 100)
                    : Math.floor((sellable * pct) / 100);
                return (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => {
                      setRawValue(String(target));
                      setError(null);
                    }}
                    className="flex-1 rounded-lg border border-zinc-300 py-2 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {pct === 100 ? "최대" : `${pct}%`}
                  </button>
                );
              })}
            </div>

            {/* 체결 정보 — 조회가 그대로 체결가라 "예상"이 아니라 확정값이다 */}
            <dl className="mt-4 space-y-1.5 rounded-xl bg-zinc-50 p-4 text-sm dark:bg-zinc-950">
              {mode === "buy" ? (
                <>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">주문 가능 현금</dt>
                    <dd className="tabular-nums">{formatPrice(state.cash)}원</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">매수 수량</dt>
                    <dd className="tabular-nums">{buyQty}주</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">
                      <ConceptTip id="fees">수수료</ConceptTip> (0.015%)
                    </dt>
                    <dd className="text-zinc-500">주문 금액에 포함</dd>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">매도 금액</dt>
                    <dd className="tabular-nums">{formatPrice(sellGross)}원</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">
                      <ConceptTip id="fees">수수료 + 세금</ConceptTip> (0.015% + 0.15%)
                    </dt>
                    <dd className="tabular-nums">-{formatPrice(sellFee + sellTax)}원</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">
                      <ConceptTip id="realizedPnl">실현손익</ConceptTip>
                    </dt>
                    <dd className={`tabular-nums ${sellPnl >= 0 ? "text-red-600" : "text-blue-600"}`}>
                      {sellPnl >= 0 ? "+" : ""}
                      {formatPrice(sellPnl)}원
                    </dd>
                  </div>
                </>
              )}
            </dl>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <button
              type="button"
              onClick={submit}
              disabled={value === 0}
              className={`mt-4 w-full rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-35 ${
                mode === "buy" ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {mode === "buy"
                ? `${withComma(value) || "0"}원 매수`
                : `${withComma(value) || "0"}주 매도`}
            </button>
          </div>
          </div>,
          document.body,
        )}
    </>
  );
}
