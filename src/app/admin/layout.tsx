import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
            <AdminSidebar />
            <main className="flex-1 h-full overflow-y-auto w-full relative">
                {children}
            </main>
        </div>
    );
}
