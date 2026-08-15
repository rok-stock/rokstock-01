import { ImageResponse } from "next/og";

/** iOS 홈 화면 아이콘 (180×180) — icon.tsx 와 같은 디자인 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          fontSize: 100,
        }}
      >
        🐢
      </div>
    ),
    { ...size, emoji: "twemoji" },
  );
}
