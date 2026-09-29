export type WorkspaceProfile = {
  role: "USER" | "ADMIN";
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
};

export function getWorkspaceDestination(profile: WorkspaceProfile | null): "/login" | "/pending" | "/user" | "/admin" {
  if (!profile) return "/login";
  if (profile.status !== "ACTIVE") return "/pending";
  return profile.role === "ADMIN" ? "/admin" : "/user";
}
