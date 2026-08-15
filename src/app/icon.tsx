import { ImageResponse } from "next/og";

/**
 * 앱 아이콘 (512×512 PNG) — 파비콘·PWA 설치 아이콘으로 쓰인다.
 * maskable(안드로이드가 원/스쿼클로 잘라내는 형식)을 겸하므로
 * 내용물(거북이)을 중앙 안전 영역(약 60%) 안에 둔다.
 */

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #18181b 0%, #312e81 100%)",
          fontSize: 280,
        }}
      >
        {/* twemoji 글리프가 베이스라인 때문에 좌하단으로 처져서 살짝 끌어올린다 */}
        <div style={{ display: "flex", marginTop: -50, marginLeft: 20 }}>🐢</div>
      </div>
    ),
    { ...size, emoji: "twemoji" },
  );
}
