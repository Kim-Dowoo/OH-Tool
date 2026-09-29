const employeeIdPattern = /^\d{10}$/;

export function parseEmployeeId(value: string): string | null {
  const employeeId = value.trim();
  return employeeIdPattern.test(employeeId) ? employeeId : null;
}

export function toAuthAlias(employeeId: string): string {
  return `${employeeId}@auth.oh-tool.invalid`;
}
