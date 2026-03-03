import { withAuth } from "@workos-inc/authkit-nextjs";
import { AdminPanel } from "@/components/admin/settings/admin-panel";

export default async function AdminSettingsAdminsPage() {
  const { user } = await withAuth();

  return (
    <div className="p-6">
      <AdminPanel currentUserEmail={user?.email ?? ""} />
    </div>
  );
}
