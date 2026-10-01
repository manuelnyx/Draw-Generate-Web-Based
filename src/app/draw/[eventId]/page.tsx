"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { db, Event, Prize, Participant } from "@/lib/db";
import {
    getEligibleParticipants,
    selectUniqueParticipants,
    calculateRemainingWinners,
    createDrawSession,
    confirmWinner,
    markAbsent
} from "@/lib/drawEngine";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, CheckCircle, XCircle } from "lucide-react";

type DrawState = 'IDLE' | 'PREPARING' | 'ROLLING' | 'REVEALING' | 'VERIFICATION' | 'COMPLETED';

export default function PublicDrawScreen() {
    const params = useParams();
    const eventId = params.eventId as string;

    // Base State
    const [event, setEvent] = useState<Event | null>(null);
    const [prizes, setPrizes] = useState<Prize[]>([]);
    const [currentPrize, setCurrentPrize] = useState<Prize | null>(null);

    // Draw State
    const [drawState, setDrawState] = useState<DrawState>('IDLE');
    const [remainingCount, setRemainingCount] = useState(0);
    const [eligibleParticipants, setEligibleParticipants] = useState<Participant[]>([]);
    const [currentResult, setCurrentResult] = useState<{ participant: Participant, resultId: string, status: string }[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

    // Animation State
    const [displayNames, setDisplayNames] = useState<string[]>([]);
    const animationRef = useRef<number>();

    useEffect(() => {
        loadEventData();
    }, [eventId]);

    // Sync with Admin UI
    useEffect(() => {
        const handleStorageChange = () => {
            const activePrizeId = localStorage.getItem('lucky_draw_active_prize');
            if (activePrizeId && prizes.length > 0) {
                const found = prizes.find(p => p.id === activePrizeId);
                if (found && drawState === 'IDLE') {
                    setCurrentPrize(found);
                }
            }
        };

        window.addEventListener('storage', handleStorageChange);
        // Initial check
        handleStorageChange();

        return () => window.removeEventListener('storage', handleStorageChange);
    }, [prizes, drawState]);

    useEffect(() => {
        if (currentPrize) {
            refreshSync();
        }
    }, [currentPrize]);

    async function loadEventData() {
        const ev = await db.events.get(eventId);
        setEvent(ev || null);

        const pr = await db.prizes.where({ eventId }).sortBy('order');
        setPrizes(pr);
        if (pr.length > 0) setCurrentPrize(pr[0]);
    }

    async function refreshSync() {
        if (!currentPrize) return;

        const remaining = await calculateRemainingWinners(currentPrize.id);
        setRemainingCount(remaining);

        const eligible = await getEligibleParticipants(eventId, currentPrize.id);
        setEligibleParticipants(eligible);

        // Check if there's a pending session that crashed or awaits verification
        const pendingSessions = await db.drawSessions
            .where({ prizeId: currentPrize.id })
            .filter(s => s.status === 'VERIFICATION')
            .toArray();

        if (pendingSessions.length > 0) {
            const sess = pendingSessions[pendingSessions.length - 1]; // latest
            setActiveSessionId(sess.id);

            const results = await db.drawResults.where({ drawSessionId: sess.id }).toArray();
            const mapped = await Promise.all(results.map(async r => {
                const p = await db.participants.get(r.participantId);
                return { participant: p!, resultId: r.id, status: r.verificationStatus };
            }));

            setCurrentResult(mapped);
            setDrawState('VERIFICATION');
        }
    }

    async function startDraw() {
        if (!currentPrize || !event || remainingCount === 0 || eligibleParticipants.length === 0) return;

        // 1. Calculate actual count to draw (Rule #96)
        const countToDraw = Math.min(remainingCount, eligibleParticipants.length);

        setDrawState('PREPARING');

        try {
            // 2. Secretly select the REAL winners beforehand (Rule #21 & #22)
            const selected = selectUniqueParticipants(eligibleParticipants, countToDraw);

            // 3. Create Draw Session & Save Results atomically
            const type = remainingCount === currentPrize.winnerCount ? 'INITIAL' : 'REDRAW';
            const sessionId = await createDrawSession(eventId, currentPrize.id, countToDraw, type);
            setActiveSessionId(sessionId);

            // Prepare results items
            const newResults = [];
            for (let i = 0; i < selected.length; i++) {
                const rId = crypto.randomUUID();
                await db.drawResults.add({
                    id: rId,
                    drawSessionId: sessionId,
                    participantId: selected[i].id,
                    drawOrder: i,
                    verificationStatus: 'PENDING',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });

                newResults.push({
                    participant: selected[i],
                    resultId: rId,
                    status: 'PENDING'
                });
            }

            setCurrentResult(newResults);
            await db.drawSessions.update(sessionId, { status: 'ROLLING' });

            // 4. Start visual animation
            setDrawState('ROLLING');
            startRollingAnimation(countToDraw, newResults.map(r => r.participant.name), event.settings.animationDuration);

        } catch (error) {
            console.error(error);
            setDrawState('IDLE');
        }
    }

    function startRollingAnimation(slotsCount: number, finalNames: string[], durationSeconds: number) {
        const startTime = performance.now();
        const durationMs = durationSeconds * 1000;

        // Fallback names for the visual spin
        const allNames = eligibleParticipants.map(ev => ev.name);

        function updateFrame(time: number) {
            const elapsed = time - startTime;

            if (elapsed < durationMs) {
                // Rolling: Random names
                const currentSpin = Array.from({ length: slotsCount }).map(() => {
                    return allNames[Math.floor(Math.random() * allNames.length)] || "???";
                });
                setDisplayNames(currentSpin);
                animationRef.current = requestAnimationFrame(updateFrame);
            } else {
                // Reveal (Replace with actual final results)
                setDisplayNames(finalNames);
                finalizeDraw();
            }
        }

        animationRef.current = requestAnimationFrame(updateFrame);
    }

    async function finalizeDraw() {
        setDrawState('REVEALING');

        // Allow celebration overlap, then push to verification
        setTimeout(async () => {
            setDrawState('VERIFICATION');
            if (activeSessionId) {
                await db.drawSessions.update(activeSessionId, { status: 'VERIFICATION' });
            }
        }, 3000);
    }

    // --- Verification Actions ---
    async function markStatus(index: number, status: 'PRESENT' | 'ABSENT') {
        const item = currentResult[index];
        if (status === 'PRESENT') {
            await confirmWinner(item.resultId);
        } else {
            await markAbsent(item.resultId);
        }

        const updated = [...currentResult];
        updated[index].status = status;
        setCurrentResult(updated);
    }

    async function finishVerificationRound() {
        if (activeSessionId) {
            await db.drawSessions.update(activeSessionId, { status: 'COMPLETED' });
        }
        await refreshSync();
        setDrawState('COMPLETED');
    }

    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.code === 'Space' && drawState === 'IDLE' && remainingCount > 0) {
                startDraw();
            }
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [drawState, remainingCount]);

    if (!event || !currentPrize) return <div className="min-h-screen bg-black flex items-center justify-center text-white text-2xl animate-pulse">Loading Event Engine...</div>;

    const bgStyle = event.backgroundUrl ? { backgroundImage: `url(${event.backgroundUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {};

    return (
        <div className="min-h-screen relative flex flex-col font-sans overflow-hidden bg-slate-900 text-white" style={bgStyle}>
            {/* Overlay for readability */}
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-0" />

            {/* Header */}
            <header className="relative z-10 p-8 flex justify-between items-start">
                <div className="flex items-center gap-6">
                    {event.logoUrl && <img src={event.logoUrl} className="h-16 object-contain" alt="Logo" />}
                    <div>
                        <h1 className="text-3xl font-black uppercase tracking-tight text-white/90">{event.name}</h1>
                        <p className="text-indigo-400 font-bold uppercase tracking-widest text-sm mt-1">Official Draw System</p>
                    </div>
                </div>

                {/* Hidden prize selector for emergencies, usually synced via localStorage */}
                <select
                    className="bg-black/20 hover:bg-black/40 border border-white/10 text-white/70 py-2 px-4 rounded-xl outline-none backdrop-blur-md transition cursor-pointer text-sm font-medium"
                    value={currentPrize?.id || ''}
                    onChange={(e) => {
                        const p = prizes.find(pr => pr.id === e.target.value);
                        if (p) {
                            setCurrentPrize(p);
                            setDrawState('IDLE');
                        }
                    }}
                    disabled={drawState !== 'IDLE' && drawState !== 'COMPLETED'}
                >
                    {prizes.map(p => (
                        <option key={p.id} value={p.id} className="bg-slate-900">{p.name}</option>
                    ))}
                </select>
            </header>

            {/* Main Content Arena */}
            <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-8 w-full max-w-7xl mx-auto">

                {/* Prize Focus */}
                {drawState === 'IDLE' && (
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center text-center">
                        {currentPrize.image ? (
                            <img src={currentPrize.image} className="h-64 object-contain mb-8 drop-shadow-2xl" alt="" />
                        ) : (
                            <Trophy size={96} className="text-yellow-400 mb-8 drop-shadow-2xl" />
                        )}
                        <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400 mb-4">{currentPrize.name}</h2>
                        <div className="flex gap-4 items-center">
                            <span className="bg-white/10 border border-white/20 px-6 py-2 rounded-full text-xl font-medium tracking-wide">
                                {currentPrize.winnerCount} Winners
                            </span>
                            <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-6 py-2 rounded-full text-xl font-bold tracking-wide">
                                Remaining: {remainingCount}
                            </span>
                        </div>

                        {remainingCount > 0 ? (
                            <button
                                onClick={startDraw}
                                className="mt-16 px-12 py-5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white rounded-full font-black text-2xl tracking-widest uppercase shadow-[0_0_40px_rgba(99,102,241,0.5)] transition-all hover:scale-105 active:scale-95"
                            >
                                START DRAW
                            </button>
                        ) : (
                            <div className="mt-16 p-8 border-2 border-emerald-500/50 bg-emerald-500/10 rounded-3xl backdrop-blur-md">
                                <CheckCircle size={48} className="text-emerald-400 mx-auto mb-4" />
                                <h3 className="text-3xl font-black text-emerald-400 uppercase">Prize Completed</h3>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* Rolling & Revealing Screen (The Grid) */}
                {(drawState === 'ROLLING' || drawState === 'REVEALING') && (
                    <div className="w-full flex-1 flex flex-col items-center justify-center">
                        <h2 className="text-3xl font-bold text-white/50 uppercase tracking-widest mb-12">{currentPrize.name}</h2>

                        <div className={`grid gap-6 w-full ${displayNames.length > 10 ? 'grid-cols-4 md:grid-cols-5' : displayNames.length > 4 ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
                            <AnimatePresence>
                                {displayNames.map((name, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        className={`relative overflow-hidden flex items-center justify-center text-center p-6 rounded-2xl border ${drawState === 'REVEALING' ? 'bg-gradient-to-br from-indigo-600 to-purple-700 border-indigo-400 shadow-[0_0_30px_rgba(99,102,241,0.6)]' : 'bg-white/10 border-white/20'}`}
                                        style={{ minHeight: '120px' }}
                                    >
                                        <span className={`font-black uppercase break-words drop-shadow-md ${drawState === 'REVEALING' ? 'text-white' : 'text-white/80'} ${displayNames.length > 5 ? 'text-2xl lg:text-3xl' : 'text-4xl lg:text-5xl'}`}>
                                            {name}
                                        </span>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>
                )}

                {/* Verification Modal (Admin Scope overlay) */}
                {drawState === 'VERIFICATION' && (
                    <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-slate-900 border border-slate-700 rounded-3xl p-8 w-full max-w-4xl shadow-2xl relative z-50">
                        <h3 className="text-2xl font-bold text-amber-500 mb-2 uppercase tracking-wide">Verification Required</h3>
                        <p className="text-slate-400 mb-8 border-b border-slate-700 pb-6">Please verify attendance. Absent winners will be returned to the eligible pool for the next redraw.</p>

                        <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-4 mb-8">
                            {currentResult.map((res, i) => (
                                <div key={res.resultId} className={`flex items-center justify-between p-4 rounded-xl border ${res.status === 'PENDING' ? 'bg-slate-800 border-slate-600' : res.status === 'PRESENT' ? 'bg-emerald-900/30 border-emerald-500/50' : 'bg-red-900/30 border-red-500/50'}`}>
                                    <span className="text-xl font-bold">{i + 1}. {res.participant.name}</span>

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => markStatus(i, 'PRESENT')}
                                            className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition ${res.status === 'PRESENT' ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                                        >
                                            <CheckCircle size={18} /> PRESENT
                                        </button>
                                        <button
                                            onClick={() => markStatus(i, 'ABSENT')}
                                            className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition ${res.status === 'ABSENT' ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                                        >
                                            <XCircle size={18} /> ABSENT
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-between items-center bg-slate-950 p-6 rounded-2xl border border-slate-800">
                            <div className="text-slate-400">
                                Pending: <span className="text-white font-bold">{currentResult.filter(r => r.status === 'PENDING').length}</span>
                            </div>
                            <button
                                onClick={finishVerificationRound}
                                disabled={currentResult.some(r => r.status === 'PENDING')}
                                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold tracking-wide transition"
                            >
                                SAVE & CONTINUE
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* Completion Block after Verification */}
                {drawState === 'COMPLETED' && (
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
                        {remainingCount > 0 ? (
                            <div className="space-y-8">
                                <h3 className="text-4xl font-bold mb-2">Partial Completion</h3>
                                <p className="text-xl text-slate-400">We still need <strong className="text-amber-400">{remainingCount}</strong> more winners due to absentees.</p>
                                <button
                                    onClick={startDraw}
                                    className="px-10 py-4 bg-amber-500 hover:bg-amber-400 text-black rounded-full font-black text-xl tracking-widest uppercase shadow-[0_0_30px_rgba(245,158,11,0.4)] transition"
                                >
                                    REDRAW {remainingCount} NOW
                                </button>
                                <div className="pt-4">
                                    <button onClick={() => setDrawState('IDLE')} className="text-sm font-medium text-slate-500 hover:text-white">Cancel / Back to Home</button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                <Trophy size={84} className="text-emerald-400 mx-auto drop-shadow-[0_0_30px_rgba(52,211,153,0.5)] mb-6" />
                                <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 uppercase">
                                    PRIZE FULFILLED!
                                </h2>
                                <p className="text-xl text-slate-300">All {currentPrize.winnerCount} winners have been successfully confirmed.</p>
                                <button onClick={() => setDrawState('IDLE')} className="mt-8 px-8 py-3 rounded-xl bg-white/10 hover:bg-white/20 font-bold transition">
                                    Back to Dashboard
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}

            </main>
        </div>
    );
}
