import { useHub } from "@/contexts/hub-context";

/**
 * Returns true if the current user can perform write operations in the hub.
 * view_only users return false; default and admin users return true.
 */
export function useCanInteract(): boolean {
  const { role, isLoading } = useHub();
  if (isLoading) return false;
  return role !== "view_only";
}
