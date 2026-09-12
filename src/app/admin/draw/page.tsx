"use client";

import { useState, useEffect } from "react";
import { db, Prize, Event } from "@/lib/db";
import { useAppStore } from "@/lib/store";
import { Target, AlertTriangle, MonitorPlay, Activity, Gift } from "lucide-react";
import Link from "next/link";

export default function DrawControlPage() {
    const { activeEventId } = useAppStore();
    const [event, setEvent] = useState<Event | null>(null);
    const [prizes, setPrizes] = useState<Prize[]>([]);
    const [selectedPrizeId, setSelectedPrizeId] = useState<string>("");

    const [eligibleCount, setEligibleCount] = useState(0);
    const [confirmedCount, setConfirmedCount] = useState(0);
    const [remainingCount, setRemainingCount] = useState(0);
    const [isVerificationPending, setIsVerificationPending] = useState(false);

    useEffect(() => {
        if (activeEventId) {
            loadInitialData();
        }
    }, [activeEventId]);

    useEffect(() => {
        if (selectedPrizeId) {
            updatePrizeStats(selectedPrizeId);
        }
    }, [selectedPrizeId]);

    async function loadInitialData() {
        if (!activeEventId) return;
        const evt = await db.events.get(activeEventId);
        if (evt) setEvent(evt);

        const przs = await db.prizes.where({ eventId: activeEventId }).sortBy("order");
        setPrizes(przs);
        if (przs.length > 0) {
            setSelectedPrizeId(przs[0].id);
        }
    }

    async function updatePrizeStats(prizeId: string) {
        if (!activeEventId) return;

        // Fast check for pending verification state
        const activeSessions = await db.drawSessions
            .where({ prizeId })
            .filter(s => ['VERIFICATION', 'ROLLING', 'REVEALING'].includes(s.status))
            .toArray();
        setIsVerificationPending(activeSessions.length > 0);

        // Calculate confirmed
        const sessions = await db.drawSessions.where({ prizeId }).toArray();
        const sessionIds = sessions.map(s => s.id);
        const results = await db.drawResults.where('drawSessionId').anyOf(sessionIds).toArray();

        const confirmed = results.filter(r => r.verificationStatus === 'CONFIRMED_WINNER').length;
        setConfirmedCount(confirmed);

        // Calculate remaining
        const prize = await db.prizes.get(prizeId);
        if (!prize) return;

        const remaining = Math.max(0, prize.winnerCount - confirmed);
        setRemainingCount(remaining);

        // Calculate eligible roughly (backend engine does exact logic before draw)
        const allParticipants = await db.participants.where({ eventId: activeEventId }).count();
        // Getting all global winners if strict mode
        let allConfirmed = confirmed;
        if (event?.settings.preventPreviousWinners) {
            const allEvtSessions = await db.drawSessions.where({ eventId: activeEventId }).toArray();
            const allEvtSessionIds = allEvtSessions.map(s => s.id);
            const allEvtResults = await db.drawResults.where('drawSessionId').anyOf(allEvtSessionIds).toArray();
            allConfirmed = allEvtResults.filter(r => r.verificationStatus === 'CONFIRMED_WINNER').length;
        }
        setEligibleCount(Math.max(0, allParticipants - allConfirmed));
    }

    // Poll for updates if the external presentation screen is running
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (selectedPrizeId) {
            interval = setInterval(() => {
                updatePrizeStats(selectedPrizeId);
            }, 2000);
        }
        return () => clearInterval(interval);
    }, [selectedPrizeId, event]);

    if (!activeEventId) return <div className="p-8">Please select an event.</div>;

    const currentPrize = prizes.find(p => p.id === selectedPrizeId);
    const isComplete = remainingCount === 0 && !isVerificationPending;
    const isInsufficient = eligibleCount < remainingCount;

    return (
        <div className="p-8 max-w-5xl mx-auto h-full flex flex-col">
            <header className="mb-8 shrink-0">
                <h1 className="text-3xl font-bold text-slate-800">Draw Control Center</h1>
                <p className="text-slate-500 mt-1">Manage current prize and monitor draw status remotely</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left Column - Controls */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Select Prize</h3>
                        <select
                            value={selectedPrizeId}
                            onChange={(e) => setSelectedPrizeId(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
                        >
                            {prizes.map(p => (
                                <option key={p.id} value={p.id}>{p.name} (x{p.winnerCount})</option>
                            ))}
                            {prizes.length === 0 && <option value="">No prizes available</option>}
                        </select>
                    </div>

                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Presentation Display</h3>
                        <p className="text-sm text-slate-500 mb-6">Open the presentation screen on an extended monitor or projector. It will synchronize automatically.</p>

                        <Link
                            href={`/draw/${activeEventId}`}
                            target="_blank"
                            onClick={() => {
                                // Set the focus prize in local storage for the public screen to pick up automatically if needed
                                localStorage.setItem('lucky_draw_active_prize', selectedPrizeId);
                            }}
                            className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold flex items-center justify-center gap-3 transition shadow-lg"
                        >
                            <MonitorPlay size={20} /> Launch Public Screen
                        </Link>
                    </div>
                </div>

                {/* Right Column - Status */}
                <div className="lg:col-span-2 space-y-6">
                    {currentPrize ? (
                        <div className={`bg-white p-8 rounded-3xl shadow-sm border-2 ${isComplete ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-200'}`}>

                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-800">{currentPrize.name}</h2>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-sm font-bold">
                                            {currentPrize.winnerCount} Winners Required
                                        </span>
                                        {isComplete && (
                                            <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                                                <Target size={14} /> Drawing Complete
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {currentPrize.image && (
                                    <div className="w-16 h-16 bg-white rounded-xl shadow-sm border p-1 shrink-0">
                                        <img src={currentPrize.image} className="w-full h-full object-contain" alt="" />
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-3 gap-4 mb-8">
                                <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-center">
                                    <p className="text-sm font-medium text-slate-500 mb-1">Confirmed</p>
                                    <p className="text-3xl font-black text-slate-800">{confirmedCount}</p>
                                </div>
                                <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl text-center">
                                    <p className="text-sm font-medium text-indigo-500 mb-1">Remaining</p>
                                    <p className="text-3xl font-black text-indigo-700">{remainingCount}</p>
                                </div>
                                <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-center">
                                    <p className="text-sm font-medium text-slate-500 mb-1">Eligible Pool</p>
                                    <p className="text-3xl font-black text-slate-800">{eligibleCount}</p>
                                </div>
                            </div>

                            {isVerificationPending ? (
                                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center shadow-inner">
                                    <Activity size={32} className="mx-auto text-amber-500 mb-3 animate-pulse" />
                                    <h4 className="text-lg font-bold text-amber-800 mb-1">Verification in Progress</h4>
                                    <p className="text-amber-700 text-sm max-w-sm mx-auto">
                                        The draw screen is currently running an animation or waiting for winner attendance verification.
                                    </p>
                                </div>
                            ) : isInsufficient && !isComplete ? (
                                <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-start gap-4 text-left">
                                    <AlertTriangle size={24} className="text-red-500 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-lg font-bold text-red-800">Insufficient Participants</h4>
                                        <p className="text-red-700 text-sm mt-1">
                                            You need {remainingCount} more winners, but only {eligibleCount} eligible participants remain.
                                            Please add more participants or adjust the required winner count.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center p-6 border-2 border-dashed border-slate-200 bg-slate-50 rounded-2xl">
                                    <p className="text-slate-500 mb-2">Controls are managed from the Fullscreen Presentation</p>
                                    <p className="text-sm text-slate-400">Use Spacebar or START button on the public screen to trigger draw.</p>
                                </div>
                            )}

                        </div>
                    ) : (
                        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center flex flex-col items-center justify-center">
                            <Gift size={48} className="text-slate-300 mb-4" />
                            <p className="text-slate-500">No prizes created yet.</p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}


