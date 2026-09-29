import { assertSafeRuntime, getRuntimeMode } from "@/lib/config/runtime-mode";

export const DEMO_MUTATION_ERROR = "데모에서는 변경할 수 없습니다.";

/** Call first in each future mutation handler, before parsing JSON/formData or opening storage. */
export function getMutationDenial(): Response | null {
  assertSafeRuntime();
  return getRuntimeMode() === "demo"
    ? Response.json({ error: DEMO_MUTATION_ERROR }, { status: 403 })
    : null;
}
