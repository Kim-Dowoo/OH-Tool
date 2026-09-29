import { expect, it } from "vitest";
import { parseEmployeeId, toAuthAlias } from "@/lib/auth/employee-id";
import { getSupabasePublicConfig } from "@/lib/config/supabase";

it("accepts a ten-digit employee ID and converts it to a private auth alias", () => {
  expect(parseEmployeeId("1234567890")).toBe("1234567890");
  expect(parseEmployeeId("123456789")).toBeNull();
  expect(parseEmployeeId("12345678901")).toBeNull();
  expect(parseEmployeeId("1234-567890")).toBeNull();
  expect(toAuthAlias("1234567890")).toBe("1234567890@auth.oh-tool.invalid");
});

it("requires a valid public Supabase URL and publishable key", () => {
  expect(() => getSupabasePublicConfig({})).toThrow("Supabase public configuration is required");
  expect(() => getSupabasePublicConfig({
    NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
  })).toThrow("Supabase public configuration is invalid");
  expect(getSupabasePublicConfig({
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
  })).toEqual({ url: "https://project.supabase.co", publishableKey: "sb_publishable_example" });
});
