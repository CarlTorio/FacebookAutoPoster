import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";
import type { ApiKeyRow } from "@/lib/db/types";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("api_keys")
    .select("service,last_test_ok,last_test_message,last_tested_at");

  const rows = (data ?? []) as Pick<
    ApiKeyRow,
    "service" | "last_test_ok" | "last_test_message" | "last_tested_at"
  >[];

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">API settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure and test connections to Claude, Gemini, Facebook, and Telegram.
        </p>
      </div>
      <SettingsForm existing={rows} />
    </div>
  );
}
