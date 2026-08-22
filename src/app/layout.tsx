import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AchievementChecker from "@/components/AchievementChecker";
import SiteHeader from "@/components/SiteHeader";
import TabBar from "@/components/TabBar";
import VersionBadge from "@/components/VersionBadge";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // OG 이미지 등 상대 경로 메타데이터를 절대 URL 로 만들어 주는 기준점
  metadataBase: new URL("https://rokstock-01.vercel.app"),
  title: "RokStock — 하루 늦은 모의주식",
  description: "하루 늦게 갱신되는 공공데이터 종가로, 보이는 즉시 사고파는 모의투자 게임",
  openGraph: {
    title: "하루 늦은 모의주식",
    description: "1억으로 시작! 하루 늦게 갱신되는 최신 종가로 바로 체결되는 모의투자 게임 🐢",
    type: "website",
    siteName: "RokStock",
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* pb-20: 하단 고정 탭바(TabBar)에 콘텐츠·footer 가 가려지지 않도록. 데스크톱(lg)은 탭바가 없어 해제 */}
      <body className="min-h-full flex flex-col pb-20 lg:pb-0">
        <SiteHeader />
        {children}
        <footer className="flex items-center justify-center py-3">
          <VersionBadge />
        </footer>
        <TabBar />
        <AchievementChecker />
      </body>
    </html>
  );
}
