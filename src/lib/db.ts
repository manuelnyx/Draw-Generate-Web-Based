import Dexie, { Table } from 'dexie';

export interface Event {
    id: string;
    name: string;
    description?: string;
    logoUrl?: string; // base64 or object URL stored in IndexedDB
    backgroundUrl?: string; // base64 or object URL
    theme: string;
    settings: {
        preventPreviousWinners: boolean;
        animationDuration: number;
        soundEnabled: boolean;
        operatorLock: boolean;
    };
    createdAt: string;
    updatedAt: string;
}

export interface Prize {
    id: string;
    eventId: string;
    name: string;
    image?: string; // base64 data
    description?: string;
    category?: string;
    winnerCount: number;
    order: number;
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface Participant {
    id: string;
    eventId: string;
    name: string;
    participantCode?: string;
    metadata?: Record<string, string>;
    createdAt: string;
}

export interface DrawSession {
    id: string;
    eventId: string;
    prizeId: string;
    type: 'INITIAL' | 'REDRAW';
    requestedCount: number;
    startedAt: string;
    completedAt?: string;
    status: 'IDLE' | 'PREPARING' | 'ROLLING' | 'REVEALING' | 'VERIFICATION' | 'COMPLETED' | 'CANCELLED';
}

export interface DrawResult {
    id: string;
    drawSessionId: string;
    participantId: string;
    drawOrder: number;
    verificationStatus: 'PENDING' | 'PRESENT' | 'ABSENT' | 'CONFIRMED_WINNER';
    createdAt: string;
    updatedAt: string;
}

export class LuckyDrawDB extends Dexie {
    events!: Table<Event, string>;
    prizes!: Table<Prize, string>;
    participants!: Table<Participant, string>;
    drawSessions!: Table<DrawSession, string>;
    drawResults!: Table<DrawResult, string>;

    constructor() {
        super('LuckyDrawDB');

        this.version(1).stores({
            events: 'id, createdAt',
            prizes: 'id, eventId, order, active',
            participants: 'id, eventId, participantCode, name',
            drawSessions: 'id, eventId, prizeId, status, startedAt',
            drawResults: 'id, drawSessionId, participantId, verificationStatus'
        });
    }
}

export const db = new LuckyDrawDB();
