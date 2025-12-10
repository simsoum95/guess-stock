import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <AdminSidebar />
      <main className="lg:mr-64 min-h-screen">
        {children}
      </main>
    </div>
  );
}
