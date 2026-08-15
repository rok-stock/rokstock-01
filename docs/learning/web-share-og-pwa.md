# 공유의 3층 — Web Share API, Open Graph, PWA 매니페스트

## 개념

"공유가 잘 되는 웹앱"은 사실 세 가지 표준의 합이다.

### 1. Web Share API — 보내는 쪽

```js
navigator.share({ title, text, url });
```

특정 SNS 버튼을 늘어놓는 대신 **OS 의 기본 공유 시트**를 연다 — 사용자가 쓰는 앱
(카카오톡이든 메시지든)이 알아서 나온다. 주의점 두 가지:

- 모바일은 대부분 지원하지만 **데스크톱 브라우저는 지원이 들쭉날쭉**하다 →
  `navigator.share` 유무를 확인하고 **클립보드 복사 폴백**을 반드시 둔다.
- 사용자가 공유 시트를 그냥 닫으면 `AbortError` 가 던져진다 — 에러가 아니라 취소이므로
  조용히 무시한다.

### 2. Open Graph — 받는 쪽이 보는 카드

링크를 붙여넣었을 때 카카오톡/슬랙이 보여주는 프리뷰는 `<meta property="og:*">` 를
읽어 만든다. Next.js 에서는 `metadata.openGraph` + **`opengraph-image.tsx`** 파일 컨벤션으로
끝난다 — 파일을 두면 `og:image` 메타가 자동으로 붙는다 (`metadataBase` 로 절대 URL 화).

이미지 생성기(satori)의 함정: **시스템 폰트가 없다.** 한글을 그리려면 폰트 파일을
직접 넣어야 하는데, 구글 폰트 css2 의 `text=` 파라미터로 **쓰는 글자만 서브셋**하면
수 MB 폰트가 몇 KB 로 줄어든다. 동적 파라미터가 없는 이미지는 빌드 때 한 번만 생성된다.

### 3. PWA 매니페스트 — 홈 화면에 자리 잡기

`manifest.ts` 가 "홈 화면에 추가/앱 설치" 때의 정체성을 정한다:

- `name`(설치 다이얼로그) vs **`short_name`(아이콘 밑 라벨)** — 라벨은 잘리기 쉬워
  한글 4~6자가 안전하다. 이 앱: "하루 늦은 모의주식" / "하루주식"
- **maskable 아이콘**: 안드로이드는 아이콘을 원/스쿼클로 잘라낸다. `purpose: "maskable"`
  아이콘은 내용물을 중앙 안전 영역(약 60%) 안에 그려야 잘려나가지 않는다
- 아이콘도 `icon.tsx`/`apple-icon.tsx` 로 코드에서 생성 — 디자인 수정이 곧 코드 리뷰가 된다

## 이 프로젝트에서 어디에 쓰였나

- `src/components/ShareButton.tsx` — 공유 시트 + 클립보드 폴백 (설정 화면)
- `src/app/opengraph-image.tsx` — 1200×630 카드 (한글 서브셋 + 캔들 실루엣 🐢)
- `src/app/manifest.ts` · `icon.tsx` · `apple-icon.tsx` — PWA 이름/아이콘
