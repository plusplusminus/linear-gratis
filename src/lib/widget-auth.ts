import { supabaseAdmin } from "@/lib/supabase";
import type { WidgetConfig } from "@/lib/widget-types";

export function generateWidgetApiKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `wk_${hex}`;
}

export async function hashWidgetApiKey(apiKey: string): Promise<string> {
  const encoded = new TextEncoder().encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function validateWidgetKey(
  apiKey: string
): Promise<WidgetConfig | null> {
  const hash = await hashWidgetApiKey(apiKey);

  const { data, error } = await supabaseAdmin
    .from("widget_configs")
    .select("*")
    .eq("api_key_hash", hash)
    .single();

  if (error || !data) return null;
  if (!data.is_active) return null;

  return data as WidgetConfig;
}

export async function validateWidgetRequest(
  request: Request
): Promise<{ config: WidgetConfig } | { error: string; status: number }> {
  const apiKey = request.headers.get("x-widget-key");
  if (!apiKey) {
    return { error: "Missing X-Widget-Key header", status: 401 };
  }

  const config = await validateWidgetKey(apiKey);
  if (!config) {
    return { error: "Invalid or inactive widget key", status: 401 };
  }

  if (config.allowed_origins.length > 0) {
    const origin = request.headers.get("origin");
    if (!origin || !config.allowed_origins.includes(origin)) {
      return { error: "Origin not allowed", status: 403 };
    }
  }

  return { config };
}
