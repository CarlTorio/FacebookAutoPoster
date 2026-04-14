"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ApiKeyService } from "@/lib/db/types";

type ExistingKey = {
  service: ApiKeyService;
  last_test_ok: boolean | null;
  last_test_message: string | null;
  last_tested_at: string | null;
};

type ServiceSpec = {
  service: ApiKeyService;
  label: string;
  fields: {
    key: string;
    label: string;
    type?: "text" | "password";
    placeholder?: string;
  }[];
};

const SERVICES: ServiceSpec[] = [
  {
    service: "claude",
    label: "Claude (Anthropic)",
    fields: [
      { key: "api_key", label: "API key", type: "password", placeholder: "sk-ant-..." },
    ],
  },
  {
    service: "gemini",
    label: "Gemini (Google)",
    fields: [
      { key: "api_key", label: "API key", type: "password", placeholder: "AIza..." },
    ],
  },
  {
    service: "facebook",
    label: "Facebook",
    fields: [
      { key: "app_id", label: "App ID" },
      { key: "app_secret", label: "App secret", type: "password" },
      { key: "page_id", label: "Page ID" },
      { key: "page_access_token", label: "Page access token", type: "password" },
    ],
  },
  {
    service: "telegram",
    label: "Telegram",
    fields: [
      { key: "bot_token", label: "Bot token", type: "password" },
      { key: "chat_id", label: "Chat ID" },
    ],
  },
];

function StatusBadge({ existing }: { existing?: ExistingKey }) {
  if (!existing) return <Badge variant="outline">Not configured</Badge>;
  if (existing.last_test_ok === true)
    return <Badge className="bg-green-100 text-green-800 border-green-200">Connected</Badge>;
  if (existing.last_test_ok === false)
    return <Badge className="bg-red-100 text-red-800 border-red-200">Error</Badge>;
  return <Badge variant="outline">Saved (untested)</Badge>;
}

function ServiceCard({ spec, existing }: { spec: ServiceSpec; existing?: ExistingKey }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [testing, startTesting] = useTransition();
  const [saving, startSaving] = useTransition();

  const updateField = (key: string, v: string) =>
    setValues((p) => ({ ...p, [key]: v }));

  const post = async (url: string) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ service: spec.service, credentials: values }),
    });
    return res;
  };

  const onTest = () => {
    startTesting(async () => {
      const res = await post("/api/test-connection");
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Test failed");
        return;
      }
      if (data.ok) toast.success(data.message);
      else toast.error(data.message);
    });
  };

  const onSave = () => {
    startSaving(async () => {
      const res = await post("/api/api-keys");
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Save failed");
        return;
      }
      if (data.test?.ok) toast.success(`${spec.label} saved & connected`);
      else toast.warning(`Saved, but test failed: ${data.test?.message ?? "unknown"}`);
      // Reload so the server component picks up the new status.
      setTimeout(() => window.location.reload(), 400);
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{spec.label}</CardTitle>
        <StatusBadge existing={existing} />
      </CardHeader>
      <CardContent className="space-y-4">
        {spec.fields.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label htmlFor={`${spec.service}-${f.key}`}>{f.label}</Label>
            <Input
              id={`${spec.service}-${f.key}`}
              type={f.type === "password" ? "password" : "text"}
              placeholder={f.placeholder}
              value={values[f.key] ?? ""}
              onChange={(e) => updateField(f.key, e.target.value)}
              autoComplete="off"
            />
          </div>
        ))}

        {existing?.last_test_message ? (
          <p className="text-xs text-muted-foreground">
            Last test: {existing.last_test_message}
          </p>
        ) : null}

        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            onClick={onTest}
            disabled={testing || saving}
          >
            {testing ? "Testing…" : "Test connection"}
          </Button>
          <Button onClick={onSave} disabled={testing || saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function SettingsForm({ existing }: { existing: ExistingKey[] }) {
  const byService = new Map(existing.map((e) => [e.service, e]));
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {SERVICES.map((spec) => (
        <ServiceCard
          key={spec.service}
          spec={spec}
          existing={byService.get(spec.service)}
        />
      ))}
    </div>
  );
}
