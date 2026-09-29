// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import Home from "@/app/page";
import RootLayout from "@/app/layout";

// The static page must not even reference the selector's local-storage dependency graph.
vi.mock("@/lib/repositories/get-repository", () => { throw new Error("Static dashboard imported the local-capable selector"); });

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it("requires a demo role and opens the full administrator workspace", async () => {
  vi.stubEnv("APP_MODE", "demo");
  render(RootLayout({ children: await Home() }), { container: document });
  expect(screen.getByText("DEMO — 요청은 이 브라우저에만 저장됩니다")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "데모 로그인" })).toBeTruthy();
  expect(screen.getByRole("button", { name: /^사용자 로그인/ })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "OH 운영 현황" })).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: /^관리자 로그인/ }));

  const navigation = screen.getByRole("navigation", { name: "관리 메뉴" });
  for (const name of ["대시보드", "OH 요청", "OH 배정", "재고", "출고 현황"])
    expect(within(navigation).getByRole("button", { name })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "OH 운영 현황" })).toBeTruthy();
  const summary = screen.getByRole("region", { name: "운영 요약" });
  for (const text of ["요청 수량", "배정 수량", "출고 수량", "확정 매출", "42", "28", "18", "27,000,000"])
    expect(within(summary).getByText(text)).toBeTruthy();
  expect(screen.getByRole("table", { name: "기종별 재고" })).toBeTruthy();
  expect(screen.getByRole("table", { name: "파트너별 현황" })).toBeTruthy();
  expect(screen.getByRole("table", { name: "팀별 현황" })).toBeTruthy();
  expect(within(screen.getByRole("table", { name: "파트너별 현황" })).getByText("가상 파트너 · 새봄")).toBeTruthy();
  expect(within(screen.getByRole("table", { name: "기종별 재고" })).getByText("DEMO-100")).toBeTruthy();
  expect(document.querySelector('input, form, a[download], a[href*="export"], a[href*="import"]')).toBeNull();
});

it("keeps local mode as a small placeholder without demo data", async () => {
  vi.stubEnv("APP_MODE", "local");
  vi.stubEnv("VERCEL", "");
  render(await Home());
  expect(screen.getByRole("heading", { name: "OH 관리 · 로컬 모드" })).toBeTruthy();
  expect(screen.queryByText("DEMO-100")).toBeNull();
});

it("limits the user workspace to its own synthetic requests and allocation results", async () => {
  vi.stubEnv("APP_MODE", "demo");
  render(RootLayout({ children: await Home() }), { container: document });

  fireEvent.click(screen.getByRole("button", { name: /^사용자 로그인/ }));

  const navigation = screen.getByRole("navigation", { name: "사용자 메뉴" });
  expect(within(navigation).getByRole("button", { name: "OH 요청" })).toBeTruthy();
  expect(within(navigation).getByRole("button", { name: "배정 결과" })).toBeTruthy();
  expect(within(navigation).queryByRole("button", { name: "대시보드" })).toBeNull();

  const requests = screen.getByRole("table", { name: "OH 요청 목록" });
  expect(within(requests).getByText("DEMO-P1")).toBeTruthy();
  expect(within(requests).queryByText("DEMO-P2")).toBeNull();

  fireEvent.click(within(navigation).getByRole("button", { name: "배정 결과" }));
  const allocations = screen.getByRole("table", { name: "내 배정 결과" });
  expect(within(allocations).getByText("DEMO-SN-1-001")).toBeTruthy();
  expect(within(allocations).queryByText("DEMO-SN-2-001")).toBeNull();
});

it("saves a user-entered OH request locally and exposes it to the administrator request list", async () => {
  vi.stubEnv("APP_MODE", "demo");
  render(RootLayout({ children: await Home() }), { container: document });
  fireEvent.click(screen.getByRole("button", { name: /^사용자 로그인/ }));

  const userNavigation = screen.getByRole("navigation", { name: "사용자 메뉴" });
  fireEvent.click(within(userNavigation).getByRole("button", { name: "OH기 요청 등록" }));
  fireEvent.change(screen.getByLabelText("요청 월도"), { target: { value: "2026-10" } });
  fireEvent.change(screen.getByLabelText("ITSS CODE"), { target: { value: "DIRECT-001" } });
  fireEvent.change(screen.getByLabelText("요청 기종"), { target: { value: "OH-DIRECT-100" } });
  fireEvent.change(screen.getByLabelText("요청 수량"), { target: { value: "3" } });
  fireEvent.change(screen.getByLabelText("요청 메모"), { target: { value: "신규 요청 테스트" } });
  fireEvent.submit(screen.getByRole("button", { name: "요청 저장" }).closest("form")!);

  expect(screen.getByText("요청을 저장했습니다.")).toBeTruthy();
  fireEvent.click(within(userNavigation).getByRole("button", { name: "OH 요청" }));
  expect(within(screen.getByRole("table", { name: "OH 요청 목록" })).getByText("DIRECT-001")).toBeTruthy();

  cleanup();
  render(RootLayout({ children: await Home() }), { container: document });
  fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
  fireEvent.click(screen.getByRole("button", { name: /^관리자 로그인/ }));
  fireEvent.click(within(screen.getByRole("navigation", { name: "관리 메뉴" })).getByRole("button", { name: "OH 요청" }));
  expect(within(screen.getByRole("table", { name: "OH 요청 목록" })).getByText("DIRECT-001")).toBeTruthy();
});

it("rejects an OH request with missing required values or a zero quantity", async () => {
  vi.stubEnv("APP_MODE", "demo");
  render(RootLayout({ children: await Home() }), { container: document });
  fireEvent.click(screen.getByRole("button", { name: /^사용자 로그인/ }));
  fireEvent.click(within(screen.getByRole("navigation", { name: "사용자 메뉴" })).getByRole("button", { name: "OH기 요청 등록" }));

  fireEvent.submit(screen.getByRole("button", { name: "요청 저장" }).closest("form")!);

  expect(screen.getByRole("alert").textContent).toContain("요청 월도, ITSS CODE, 요청 기종과 1대 이상의 수량을 입력하세요.");
  expect(window.localStorage.getItem("oh-demo-requests")).toBeNull();
});

it("switches administrator menus across every all-data view", async () => {
  vi.stubEnv("APP_MODE", "demo");
  render(RootLayout({ children: await Home() }), { container: document });
  fireEvent.click(screen.getByRole("button", { name: /^관리자 로그인/ }));
  const navigation = screen.getByRole("navigation", { name: "관리 메뉴" });

  fireEvent.click(within(navigation).getByRole("button", { name: "OH 요청" }));
  expect(screen.getByRole("heading", { name: "OH 요청", level: 1 })).toBeTruthy();
  expect(within(screen.getByRole("table", { name: "OH 요청 목록" })).getByText("DEMO-P6")).toBeTruthy();

  fireEvent.click(within(navigation).getByRole("button", { name: "OH 배정" }));
  const allocations = screen.getByRole("table", { name: "전체 배정 현황" });
  expect(within(allocations).getByText("DEMO-SN-1-001")).toBeTruthy();
  expect(within(allocations).getByText("DEMO-SN-6-001")).toBeTruthy();

  const inventoryButton = within(navigation).getByRole("button", { name: "재고" });
  fireEvent.click(inventoryButton);
  expect(inventoryButton.getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("heading", { name: "재고 현황" })).toBeTruthy();
  expect(within(screen.getByRole("table", { name: "기종별 재고" })).getByText("DEMO-300")).toBeTruthy();

  fireEvent.click(within(navigation).getByRole("button", { name: "출고 현황" }));
  const shipments = screen.getByRole("table", { name: "전체 출고 현황" });
  expect(within(shipments).getByText("DEMO-SN-1-001")).toBeTruthy();
  expect(within(shipments).getByText("DEMO-SN-6-001")).toBeTruthy();
});

it("stores the selected demo role in the browser and clears it on logout", async () => {
  vi.stubEnv("APP_MODE", "demo");
  render(RootLayout({ children: await Home() }), { container: document });
  fireEvent.click(screen.getByRole("button", { name: /^사용자 로그인/ }));
  expect(window.localStorage.getItem("oh-demo-role")).toBe("user");

  cleanup();
  render(RootLayout({ children: await Home() }), { container: document });
  expect(await screen.findByRole("navigation", { name: "사용자 메뉴" })).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
  expect(window.localStorage.getItem("oh-demo-role")).toBeNull();
  expect(screen.getByRole("heading", { name: "데모 로그인" })).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: /^관리자 로그인/ }));
  expect(screen.getByRole("navigation", { name: "관리 메뉴" })).toBeTruthy();
});

it("keeps the selected demo role usable when browser storage is unavailable", async () => {
  vi.stubEnv("APP_MODE", "demo");
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("storage blocked"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("storage blocked"); });
  render(RootLayout({ children: await Home() }), { container: document });

  fireEvent.click(screen.getByRole("button", { name: /^사용자 로그인/ }));

  expect(screen.getByRole("navigation", { name: "사용자 메뉴" })).toBeTruthy();
  expect(within(screen.getByRole("table", { name: "OH 요청 목록" })).getByText("DEMO-P1")).toBeTruthy();
});

it("shows request-sheet fields and opens the allocation detail from the requested quantity", async () => {
  vi.stubEnv("APP_MODE", "demo");
  render(RootLayout({ children: await Home() }), { container: document });
  fireEvent.click(screen.getByRole("button", { name: /^관리자 로그인/ }));
  fireEvent.click(within(screen.getByRole("navigation", { name: "관리 메뉴" })).getByRole("button", { name: "OH 요청" }));

  const requests = screen.getByRole("table", { name: "OH 요청 목록" });
  expect(within(requests).getByText("월도")).toBeTruthy();
  expect(within(requests).getByText("ITSS CODE")).toBeTruthy();
  expect(within(requests).getByText("요청 기종")).toBeTruthy();
  expect(within(requests).getByRole("button", { name: "12대 요청 상세 보기" })).toBeTruthy();

  fireEvent.click(within(requests).getByRole("button", { name: "12대 요청 상세 보기" }));
  expect(screen.getByRole("dialog", { name: "OH 요청 상세" })).toBeTruthy();
  expect(screen.getByText("DEMO-SN-1-001")).toBeTruthy();
  expect(within(screen.getByRole("dialog", { name: "OH 요청 상세" })).getAllByText("가상 보관소").length).toBeGreaterThan(0);
});
