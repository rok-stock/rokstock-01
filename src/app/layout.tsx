import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import GameSettlement from "@/components/GameSettlement";
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
  title: "RokStock — 하루 늦은 모의주식",
  description: "어제 종가로 고르고 내일 종가에 체결되는, 공공데이터 기반 모의투자 게임",
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
        <GameSettlement />
      </body>
    </html>
  );
}
