import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AutoLogout } from "@/components/admin/AutoLogout";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <AutoLogout />
      <AdminSidebar />
      <main className="lg:mr-64 min-h-screen">
        {children}
      </main>
    </div>
  );
}
