import type { MetadataRoute } from "next";

/**
 * PWA 매니페스트 — "홈 화면에 추가/앱 설치" 때 쓰이는 이름·아이콘.
 * 설치 다이얼로그에는 name 이, 홈 화면 아이콘 밑에는 short_name 이 붙는다
 * (짧아야 잘리지 않는다 — 한글 기준 4~6자 권장).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "하루 늦은 모의주식",
    short_name: "하루주식",
    description: "하루 늦게 갱신되는 종가로, 보이는 즉시 사고파는 모의투자 게임",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
