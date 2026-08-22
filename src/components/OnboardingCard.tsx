"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "rokstock:onboarding-v1";

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function isDismissed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return true; // localStorage 접근 불가 시 조용히 숨김
  }
}

/**
 * 첫 방문 온보딩 — "왜 하루 늦은가?" 게임 규칙 3장.
 * 닫으면 localStorage 에 기록해 다시 보여주지 않는다. 게임 초기화와 무관하게 유지된다.
 * 서버 렌더에서는 숨겼다가(dismissed 취급) 브라우저에서 판단한다 — 하이드레이션 불일치 방지.
 */
export default function OnboardingCard() {
  const dismissed = useSyncExternalStore(subscribe, isDismissed, () => true);

  if (dismissed) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // 무시
    }
    for (const listener of listeners) listener();
  };

  const rules = [
    {
      title: "시세는 하루 늦게 갱신됩니다",
      body: "공공데이터는 다음 영업일 오후 1시에 공개돼요. 화면 가격은 항상 최근 영업일 종가입니다.",
    },
    {
      title: "그 가격으로 바로 매수/매도",
      body: "화면에 보이는 최신 종가가 곧 체결가예요. 주문을 넣으면 그 자리에서 즉시 체결됩니다.",
    },
    {
      title: "다음 날 오후 1시, 새 가격이 열립니다",
      body: "그 전까지는 같은 가격으로 거래해요. 1억 원으로 시작합니다.",
    },
  ];

  return (
    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-bold text-amber-900 dark:text-amber-100">
          🐢 왜 &ldquo;하루 늦은&rdquo; 모의주식인가요?
        </h2>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-lg px-2 py-1 text-xs text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900"
        >
          알겠어요 ✓
        </button>
      </div>
      <ol className="mt-3 space-y-3">
        {rules.map((rule, i) => (
          <li key={rule.title} className="flex gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-amber-900 dark:bg-amber-800 dark:text-amber-100">
              {i + 1}
            </span>
            <div>
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">{rule.title}</p>
              <p className="mt-0.5 text-xs leading-5 text-amber-800/80 dark:text-amber-200/80">
                {rule.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
