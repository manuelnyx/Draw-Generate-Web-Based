"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { db } from "@/lib/db";
import { Users, Gift, Ticket, Target, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function AdminDashboard() {
    const { activeEventId } = useAppStore();
    const [stats, setStats] = useState({
        participants: 0,
        eligible: 0,
        prizes: 0,
        totalDraws: 0,
        eventName: "No Event Selected"
    });

    useEffect(() => {
        async function loadStats() {
            if (!activeEventId) return;

            try {
                const event = await db.events.get(activeEventId);
                const participants = await db.participants.where({ eventId: activeEventId }).count();
                const prizes = await db.prizes.where({ eventId: activeEventId }).count();
                const draws = await db.drawSessions.where({ eventId: activeEventId }).count();

                // For dashboard quick view, eligible is roughly participants minus confirmed winners globally (if preventPreviousWinners is true)
                let eligible = participants;
                const results = await db.drawResults.where({ verificationStatus: 'CONFIRMED_WINNER' }).toArray();
                const eventSessions = await db.drawSessions.where({ eventId: activeEventId }).toArray();
                const eventSessionIds = new Set(eventSessions.map(s => s.id));
                const confirmedInEvent = results.filter(r => eventSessionIds.has(r.drawSessionId)).length;

                if (event?.settings.preventPreviousWinners) {
                    eligible = Math.max(0, participants - confirmedInEvent);
                }

                setStats({
                    participants,
                    eligible,
                    prizes,
                    totalDraws: draws,
                    eventName: event?.name || "Unknown Event"
                });
            } catch (err) {
                console.error("Failed to load stats", err);
            }
        }
        loadStats();
    }, [activeEventId]);

    if (!activeEventId) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-50">
                <AlertCircle size={48} className="text-slate-400 mb-4" />
                <h2 className="text-2xl font-bold text-slate-700 mb-2">No Active Event Selected</h2>
                <p className="text-slate-500 mb-6 max-w-md">
                    You need to select or create an event before you can manage participants, prizes, and draws.
                </p>
                <Link
                    href="/admin/events"
                    className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium shadow-lg hover:bg-indigo-700 transition"
                >
                    Go to Event Management
                </Link>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <header className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
                    <p className="text-slate-500 mt-1">Current Event: <strong className="text-indigo-600 uppercase">{stats.eventName}</strong></p>
                </div>
                <Link
                    href={`/draw/${activeEventId}`}
                    target="_blank"
                    className="px-6 py-3 bg-slate-900 text-white rounded-xl font-medium shadow-md hover:bg-slate-800 transition flex items-center gap-2"
                >
                    <Target size={18} />
                    Launch Public Screen
                </Link>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Total Participants" value={stats.participants} icon={Users} color="bg-blue-500" />
                <StatCard title="Eligible Pool" value={stats.eligible} icon={Ticket} color="bg-emerald-500" />
                <StatCard title="Total Prizes" value={stats.prizes} icon={Gift} color="bg-purple-500" />
                <StatCard title="Draw Sessions" value={stats.totalDraws} icon={History} color="bg-amber-500" />
            </div>

        </div>
    );
}

function StatCard({ title, value, icon: Icon, color }: { title: string, value: number, icon: any, color: string }) {
    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
            <div className={`${color} p-4 rounded-2xl text-white shadow-lg relative z-10`}>
                <Icon size={24} />
            </div>
            <div className="relative z-10">
                <p className="text-sm font-medium text-slate-500">{title}</p>
                <h3 className="text-3xl font-bold text-slate-800">{value.toLocaleString()}</h3>
            </div>
        </div>
    );
}
