"use client";

import { useState, useEffect } from "react";
import { db, Prize } from "@/lib/db";
import { useAppStore } from "@/lib/store";
import { Plus, Trash2, Edit2, Image as ImageIcon, Save, X } from "lucide-react";

export default function PrizesPage() {
    const { activeEventId } = useAppStore();
    const [prizes, setPrizes] = useState<Prize[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form state
    const [name, setName] = useState("");
    const [winnerCount, setWinnerCount] = useState(1);
    const [image, setImage] = useState("");

    useEffect(() => {
        if (activeEventId) loadPrizes();
    }, [activeEventId]);

    async function loadPrizes() {
        if (!activeEventId) return;
        const data = await db.prizes.where({ eventId: activeEventId }).sortBy("order");
        setPrizes(data);
    }

    function resetForm() {
        setName("");
        setWinnerCount(1);
        setImage("");
        setIsCreating(false);
        setEditingId(null);
    }

    async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        // Convert to base64 for local storage mapping (in real large apps, use Blob URL + object store, but b64 is okay for small icons)
        const reader = new FileReader();
        reader.onload = (event) => {
            setImage(event.target?.result as string);
        };
        reader.readAsDataURL(file);
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        if (!activeEventId || !name.trim()) return;

        if (editingId) {
            await db.prizes.update(editingId, {
                name,
                winnerCount: Number(winnerCount),
                image,
                updatedAt: new Date().toISOString()
            });
        } else {
            await db.prizes.add({
                id: crypto.randomUUID(),
                eventId: activeEventId,
                name,
                winnerCount: Number(winnerCount),
                image,
                order: prizes.length,
                active: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }

        resetForm();
        loadPrizes();
    }

    async function handleDelete(id: string) {
        if (confirm("Delete this prize? Draw history relating to this prize may lose context.")) {
            await db.prizes.delete(id);
            loadPrizes();
        }
    }

    function startEdit(p: Prize) {
        setEditingId(p.id);
        setName(p.name);
        setWinnerCount(p.winnerCount);
        setImage(p.image || "");
        setIsCreating(true);
    }

    if (!activeEventId) return <div className="p-8">Please select an event first.</div>;

    return (
        <div className="p-8 max-w-5xl mx-auto flex flex-col h-full">
            <div className="flex justify-between items-center mb-8 shrink-0">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Prize Configuration</h1>
                    <p className="text-slate-500 mt-1">Set up prizes and required winner counts</p>
                </div>
                {!isCreating && (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-medium flex items-center gap-2 hover:bg-indigo-700 transition shadow-sm"
                    >
                        <Plus size={20} /> Add Prize
                    </button>
                )}
            </div>

            {isCreating && (
                <form onSubmit={handleSave} className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100 mb-8 max-w-2xl shrink-0">
                    <h2 className="text-xl font-bold text-slate-800 mb-6">{editingId ? "Edit Prize" : "Create New Prize"}</h2>

                    <div className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Prize Name</label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Philips Air Fryer"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Required Winner Count</label>
                            <input
                                type="number"
                                min="1"
                                required
                                value={winnerCount}
                                onChange={(e) => setWinnerCount(parseInt(e.target.value) || 1)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Prize Image (Optional)</label>
                            <div className="flex items-start gap-4">
                                {image ? (
                                    <div className="relative w-24 h-24 rounded-xl border bg-slate-50 overflow-hidden shrink-0">
                                        <img src={image} alt="Preview" className="w-full h-full object-contain" />
                                        <button type="button" onClick={() => setImage("")} className="absolute top-1 right-1 bg-white rounded-full p-1 shadow shadow-black/20 text-red-500 hover:bg-red-50"><X size={14} /></button>
                                    </div>
                                ) : (
                                    <label className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:bg-slate-100 hover:border-slate-400 transition shrink-0">
                                        <ImageIcon size={24} className="mb-1" />
                                        <span className="text-[10px] uppercase font-bold tracking-wider">Upload</span>
                                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                    </label>
                                )}
                                <div className="text-sm text-slate-500 mt-2">Maximum file size: 2MB. Recommendation: Use PNG with transparent background.</div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-100">
                        <button type="button" onClick={resetForm} className="px-6 py-2.5 text-slate-500 font-medium hover:bg-slate-50 rounded-xl transition">Cancel</button>
                        <button type="submit" className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium flex items-center gap-2 hover:bg-indigo-700 transition shadow-sm">
                            <Save size={18} /> {editingId ? "Update Prize" : "Save Prize"}
                        </button>
                    </div>
                </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pb-8">
                {prizes.map((p) => (
                    <div key={p.id} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col">
                        <div className="aspect-[4/3] bg-slate-50 border-b border-slate-100 relative p-6 flex items-center justify-center">
                            {p.image ? (
                                <img src={p.image} alt={p.name} className="w-full h-full object-contain drop-shadow-md" />
                            ) : (
                                <Gift size={64} className="text-slate-200" />
                            )}
                            <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm border shadow-sm px-3 py-1 rounded-full text-sm font-bold text-slate-700 flex items-center gap-1.5">
                                <Users size={14} className="text-slate-400" /> x{p.winnerCount}
                            </div>
                        </div>

                        <div className="p-5 flex-1 flex flex-col justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 line-clamp-2 leading-tight">{p.name}</h3>
                            </div>
                            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100">
                                <button onClick={() => startEdit(p)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition">
                                    <Edit2 size={18} />
                                </button>
                                <button onClick={() => handleDelete(p.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {prizes.length === 0 && !isCreating && (
                    <div className="col-span-full bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center text-slate-500">
                        <Gift size={48} className="mx-auto mb-4 text-slate-300" />
                        <h3 className="text-xl font-medium text-slate-700 mb-2">No Prizes Configured</h3>
                        <p>Add the prizes that will be distributed during this event.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// Minimal mock icons internal to this file to avoid breaking if lucide misses it
function Users(props: any) { return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> }
