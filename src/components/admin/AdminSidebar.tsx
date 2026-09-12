"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Calendar, Users, Gift, PlaySquare, History, Settings, Lock, Unlock } from "lucide-react";
import { useAppStore } from "@/lib/store";

const menuItems = [
    { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { name: "Events", href: "/admin/events", icon: Calendar },
    { name: "Participants", href: "/admin/participants", icon: Users },
    { name: "Prizes", href: "/admin/prizes", icon: Gift },
    { name: "Draw Control", href: "/admin/draw", icon: PlaySquare },
    { name: "History", href: "/admin/history", icon: History },
    { name: "Settings", href: "/admin/settings", icon: Settings },
];

export function AdminSidebar() {
    const pathname = usePathname();
    const { operatorLock, setOperatorLock } = useAppStore();

    return (
        <div className="w-64 h-screen bg-slate-900 text-white flex flex-col">
            <div className="p-6">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
                    Lucky Draw
                </h1>
                <p className="text-xs text-slate-400 mt-1">Engine Workspace</p>
            </div>

            <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive
                                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/50"
                                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                                }`}
                        >
                            <Icon size={20} />
                            <span className="font-medium text-sm">{item.name}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-slate-800">
                <button
                    onClick={() => setOperatorLock(!operatorLock)}
                    className={`flex items-center gap-3 w-full px-4 py-3 border rounded-xl transition-colors font-medium text-sm ${operatorLock
                            ? "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                            : "border-slate-700 text-slate-400 hover:bg-slate-800"
                        }`}
                >
                    {operatorLock ? <Lock size={20} /> : <Unlock size={20} />}
                    <span>{operatorLock ? "Operator Locked" : "Operator Unlocked"}</span>
                </button>
            </div>
        </div>
    );
}
