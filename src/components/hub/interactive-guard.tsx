"use client";

import { type ReactNode } from "react";
import { useCanInteract } from "@/hooks/use-can-interact";

/**
 * Hides children for view_only users.
 * Returns null (not disabled) — no teasing UI.
 */
export function InteractiveGuard({ children }: { children: ReactNode }) {
  const canInteract = useCanInteract();
  if (!canInteract) return null;
  return <>{children}</>;
}
