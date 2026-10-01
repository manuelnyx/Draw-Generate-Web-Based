"use client";

import { useEffect, useState } from "react";
import { db, Event as AppEvent } from "@/lib/db";
import { useAppStore } from "@/lib/store";
import { Plus, Trash2, CheckCircle2, ChevronRight, Settings2 } from "lucide-react";

export default function EventsPage() {
    const { activeEventId, setActiveEventId } = useAppStore();
    const [events, setEvents] = useState<AppEvent[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [newEventName, setNewEventName] = useState("");

    useEffect(() => {
        loadEvents();
    }, []);

    async function loadEvents() {
        const data = await db.events.orderBy("createdAt").reverse().toArray();
        setEvents(data);
    }

    async function handleCreateEvent(e: React.FormEvent) {
        e.preventDefault();
        if (!newEventName.trim()) return;

        const newEvent: AppEvent = {
            id: crypto.randomUUID(),
            name: newEventName,
            theme: "dark",
            settings: {
                preventPreviousWinners: true,
                animationDuration: 5,
                soundEnabled: true,
                operatorLock: false
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        await db.events.add(newEvent);
        setNewEventName("");
        setIsCreating(false);

        // Automatically set as active if it's the first event
        if (events.length === 0) {
            setActiveEventId(newEvent.id);
        }

        loadEvents();
    }

    async function handleDelete(id: string, name: string) {
        if (confirm(`Are you sure you want to delete the event: ${name}?\n\nThis will NOT delete the related participants and prizes yet in this version, but it is destructive.`)) {
            await db.events.delete(id);
            if (activeEventId === id) setActiveEventId(null);
            loadEvents();
        }
    }

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Event Management</h1>
                    <p className="text-slate-500 mt-1">Create and select events to manage</p>
                </div>
                <button
                    onClick={() => setIsCreating(true)}
                    className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:bg-indigo-700 transition shadow-sm"
                >
                    <Plus size={20} />
                    Create Event
                </button>
            </div>

            {isCreating && (
                <form onSubmit={handleCreateEvent} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-8 flex gap-4">
                    <input
                        type="text"
                        autoFocus
                        placeholder="E.g., HGC 46th Series Tournament"
                        value={newEventName}
                        onChange={(e) => setNewEventName(e.target.value)}
                        className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
                    />
                    <button type="submit" className="bg-emerald-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-emerald-600 transition shadow-sm">
                        Save Event
                    </button>
                    <button type="button" onClick={() => setIsCreating(false)} className="bg-slate-100 text-slate-600 px-6 py-3 rounded-xl font-medium hover:bg-slate-200 transition">
                        Cancel
                    </button>
                </form>
            )}

            <div className="grid grid-cols-1 gap-4">
                {events.length === 0 && !isCreating && (
                    <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center text-slate-500">
                        <Calendar size={48} className="mx-auto mb-4 text-slate-300" />
                        <h3 className="text-xl font-medium text-slate-700 mb-2">No Events Found</h3>
                        <p>Create your first event to get started with the lucky draw.</p>
                    </div>
                )}

                {events.map(event => {
                    const isActive = activeEventId === event.id;
                    return (
                        <div key={event.id} className={`bg-white rounded-2xl border transition-all duration-200 p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between ${isActive ? 'border-indigo-500 shadow-md ring-1 ring-indigo-500' : 'border-slate-200 shadow-sm hover:border-slate-300'}`}>
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                    <h3 className="text-xl font-bold text-slate-800">{event.name}</h3>
                                    {isActive && <span className="bg-indigo-100 text-indigo-700 text-xs px-2.5 py-1 rounded-full font-bold tracking-wider">ACTIVE EVENT</span>}
                                </div>
                                <div className="text-sm text-slate-500 flex items-center gap-4">
                                    <span>Created: {new Date(event.createdAt).toLocaleDateString()}</span>
                                    <span>Previous Winners: {event.settings.preventPreviousWinners ? "Excluded globally" : "Allowed for other prizes"}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {!isActive ? (
                                    <button
                                        onClick={() => setActiveEventId(event.id)}
                                        className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 rounded-lg font-medium transition"
                                    >
                                        Select Event <ChevronRight size={16} />
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg font-medium">
                                        <CheckCircle2 size={18} /> Selected
                                    </div>
                                )}

                                <button title="Settings (Coming Soon)" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition">
                                    <Settings2 size={20} />
                                </button>

                                <button
                                    onClick={() => handleDelete(event.id, event.name)}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                >
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// Mock icon fallback for empty state above
function Calendar(props: any) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>;
}
