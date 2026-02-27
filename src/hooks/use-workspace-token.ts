import { useState, useEffect, useCallback } from "react";

type WorkspaceTokenState = {
  token: string | null;
  configured: boolean;
  loading: boolean;
};

/**
 * Fetches the workspace Linear API token for authenticated users.
 * Replaces the old pattern of querying profiles.linear_api_token directly.
 */
export function useWorkspaceToken() {
  const [state, setState] = useState<WorkspaceTokenState>({
    token: null,
    configured: false,
    loading: true,
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/workspace/token");
      if (!res.ok) {
        setState({ token: null, configured: false, loading: false });
        return;
      }
      const data = (await res.json()) as {
        configured: boolean;
        token: string | null;
      };
      setState({
        token: data.token,
        configured: data.configured,
        loading: false,
      });
    } catch {
      setState({ token: null, configured: false, loading: false });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return state;
}
