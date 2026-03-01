import { SyncHealthDashboard } from "@/components/admin/sync-health-dashboard";

export default function SyncMonitorPage() {
  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Sync Monitor</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor webhook events, sync runs, and system health
        </p>
      </div>
      <SyncHealthDashboard />
    </div>
  );
}
