"use client";

import { useEffect } from "react";

/**
 * 열려 있는 시트/모달을 Esc 키로 닫는 훅 — 데스크톱 키보드 UX 용.
 * active 가 true 인 동안에만 keydown 을 구독한다.
 */
export function useEscapeClose(active: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, onClose]);
}
