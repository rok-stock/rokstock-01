import { createInitialState, GAME_SCHEMA_VERSION, type GameState, type Trade } from "./types";

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

/** v1/v2 저장분에만 있던 필드 — 마이그레이션에서만 쓰는 느슨한 모양 */
interface LegacyGameState {
  schemaVersion?: number;
  startedAt?: string;
  cash?: number;
  /** v1/v2: 미체결 매수 주문에 잠긴 금액 (v3 에서 제거) */
  lockedCash?: number;
  positions?: Array<{
    code: string;
    name: string;
    quantity: number;
    avgPrice: number;
    totalCost: number;
    /** v1/v2: 미체결 매도 주문에 잠긴 수량 (v3 에서 제거) */
    lockedQuantity?: number;
  }>;
  /** v1/v2: 미체결 주문 목록 (v3 에서 제거 — 즉시 체결로 전환되며 개념 자체가 사라짐) */
  pendingOrders?: unknown[];
  trades?: Trade[];
  realizedPnlTotal?: number;
  achievements?: string[];
}

/**
 * 저장된 값을 GameState 로 되살린다. 아는 모양이면 현재 버전(v3)까지 승격하고,
 * 깨진 형태면 새 게임으로 되돌린다.
 *
 * v1/v2 → v3: 즉시 체결로 전환하며 `pendingOrders`/`lockedCash`/`lockedQuantity` 가
 * 사라졌다. 남아있던 미체결 주문은 **취소된 것으로 간주**해 잠긴 현금을 그대로 돌려준다
 * (잠긴 수량은 원래 `quantity`에 포함돼 있던 값이라 되돌릴 게 없다). 이미 v3인 저장분엔
 * 이 변환이 항등(no-op)이라 매번 실행해도 안전하다.
 */
function migrate(raw: string): GameState {
  try {
    const parsed = JSON.parse(raw) as LegacyGameState | null;

    if (
      parsed &&
      typeof parsed.cash === "number" &&
      typeof parsed.startedAt === "string" &&
      Array.isArray(parsed.positions) &&
      Array.isArray(parsed.trades)
    ) {
      if (parsed.schemaVersion !== GAME_SCHEMA_VERSION) {
        console.info(
          "[game] 게임 상태를 즉시 체결 방식(v3)으로 마이그레이션합니다 — 미체결 주문은 취소 처리됩니다.",
        );
      }
      return {
        schemaVersion: GAME_SCHEMA_VERSION,
        startedAt: parsed.startedAt,
        cash: parsed.cash + (parsed.lockedCash ?? 0),
        positions: parsed.positions.map((p) => ({
          code: p.code,
          name: p.name,
          quantity: p.quantity,
          avgPrice: p.avgPrice,
          totalCost: p.totalCost,
        })),
        trades: parsed.trades,
        realizedPnlTotal: parsed.realizedPnlTotal ?? 0,
        achievements: parsed.achievements ?? [],
      };
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
