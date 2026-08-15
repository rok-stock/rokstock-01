import { ImageResponse } from "next/og";

/**
 * OG 프리뷰 이미지 (1200×630) — 링크 공유 시 카카오톡/슬랙/트위터 등이 보여주는 카드.
 *
 * 동적 파라미터가 없어 빌드 타임에 한 번 생성된다. 렌더러(satori)는 시스템 폰트를
 * 못 쓰므로 한글 폰트를 구글 폰트에서 받아온다 — `text=` 파라미터로 쓰이는 글자만
 * 서브셋해서 몇 KB 로 줄인다.
 */

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "하루 늦은 모의주식 — 1억으로 시작하는 모의투자 게임";

const TITLE = "하루 늦은 모의주식";
const SUBTITLE = "어제 종가로 고르고, 내일 종가에 체결";
const TAGS = ["1억으로 시작", "매일 결과 개봉", "KOSPI 실제 시세"];

/** 구글 폰트에서 한글 서브셋(TTF) 받기 — 실패하면 null (라틴 폴백 렌더) */
async function loadNotoSansKr(text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch(
        `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700&text=${encodeURIComponent(text)}`,
      )
    ).text();
    const url = css.match(/src:\s*url\((.+?)\)\s*format\(['"]?(?:opentype|truetype)['"]?\)/)?.[1];
    if (!url) return null;
    return await (await fetch(url)).arrayBuffer();
  } catch {
    return null;
  }
}

/** 배경 하단의 캔들 실루엣 — [높이, 상승 여부] (결정적 목록, 실제 데이터 아님) */
const CANDLES: Array<[number, boolean]> = [
  [120, true], [180, true], [95, false], [220, true], [150, false],
  [260, true], [110, false], [190, true], [240, true], [140, false],
  [205, true], [170, false], [235, true], [100, false], [215, true],
  [160, false], [255, true], [130, false], [185, true], [245, true],
];

export default async function OpengraphImage() {
  const fontData = await loadNotoSansKr(TITLE + SUBTITLE + TAGS.join(""));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: "linear-gradient(135deg, #09090b 0%, #1e1b4b 100%)",
          fontFamily: "NotoSansKR",
          position: "relative",
        }}
      >
        {/* 하단 캔들 실루엣 */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            padding: "0 40px",
            opacity: 0.35,
          }}
        >
          {CANDLES.map(([height, up], i) => (
            <div
              key={i}
              style={{
                width: 30,
                height,
                borderRadius: 6,
                background: up ? "#f43f5e" : "#3b82f6",
              }}
            />
          ))}
        </div>

        <div style={{ display: "flex", fontSize: 96 }}>🐢</div>
        <div
          style={{
            display: "flex",
            marginTop: 24,
            fontSize: 88,
            fontWeight: 700,
            color: "#fafafa",
            letterSpacing: -2,
          }}
        >
          {TITLE}
        </div>
        <div style={{ display: "flex", marginTop: 16, fontSize: 36, color: "#a1a1aa" }}>
          {SUBTITLE}
        </div>
        <div style={{ display: "flex", marginTop: 44, gap: 16 }}>
          {TAGS.map((tag) => (
            <div
              key={tag}
              style={{
                display: "flex",
                padding: "12px 26px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.25)",
                background: "rgba(24,24,27,0.85)",
                color: "#e4e4e7",
                fontSize: 27,
              }}
            >
              {tag}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
      emoji: "twemoji",
      fonts: fontData
        ? [{ name: "NotoSansKR", data: fontData, weight: 700, style: "normal" }]
        : undefined,
    },
  );
}
