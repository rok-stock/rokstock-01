# ARIA 콤보박스 — 검색 자동완성을 키보드·스크린리더가 쓸 수 있게

## 개념

검색창 + 결과 드롭다운은 눈과 마우스로는 자명하지만, 키보드·스크린리더에게는
"입력창 아래에 목록이 떠 있다"는 사실 자체가 전달되지 않는다. WAI-ARIA 의
**combobox 패턴**이 그 연결을 만든다:

| 속성 | 어디에 | 뜻 |
|---|---|---|
| `role="combobox"` | 입력창 | "목록을 조종하는 입력창"임을 선언 |
| `aria-expanded` | 입력창 | 목록이 열려 있는지 |
| `aria-controls` | 입력창 | 조종하는 목록의 id |
| `role="listbox"` / `role="option"` | 목록/항목 | 선택지 목록임을 선언 |
| `aria-activedescendant` | 입력창 | **포커스는 입력창에 둔 채** "지금 짚고 있는 항목"의 id 를 가리킴 |
| `aria-selected` | 항목 | 짚고 있는 항목 표시 |

핵심 트릭은 `aria-activedescendant` 다 — 실제 DOM 포커스를 옮기면 입력이 끊기므로,
포커스는 입력창에 두고 "가상 포커스"만 목록 위를 움직인다.

## 키보드 규약 (이 프로젝트 구현)

- **↓/↑**: 결과 항목 이동 (끝에서 반대편으로 순환). `preventDefault()` 로 커서 이동 방지
- **Enter**: 짚은 항목으로 이동, 선택 전이면 첫 결과로 — "타이핑 → Enter" 만으로 검색 완료
- **Esc**: 드롭다운 닫기
- 마우스 hover 도 activeIndex 를 갱신해 키보드/마우스 상태가 어긋나지 않게 한다

주의: 항목 이동은 setState 로만 하고 DOM `focus()` 를 호출하지 않는다.
활성 항목의 시각 표시(배경색)와 `aria-selected` 가 같은 상태에서 나와야 한다.

## 이 프로젝트에서 어디에 쓰였나

- `src/components/StockSearch.tsx` — 헤더 종목 검색 (250ms 디바운스 + AbortController 는 M1 부터,
  콤보박스 키보드/ARIA 는 G8 후속에서 추가)
