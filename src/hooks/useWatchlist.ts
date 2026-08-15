"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "rokstock:watchlist";

/** 저장된 게 없을 때 보여줄 기본 관심 종목 */
const DEFAULT_CODES = ["005930", "000660", "035420"];

/** 서버에는 localStorage가 없다. 하이드레이션 기준이 될 고정된 빈 배열. */
const SERVER_SNAPSHOT: string[] = [];

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // 다른 탭에서 바꾼 경우도 반영한다 (storage 이벤트는 다른 탭에서만 발생)
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

// getSnapshot 은 값이 안 바뀌었으면 **같은 참조**를 돌려줘야 한다.
// 매번 새 배열을 만들면 React 가 "계속 바뀐다"고 판단해 무한 렌더에 빠진다.
let cachedRaw: string | null = null;
let cachedCodes: string[] = DEFAULT_CODES;

function parse(raw: string | null): string[] {
  if (raw === null) return DEFAULT_CODES;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return DEFAULT_CODES;
  }
}

function getSnapshot(): string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return cachedCodes;
  }

  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedCodes = parse(raw);
  }
  return cachedCodes;
}

function write(codes: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(codes));
  } catch {
    // 사생활 보호 모드 등에서 저장이 막힐 수 있다. 화면 동작은 유지한다.
  }
  emit();
}

/** 관심 종목을 기본값으로 초기화 — 게임 리셋의 "관심종목도 초기화" 옵션에서 쓴다 */
export function resetWatchlist() {
  write(DEFAULT_CODES);
}

/**
 * 관심 종목을 브라우저 localStorage 에 저장하는 훅.
 *
 * localStorage 는 브라우저에만 있고 서버에는 없다. `useEffect` 안에서 `setState` 로 읽어오면
 * 렌더가 한 번 더 도는데, React 는 이런 "외부 저장소 구독"에는 `useSyncExternalStore` 를 쓰라고
 * 안내한다. 서버 스냅샷과 클라이언트 스냅샷을 따로 줄 수 있어 하이드레이션 불일치도 막아준다.
 *
 * `ready` 는 "아직 브라우저에서 못 읽었음"과 "읽었는데 비어있음"을 구분하기 위한 값이다.
 */
export function useWatchlist() {
  const codes = useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const add = useCallback((code: string) => {
    const current = getSnapshot();
    if (current.includes(code)) return;
    write([...current, code]);
  }, []);

  const remove = useCallback((code: string) => {
    write(getSnapshot().filter((item) => item !== code));
  }, []);

  const has = useCallback((code: string) => codes.includes(code), [codes]);

  return { codes, ready, add, remove, has };
}
