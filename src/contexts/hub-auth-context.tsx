"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { HubMemberRole } from "@/lib/supabase";

type HubAuthState = {
  hubId: string;
  hubName: string | null;
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: HubMemberRole;
  isViewOnly: boolean;
  isLoading: boolean;
};

const HubAuthContext = createContext<HubAuthState | null>(null);

export function HubAuthProvider({
  hubId,
  children,
}: {
  hubId: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<HubAuthState>({
    hubId,
    hubName: null,
    userId: "",
    email: "",
    firstName: null,
    lastName: null,
    role: "default",
    isViewOnly: false,
    isLoading: true,
  });

  useEffect(() => {
    async function fetchMe() {
      try {
        const res = await fetch(`/api/hubs/${hubId}/me`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          hubName: string | null;
          userId: string;
          email: string;
          firstName: string | null;
          lastName: string | null;
          role: HubMemberRole;
          isViewOnly: boolean;
        };
        setState({
          hubId,
          hubName: data.hubName,
          userId: data.userId,
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
          isViewOnly: data.isViewOnly,
          isLoading: false,
        });
      } catch {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    }
    fetchMe();
  }, [hubId]);

  return (
    <HubAuthContext.Provider value={state}>{children}</HubAuthContext.Provider>
  );
}

export function useHubAuth(): HubAuthState {
  const ctx = useContext(HubAuthContext);
  if (!ctx) {
    throw new Error("useHubAuth must be used within a HubAuthProvider");
  }
  return ctx;
}
