import { createInitialState, GAME_SCHEMA_VERSION, type GameState } from "./types";

/**
 * 게임 상태 스토어 — React 밖의 localStorage 저장소.
 *
 * `useWatchlist` 에서 확립한 패턴을 그대로 따른다:
 * - `useSyncExternalStore` 용 subscribe / getSnapshot
 * - raw 문자열 비교로 **참조 동일성 캐싱** (매번 새 객체를 만들면 무한 렌더)
 * - `storage` 이벤트 구독으로 다른 탭과 동기화
 * - 사생활 보호 모드 등 localStorage 접근 실패는 try/catch 로 흡수
 */

const STORAGE_KEY = "rokstock:game";

/** 서버 렌더/하이드레이션 기준이 될 고정 스냅샷. 화면은 `ready` 로 가려서 노출되지 않는다 */
const SERVER_STATE: GameState = createInitialState(new Date(0));

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeGame(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** 저장된 게 없을 때 쓸 새 게임 상태 — 세션 안에서는 같은 참조를 유지한다 */
let defaultState: GameState | null = null;

function getDefault(): GameState {
  defaultState ??= createInitialState(new Date());
  return defaultState;
}

/**
 * 저장된 값을 GameState 로 되살린다. 스키마 버전이 다르거나 형태가 깨졌으면
 * 새 게임으로 되돌린다 — 향후 버전업 시 이 함수에 마이그레이션을 추가한다.
 */
function migrate(raw: string): GameState {
  try {
    const parsed = JSON.parse(raw) as Partial<GameState> | null;
    if (
      parsed &&
      parsed.schemaVersion === GAME_SCHEMA_VERSION &&
      typeof parsed.cash === "number" &&
      typeof parsed.startedAt === "string" &&
      Array.isArray(parsed.positions) &&
      Array.isArray(parsed.pendingOrders) &&
      Array.isArray(parsed.trades)
    ) {
      return parsed as GameState;
    }
  } catch {
    // fall through
  }
  console.warn("[game] 저장된 게임 상태를 읽지 못해 새 게임으로 시작합니다.");
  return getDefault();
}

let cachedRaw: string | null = null;
let cachedState: GameState = SERVER_STATE;
let cacheInitialized = false;

export function getGameSnapshot(): GameState {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return cachedState;
  }

  if (!cacheInitialized || raw !== cachedRaw) {
    cacheInitialized = true;
    cachedRaw = raw;
    cachedState = raw === null ? getDefault() : migrate(raw);
  }
  return cachedState;
}

export function getServerGameSnapshot(): GameState {
  return SERVER_STATE;
}

function write(state: GameState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 저장이 막혀도 화면 동작은 유지한다 (새로고침하면 사라질 뿐)
  }
  emit();
}

/**
 * 첫 방문 시 게임을 개시한다 — 저장된 게 없으면 초기 상태를 기록해 `startedAt` 을 고정한다.
 * (getSnapshot 은 렌더 중에 불리므로 거기서 쓰기를 하면 안 된다. effect 에서 호출할 것)
 */
export function ensureGameStarted() {
  try {
    if (window.localStorage.getItem(STORAGE_KEY) === null) {
      write(getDefault());
    }
  } catch {
    // localStorage 접근 불가 — 메모리 상태로만 진행
  }
}

/** 상태 갱신 — updater 는 새 객체를 반환해야 한다 (불변 갱신) */
export function updateGame(updater: (state: GameState) => GameState) {
  write(updater(getGameSnapshot()));
}

/** 게임 초기화 — 저장 삭제 후 새 게임 개시 */
export function resetGameStore() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 무시
  }
  defaultState = null; // 새 startedAt 으로
  write(getDefault());
}
