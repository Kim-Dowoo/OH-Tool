// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import Home from "@/app/page";
import RootLayout from "@/app/layout";

// The static page must not even reference the selector's local-storage dependency graph.
vi.mock("@/lib/repositories/get-repository", () => { throw new Error("Static dashboard imported the local-capable selector"); });

afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

it("renders the demo warning and repository-backed overview without mutation controls", async () => {
  vi.stubEnv("APP_MODE", "demo");
  render(RootLayout({ children: await Home() }), { container: document });
  expect(screen.getByText("DEMO — 실제 데이터를 입력하지 마세요")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "OH 운영 현황" })).toBeTruthy();
  const summary = screen.getByRole("region", { name: "운영 요약" });
  for (const text of ["요청 수량", "배정 수량", "출고 수량", "확정 매출", "42", "28", "18", "27,000,000"])
    expect(within(summary).getByText(text)).toBeTruthy();
  expect(screen.getByRole("table", { name: "기종별 재고" })).toBeTruthy();
  expect(screen.getByRole("table", { name: "파트너별 현황" })).toBeTruthy();
  expect(screen.getByRole("table", { name: "팀별 현황" })).toBeTruthy();
  expect(screen.getByText("가상 파트너 · 새봄")).toBeTruthy();
  expect(screen.getByText("DEMO-100")).toBeTruthy();
  expect(document.querySelector('input, form, button, a[download], a[href*="export"], a[href*="import"]')).toBeNull();
});

it("keeps local mode as a small placeholder without demo data", async () => {
  vi.stubEnv("APP_MODE", "local");
  vi.stubEnv("VERCEL", "");
  render(await Home());
  expect(screen.getByRole("heading", { name: "OH 관리 · 로컬 모드" })).toBeTruthy();
  expect(screen.queryByText("DEMO-100")).toBeNull();
});
