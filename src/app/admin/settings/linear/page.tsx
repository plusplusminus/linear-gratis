import { Suspense } from "react";
import { TokenConnectionForm } from "@/components/admin/token-connection-form";
import { OAuthConnectionForm } from "@/components/admin/oauth-connection-form";

export default function LinearSettingsPage() {
  return (
    <div className="p-6 space-y-10">
      <TokenConnectionForm />
      <div className="border-t border-border" />
      <Suspense fallback={
        <div className="max-w-lg">
          <h2 className="text-lg font-semibold mb-4">Comment Attribution</h2>
          <div className="h-32 rounded-lg bg-muted/50 animate-pulse" />
        </div>
      }>
        <OAuthConnectionForm />
      </Suspense>
    </div>
  );
}
