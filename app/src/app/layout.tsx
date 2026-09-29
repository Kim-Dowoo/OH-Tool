import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DemoBanner } from "@/components/demo-banner";
import { assertSafeRuntime, getRuntimeMode } from "@/lib/config/runtime-mode";
import "./globals.css";

export const metadata: Metadata = {
  title: "OH 관리 | 운영 현황",
  description: "OH 요청, 배정, 출고 및 재고 현황",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  assertSafeRuntime();
  return <html lang="ko"><body>{getRuntimeMode() === "demo" && <DemoBanner />}{children}</body></html>;
}
