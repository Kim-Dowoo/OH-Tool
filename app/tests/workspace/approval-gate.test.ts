import { expect, it } from "vitest";
import { getWorkspaceDestination } from "@/lib/auth/workspace-gate";

it("sends unauthenticated and inactive users away from workspace data", () => {
  expect(getWorkspaceDestination(null)).toBe("/login");
  expect(getWorkspaceDestination({ role: "USER", status: "PENDING" })).toBe("/pending");
  expect(getWorkspaceDestination({ role: "USER", status: "SUSPENDED" })).toBe("/pending");
});

it("routes only active profiles to their workspace", () => {
  expect(getWorkspaceDestination({ role: "USER", status: "ACTIVE" })).toBe("/user");
  expect(getWorkspaceDestination({ role: "ADMIN", status: "ACTIVE" })).toBe("/admin");
});
