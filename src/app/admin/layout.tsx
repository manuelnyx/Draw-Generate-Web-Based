"use client";

import { useState, useEffect } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return <div className="h-screen w-full bg-slate-50 flex items-center justify-center text-slate-400">Loading App Engine...</div>;

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
            <AdminSidebar />
            <main className="flex-1 h-full overflow-y-auto w-full relative">
                {children}
            </main>
        </div>
    );
}
