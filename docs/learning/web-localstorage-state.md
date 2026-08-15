# localStorage 상태 설계 — 단일 키, 스키마 버전, 외부 스토어

## 개념

이 게임은 서버 DB 없이 **브라우저 localStorage** 에 게임 상태를 통째로 저장한다.
그때 내린 세 가지 설계 결정과 이유:

### 1. 단일 키 저장 (원자성)

계좌 현금·보유 종목·주문·거래 내역을 `rokstock:game` **키 하나**의 JSON 으로 저장한다.
키를 나눠 저장하면(예: `cash`, `positions` 별도) 체결 정산처럼 여러 값을 동시에 바꾸는
작업 중 일부 쓰기만 성공했을 때 **정합성이 깨진다** (현금은 줄었는데 주식은 없는 상태).
localStorage 에는 트랜잭션이 없으므로, "한 번의 setItem = 한 번의 상태 전이"로 만드는 게
가장 단순한 원자성 확보 방법이다. 덤으로 초기화도 `removeItem` 한 번이면 된다.

DB 였다면 트랜잭션으로 풀 문제다 — 보험 시스템에서 계약·수납을 한 트랜잭션으로 묶는 것과
같은 문제의식이다.

### 2. 스키마 버전 (`schemaVersion`)

게임이 업데이트되면 저장된 상태의 **구조가 달라질 수 있다**.
그래서 상태에 `schemaVersion` 을 박아두고, 읽을 때 `migrate()` 를 거친다:

- 버전이 맞고 형태가 온전하면 → 그대로 사용
- 아는 옛 버전이면 → 현재 버전으로 승격
- 모르는 버전/깨진 JSON 이면 → 새 게임으로 초기화

사용자 데이터를 다루는 모든 저장소(DB 마이그레이션, API 버저닝)에 똑같이 적용되는 원칙이다.

**실전 사례 (G7, v1 → v2)**: 업적 시스템이 `achievements: string[]` 필드를 추가하면서
첫 마이그레이션이 실제로 일어났다:

```ts
if (parsed.schemaVersion === 1) {
  // 기존 진행(계좌·포지션·내역)은 그대로, 새 필드만 기본값으로 채운다
  return { ...parsed, schemaVersion: 2, achievements: [] };
}
```

버전을 안 올리고 필드만 추가했다면? 옛 상태를 읽은 코드가 `undefined.includes()` 로
터진다. 마이그레이션은 "추가 비용"이 아니라 기존 사용자의 데이터를 지키는 최소한의 예의다.

### 3. React 밖의 스토어 + useSyncExternalStore

localStorage 는 React 가 모르는 "외부 저장소"다. `useEffect` 에서 읽어 `setState` 하면
깜빡임과 하이드레이션 문제가 생긴다 — 이건 [web-server-client-components.md](./web-server-client-components.md)
에서 다뤘고, `useWatchlist` 때 확립한 패턴을 그대로 재사용했다:

```
src/lib/game/store.ts   subscribe / getSnapshot / update — React 밖의 순수 스토어
src/hooks/useGame.ts    useSyncExternalStore 로 구독하는 얇은 훅
```

주의할 함정 두 가지:

- **참조 동일성**: `getSnapshot()` 이 매번 `JSON.parse` 로 새 객체를 만들면 React 는
  "상태가 계속 바뀐다"고 판단해 무한 렌더에 빠진다. raw 문자열이 같으면 **같은 객체 참조**를
  돌려주도록 캐싱한다.
- **렌더 중 쓰기 금지**: "저장된 게 없으면 초기 상태를 기록"하는 일은 getSnapshot(렌더 중 호출)
  이 아니라 effect(`ensureGameStarted`)에서 한다. 렌더는 순수해야 한다.

## 이 프로젝트에서 어디에 쓰였나

- `src/lib/game/types.ts` — GameState 스키마와 `GAME_SCHEMA_VERSION`
- `src/lib/game/store.ts` — 단일 키 스토어, `migrate()`, 참조 캐싱, storage 이벤트(다른 탭 동기화)
- `src/hooks/useGame.ts` — 화면이 쓰는 유일한 게임 훅
- 원조 패턴: `src/hooks/useWatchlist.ts`

## 참고

- React 문서: useSyncExternalStore
- docs/game-design.md 4절 (스키마 전문)
