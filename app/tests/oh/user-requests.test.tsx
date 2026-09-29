// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { UserWorkspace } from "@/components/user-workspace";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

it("shows the user tabs in the required order", () => {
  render(<UserWorkspace initialRequests={[]} initialAllocations={[]} initialShipments={[]} />);
  expect(screen.getAllByRole("button", { name: /OH 등록|OH 요청 현황|배정 및 출고 현황/ }).map((button) => button.textContent)).toEqual([
    "OH 등록", "OH 요청 현황", "배정 및 출고 현황",
  ]);
});
