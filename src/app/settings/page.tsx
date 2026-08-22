"use client";

import ShareButton from "@/components/ShareButton";
import { useGame } from "@/hooks/useGame";
import { ACHIEVEMENTS } from "@/lib/game/achievements";
import { formatPrice } from "@/lib/market/format";
import { useState } from "react";

/**
 * 설정 — 게임 정보 확인과 초기화.
 *
 * 초기화는 2단계 확인을 거친다. `window.confirm` 은 브라우저를 통째로 멈추는 모달이라
 * 쓰지 않고, 인라인 확인 패널로 처리한다.
 */
export default function SettingsPage() {
  const { state, ready, resetGame } = useGame();
  const [confirming, setConfirming] = useState(false);
  const [clearWatchlist, setClearWatchlist] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const handleReset = () => {
    resetGame({ clearWatchlist });
    setConfirming(false);
    setClearWatchlist(false);
    setResetDone(true);
  };

  return (
    <main className="container-page flex-1 px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">설정</h1>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">게임 정보</h2>
        <dl className="mt-3 space-y-2 rounded-2xl border border-zinc-200 p-5 text-sm dark:border-zinc-800">
          {ready ? (
            <>
              <div className="flex justify-between">
                <dt className="text-zinc-500">시작일</dt>
                <dd className="tabular-nums">{state.startedAt.slice(0, 10)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">체결된 거래</dt>
                <dd className="tabular-nums">{state.trades.length}회</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">누적 실현손익</dt>
                <dd className="tabular-nums">{formatPrice(state.realizedPnlTotal)}원</dd>
              </div>
            </>
          ) : (
            <p className="text-zinc-400">불러오는 중…</p>
          )}
        </dl>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">공유</h2>
        <div className="mt-3 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            친구와 함께 각자 1억으로 시작해 수익률을 겨뤄보세요. 로그인이 없어서 링크만 열면
            바로 시작됩니다.
          </p>
          <div className="mt-4">
            <ShareButton />
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          업적 {ready && `(${state.achievements.length}/${ACHIEVEMENTS.length})`}
        </h2>
        <ul className="mt-3 space-y-2">
          {ACHIEVEMENTS.map((achievement) => {
            const earned = ready && state.achievements.includes(achievement.id);
            return (
              <li
                key={achievement.id}
                className={`rounded-xl border p-4 ${
                  earned
                    ? "border-violet-200 bg-violet-50 dark:border-violet-900 dark:bg-violet-950"
                    : "border-zinc-200 opacity-60 dark:border-zinc-800"
                }`}
              >
                <p className="text-sm font-medium">
                  {earned ? achievement.emoji : "🔒"} {achievement.title}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {achievement.description}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">데이터 안내</h2>
        <p className="mt-3 rounded-2xl border border-zinc-200 p-5 text-sm leading-6 text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
          시세는 공공데이터포털의 <strong>일별 데이터(T+1)</strong>로, 다음 영업일 오후 1시경
          갱신됩니다. 화면의 가격은 항상 가장 최근 영업일의 <strong>종가</strong>이며,
          매수/매도는 그 화면에 뜬 가격으로 그 자리에서 즉시 체결됩니다 — 가격 정보 자체가
          하루 늦다는 뜻에서 이 게임의 이름이 &ldquo;하루 늦은 모의주식&rdquo;입니다.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">게임 초기화</h2>
        <div className="mt-3 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
          {resetDone && !confirming ? (
            <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
              새 게임을 시작했습니다. 1억 원이 입금되었어요 💸
            </p>
          ) : null}

          {!confirming ? (
            <>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                계좌·보유 종목·주문·거래 내역을 모두 지우고 초기 자금 1억 원으로 새 게임을
                시작합니다.
              </p>
              <button
                type="button"
                onClick={() => {
                  setConfirming(true);
                  setResetDone(false);
                }}
                className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
              >
                게임 초기화…
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-red-600 dark:text-red-400">
                정말 초기화할까요? 되돌릴 수 없습니다.
              </p>
              {ready && (
                <p className="mt-2 text-sm text-zinc-500">
                  지금까지: {state.startedAt.slice(0, 10)} 시작 · 거래 {state.trades.length}회 ·
                  실현손익 {formatPrice(state.realizedPnlTotal)}원
                </p>
              )}
              <label className="mt-3 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={clearWatchlist}
                  onChange={(e) => setClearWatchlist(e.target.checked)}
                  className="h-4 w-4"
                />
                관심 종목도 초기화
              </label>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  초기화 확인
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
