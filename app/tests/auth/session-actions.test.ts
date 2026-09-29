import { expect, it } from "vitest";
import { buildEmployeeAuthInput } from "@/lib/auth/employee-auth-input";

it("uses a derived internal alias and employee-id metadata for signup", () => {
  expect(buildEmployeeAuthInput({ employeeId: "1234567890", password: "password-123" })).toEqual({
    email: "1234567890@auth.oh-tool.invalid",
    password: "password-123",
    options: { data: { employee_id: "1234567890" } },
  });
});

it("rejects malformed employee IDs and short passwords before contacting Auth", () => {
  expect(buildEmployeeAuthInput({ employeeId: "123", password: "password-123" })).toBeNull();
  expect(buildEmployeeAuthInput({ employeeId: "1234567890", password: "short" })).toBeNull();
});
