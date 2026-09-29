import { parseEmployeeId, toAuthAlias } from "@/lib/auth/employee-id";

export type EmployeeAuthInput = { employeeId: string; password: string };

export function buildEmployeeAuthInput(input: EmployeeAuthInput) {
  const employeeId = parseEmployeeId(input.employeeId);
  const password = input.password.trim();
  if (!employeeId || password.length < 8) return null;

  return {
    email: toAuthAlias(employeeId),
    password,
    options: { data: { employee_id: employeeId } },
  };
}
