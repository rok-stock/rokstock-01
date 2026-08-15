# 모바일 웹 UX — 바텀시트, safe-area, 숫자 입력

## 개념

### 바텀시트 (bottom sheet)

모바일에서 모달 대신 화면 아래에서 올라오는 패널. 엄지가 닿는 영역에 조작부가 오고,
바깥(오버레이)을 탭하면 닫힌다. 이 프로젝트는 라이브러리 없이 직접 만들었다:

```
<div role="dialog" aria-modal="true">        ← 접근성: 대화상자임을 알림
  <button class="fixed inset-0 bg-black/40"> ← 오버레이 (탭하면 닫기)
  <div class="fixed bottom-0 rounded-t-2xl"> ← 패널
```

`window.confirm` / `alert` 는 브라우저 전체를 멈추는 모달이라 쓰지 않는다 —
설정의 초기화 확인도 인라인 패널로 처리했다.

### safe-area

아이폰의 홈 인디케이터·노치 영역은 콘텐츠를 가린다. CSS `env()` 변수로 피한다:

```css
padding-bottom: env(safe-area-inset-bottom);
```

이 프로젝트에서 하단 고정 요소가 3층이라 각자 오프셋을 계산한다:
TabBar(bottom-0) → 매수/매도 바(bottom: 3.5rem + safe-area) → 토스트(그 위).

### 모바일 숫자 입력

```html
<input inputMode="numeric" pattern="[0-9]*" />
```

- `inputMode="numeric"` — 모바일에서 **숫자 키패드**가 뜬다 (`type="number"` 는
  스피너·지수표기 등 부작용이 많아 금액 입력엔 잘 안 쓴다)
- 입력값은 콤마를 넣어 보여주되(`toLocaleString`), 상태에는 숫자만 저장
- 퍼센트 칩(10/25/50/최대)으로 타이핑 자체를 줄이는 게 더 좋은 UX

## 이 프로젝트에서 어디에 쓰였나

- `src/components/TradePanel.tsx` — 주문 바텀시트 전체 (오버레이·safe-area·숫자 입력·칩)
- `src/components/TabBar.tsx` — 하단 탭의 safe-area 대응
- `src/app/settings/page.tsx` — confirm 대신 인라인 확인 패널
