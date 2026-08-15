# 반응형 — 모바일 퍼스트 앱을 데스크톱에 입히기

## 개념

### 모바일 퍼스트와 단일 전환점

Tailwind 의 반응형 접두사는 **min-width 기준**이다: 접두사 없는 클래스가 기본(모바일),
`lg:` 는 "1024px 이상에서만 덮어쓰기". 그래서 모바일 UI 는 한 글자도 안 바꾸고
데스크톱 스타일을 **추가**할 수 있다 — 이 프로젝트가 그렇게 했다.

전환점은 **lg(1024px) 하나로 통일**했다. 탭바↔헤더 내비, 바텀시트↔중앙 모달,
고정 주문바↔사이드 카드가 전부 같은 지점에서 바뀐다. 전환점이 두 개면 "탭바는
사라졌는데 헤더 내비는 아직 없는" 중간 파손 구간이 생긴다. 768~1023px(태블릿 세로)은
터치 기기일 가능성이 높아 모바일 UI 를 유지한다 — JS 로 기기를 감지하지 않고
화면 폭만으로 근사하는 원칙.

### Tailwind v4 CSS-first: `@utility`

v4 는 설정 파일 대신 CSS 에서 커스텀 유틸리티를 정의한다. `max-w-3xl` 이 13곳에
하드코딩되어 있던 것을 유틸리티 하나로 수렴시켰다:

```css
@utility container-page {
  margin-inline: auto;
  width: 100%;
  max-width: var(--container-3xl);          /* 모바일 768px */
  @media (width >= 64rem) {
    max-width: var(--container-5xl);        /* 데스크톱 1024px */
  }
}
```

이제 데스크톱 콘텐츠 폭을 바꾸려면 이 한 줄만 고치면 된다.

### fixed 요소는 DOM 위치와 무관하다 (이번 작업의 핵심 트릭)

`position: fixed` 는 (transform/filter 조상이 없는 한) **뷰포트 기준**으로 붙는다.
그래서 주문 바(TradePanel)를 페이지 맨 아래에서 사이드바 `<aside>` 안으로 옮겨도
모바일에선 여전히 화면 하단에 고정되고, 데스크톱에선 `lg:static` 으로 바꾸면
그 자리의 카드가 된다 — **같은 컴포넌트가 CSS 만으로 두 모드**를 오간다.

함정 두 가지:
- aside 에 `transform` 류 클래스를 넣는 순간 fixed 의 기준이 aside 로 바뀌어
  모바일 바가 깨진다 (containing block 규칙).
- 바텀시트를 중앙 모달로 바꿀 때 시트를 `lg:static` 으로 하면 **딤(absolute)이
  시트 위에 그려진다**. positioned 요소끼리는 DOM 순서로 페인트되므로
  `lg:relative` 로 두어야 시트가 딤 위에 온다.

### grid 소스 순서 vs 시각 순서

모바일 표시 순서(가격→보유→차트→리포트)를 DOM 소스 순서로 유지한 채,
데스크톱에서만 `lg:order-1/2` 로 좌우를 재배치했다. 스크린리더·탭 순서는
소스 순서를 따르므로 접근성 순서가 화면 크기에 따라 널뛰지 않는다.

또 하나의 습관: 그리드 컬럼은 `1fr` 대신 **`minmax(0,1fr)`**. 그리드 자식의
암묵적 `min-width:auto` 때문에 안의 표(`min-w-[480px]`)가 컬럼을 밀어내는 것을 막는다.

### :focus-visible

마우스 클릭에는 안 뜨고 **키보드 포커스에만** 뜨는 아웃라인. 전역 base 레이어
한 줄로 모든 버튼·링크가 키보드 링을 얻는다:

```css
@layer base {
  :focus-visible { outline: 2px solid var(--color-zinc-500); outline-offset: 2px; }
}
```

## 이 프로젝트에서 어디에 쓰였나

- `src/app/globals.css` — `container-page`, focus-visible, (부채 수정) Geist 폰트 복원
- `src/components/HeaderNav.tsx` + `TabBar.tsx`(`lg:hidden`, TABS 공유) — 내비 전환
- `src/app/stocks/[code]/page.tsx` — 2컬럼 grid + order + sticky 사이드바
- `TradePanel/GameSettlement/ConceptTip` — 바텀시트→중앙 모달 공통 레시피
- `src/hooks/useEscapeClose.ts` — 모달 Esc 닫기
