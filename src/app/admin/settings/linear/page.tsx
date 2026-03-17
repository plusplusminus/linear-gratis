import { TokenConnectionForm } from "@/components/admin/token-connection-form";
import { OAuthConnectionForm } from "@/components/admin/oauth-connection-form";

export default function LinearSettingsPage() {
  return (
    <div className="p-6 space-y-10">
      <TokenConnectionForm />
      <div className="border-t border-border" />
      <OAuthConnectionForm />
    </div>
  );
}
