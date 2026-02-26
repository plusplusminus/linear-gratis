"use client";

import { useState, useEffect, useCallback } from "react";

export interface AdminHub {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  workos_org_id: string | null;
  team_count: number;
  member_count: number;
  created_at: string;
}

let cachedHubs: AdminHub[] | null = null;
const listeners: Set<() => void> = new Set();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

export function useAdminHubs() {
  const [hubs, setHubs] = useState<AdminHub[]>(cachedHubs ?? []);
  const [loading, setLoading] = useState(cachedHubs === null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/hubs");
      if (!res.ok) throw new Error("Failed to fetch hubs");
      const data: AdminHub[] = await res.json();
      cachedHubs = data;
      setHubs(data);
      setError(null);
      notifyListeners();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const listener = () => {
      if (cachedHubs) setHubs(cachedHubs);
    };
    listeners.add(listener);

    if (cachedHubs === null) {
      refresh();
    }

    return () => {
      listeners.delete(listener);
    };
  }, [refresh]);

  return { hubs, loading, error, refresh };
}
