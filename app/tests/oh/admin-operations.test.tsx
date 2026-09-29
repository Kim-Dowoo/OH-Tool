// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { AdminWorkspace } from "@/components/admin-workspace";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

it("provides all five administrator operations", () => {
  render(<AdminWorkspace pendingProfiles={[]} requests={[]} inventory={[]} allocations={[]} />);
  expect(screen.getAllByRole("button", { name: /가입 승인|요청 관리|SN 재고|OH 배정|출고 관리/ }).map((button) => button.textContent)).toEqual([
    "가입 승인", "요청 관리", "SN 재고", "OH 배정", "출고 관리",
  ]);
});
