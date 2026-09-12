"use client";

import { useState, useEffect } from "react";
import { db, Participant } from "@/lib/db";
import { useAppStore } from "@/lib/store";
import { Upload, Plus, Trash2, Search } from "lucide-react";
import * as XLSX from "xlsx";
import Papa from "papaparse";

export default function ParticipantsPage() {
    const { activeEventId } = useAppStore();
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [isImporting, setIsImporting] = useState(false);
    const [manualNames, setManualNames] = useState("");
    const [showManual, setShowManual] = useState(false);

    useEffect(() => {
        if (activeEventId) loadParticipants();
    }, [activeEventId]);

    async function loadParticipants() {
        if (!activeEventId) return;
        const data = await db.participants.where({ eventId: activeEventId }).reverse().toArray();
        setParticipants(data);
    }

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !activeEventId) return;

        setIsImporting(true);
        const fileExt = file.name.split('.').pop()?.toLowerCase();

        if (fileExt === 'csv') {
            Papa.parse(file, {
                complete: async (results) => {
                    await processParsedData(results.data);
                },
                header: true,
                skipEmptyLines: true,
            });
        } else if (fileExt === 'xlsx' || fileExt === 'xls') {
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer);
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(firstSheet);
            await processParsedData(data);
        }
    }

    async function processParsedData(data: any[]) {
        if (!activeEventId) return;

        const newParticipants: Participant[] = [];

        for (const row of data) {
            // Very loose header matching logic
            const keys = Object.keys(row);
            const nameKey = keys.find(k => k.toLowerCase().includes('name') || k.toLowerCase().includes('nama'));
            const codeKey = keys.find(k => k.toLowerCase().includes('code') || k.toLowerCase().includes('kode'));

            const name = nameKey ? row[nameKey] : (keys.length > 0 ? row[keys[0]] : null);
            const code = codeKey ? row[codeKey] : undefined;

            if (name && String(name).trim() !== "") {
                newParticipants.push({
                    id: crypto.randomUUID(),
                    eventId: activeEventId,
                    name: String(name).trim(),
                    participantCode: code ? String(code).trim() : undefined,
                    createdAt: new Date().toISOString(),
                });
            }
        }

        if (newParticipants.length > 0) {
            await db.participants.bulkAdd(newParticipants);
            loadParticipants();
        }

        setIsImporting(false);
    }

    async function handleManualSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!activeEventId || !manualNames.trim()) return;

        const names = manualNames.split('\n').map(n => n.trim()).filter(n => n !== "");
        const newParticipants: Participant[] = names.map(name => ({
            id: crypto.randomUUID(),
            eventId: activeEventId,
            name,
            createdAt: new Date().toISOString(),
        }));

        if (newParticipants.length > 0) {
            await db.participants.bulkAdd(newParticipants);
            loadParticipants();
        }

        setManualNames("");
        setShowManual(false);
    }

    async function handleClearAll() {
        if (!activeEventId) return;
        if (confirm("WARNING: This will delete ALL participants from this event. Final winners and draw history will be corrupted. Proceed?")) {
            const keys = participants.map(p => p.id);
            await db.participants.bulkDelete(keys);
            loadParticipants();
        }
    }

    async function handleDeleteSingle(id: string) {
        if (confirm("Delete this participant?")) {
            await db.participants.delete(id);
            loadParticipants();
        }
    }

    if (!activeEventId) {
        return <div className="p-8">Please select an event in the Events Tab first.</div>;
    }

    const filtered = participants.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.participantCode && p.participantCode.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="p-8 max-w-6xl mx-auto h-full flex flex-col">
            <div className="flex justify-between items-end mb-8 shrink-0">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Participants</h1>
                    <p className="text-slate-500 mt-1">Total: {participants.length} registered</p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => setShowManual(!showManual)}
                        className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium flex items-center gap-2 hover:bg-slate-200 transition"
                    >
                        <Plus size={18} /> Manual Input
                    </button>

                    <label className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-medium flex items-center gap-2 hover:bg-indigo-700 transition cursor-pointer shadow-sm">
                        <Upload size={18} />
                        {isImporting ? "Importing..." : "Import Excel/CSV"}
                        <input type="file" accept=".csv, .xlsx, .xls" className="hidden" onChange={handleFileUpload} disabled={isImporting} />
                    </label>
                </div>
            </div>

            {showManual && (
                <form onSubmit={handleManualSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6 shrink-0">
                    <h3 className="font-semibold text-slate-700 mb-3 block">Paste Names (One per line)</h3>
                    <textarea
                        rows={5}
                        value={manualNames}
                        onChange={(e) => setManualNames(e.target.value)}
                        placeholder="ANDI&#10;BUDI&#10;CITRA"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
                    />
                    <div className="flex justify-end gap-3">
                        <button type="button" onClick={() => setShowManual(false)} className="px-5 py-2 font-medium text-slate-500 hover:text-slate-700 transition">Cancel</button>
                        <button type="submit" className="px-6 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition shadow-sm">Add Names</button>
                    </div>
                </form>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex-1 flex flex-col min-h-0">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="relative max-w-sm w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search participants..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        />
                    </div>
                    {participants.length > 0 && (
                        <button onClick={handleClearAll} className="text-red-500 hover:text-red-600 text-sm font-medium flex items-center gap-1 bg-red-50 px-3 py-1.5 rounded-lg transition">
                            <Trash2 size={16} /> Delete All
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-0">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10 shadow-sm">
                            <tr>
                                <th className="py-3 px-6 text-sm font-medium text-slate-500 w-16">No</th>
                                <th className="py-3 px-6 text-sm font-medium text-slate-500">Name</th>
                                <th className="py-3 px-6 text-sm font-medium text-slate-500">Code</th>
                                <th className="py-3 px-6 text-sm font-medium text-slate-500 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.map((p, index) => (
                                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="py-3 px-6 text-sm text-slate-400 font-medium">{index + 1}</td>
                                    <td className="py-3 px-6 text-sm font-bold text-slate-700">{p.name}</td>
                                    <td className="py-3 px-6 text-sm text-slate-500 font-mono">{p.participantCode || "-"}</td>
                                    <td className="py-3 px-6 text-right">
                                        <button onClick={() => handleDeleteSingle(p.id)} className="text-slate-400 hover:text-red-500 transition p-1">
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="py-12 text-center text-slate-500">
                                        No participants found. Import some names to get started.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
