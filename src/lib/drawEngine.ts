import { db, Participant, DrawSession, DrawResult } from './db';

// --------------------------------------------------------
// 1. ELIGIBILITY ALGORITHM
// --------------------------------------------------------
export async function getEligibleParticipants(eventId: string, prizeId: string): Promise<Participant[]> {
    const event = await db.events.get(eventId);
    if (!event) throw new Error('Event not found');

    // Master list of all participants
    const allParticipants = await db.participants.where({ eventId }).toArray();

    // Get all confirmed winners
    const confirmedWinnerIds = new Set<string>();

    if (event.settings.preventPreviousWinners) {
        // If strict mode: Exclude participants who won ANY prize in this event
        const allSessions = await db.drawSessions.where({ eventId }).toArray();
        const sessionIds = allSessions.map((s: DrawSession) => s.id);

        if (sessionIds.length > 0) {
            const allResults = await db.drawResults
                .where('drawSessionId').anyOf(sessionIds)
                .and((r: DrawResult) => r.verificationStatus === 'CONFIRMED_WINNER')
                .toArray();

            allResults.forEach((r: DrawResult) => confirmedWinnerIds.add(r.participantId));
        }
    } else {
        // If not strict mode: Exclude participants who won THIS prize only
        const prizeSessions = await db.drawSessions.where({ prizeId }).toArray();
        const sessionIds = prizeSessions.map((s: DrawSession) => s.id);

        if (sessionIds.length > 0) {
            const prizeResults = await db.drawResults
                .where('drawSessionId').anyOf(sessionIds)
                .and((r: DrawResult) => r.verificationStatus === 'CONFIRMED_WINNER')
                .toArray();

            prizeResults.forEach((r: DrawResult) => confirmedWinnerIds.add(r.participantId));
        }
    }

    // Also, exclude participants who are currently PENDING in an active draw session
    // (to prevent them from being drawn twice simultaneously before verification)
    const activeSessions = await db.drawSessions.where({ prizeId }).toArray();
    const activeSessionIds = activeSessions
        .filter((s: DrawSession) => ['VERIFICATION', 'ROLLING', 'REVEALING'].includes(s.status))
        .map((s: DrawSession) => s.id);

    if (activeSessionIds.length > 0) {
        const pendingResults = await db.drawResults
            .where('drawSessionId').anyOf(activeSessionIds)
            .and((r: DrawResult) => r.verificationStatus === 'PENDING')
            .toArray();
        pendingResults.forEach((r: DrawResult) => confirmedWinnerIds.add(r.participantId));
    }

    return allParticipants.filter((p: Participant) => !confirmedWinnerIds.has(p.id));
}

// --------------------------------------------------------
// 2. RANDOM SELECTION ALGORITHM
// --------------------------------------------------------
export function selectUniqueParticipants(candidates: Participant[], count: number): Participant[] {
    if (candidates.length < count) {
        throw new Error(`Not enough eligible participants. Required: ${count}, Available: ${candidates.length}`);
    }

    // Create a copy to perform Fischer-Yates shuffle
    const pool = [...candidates];

    // Use crypto-safe random values
    for (let i = pool.length - 1; i > 0; i--) {
        const array = new Uint32Array(1);
        self.crypto.getRandomValues(array);
        const j = array[0] % (i + 1);

        // Swap
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    // Return the first 'count' participants
    return pool.slice(0, count);
}

// --------------------------------------------------------
// 3. REMAINING CALCULATION
// --------------------------------------------------------
export async function calculateRemainingWinners(prizeId: string): Promise<number> {
    const prize = await db.prizes.get(prizeId);
    if (!prize) throw new Error('Prize not found');

    const sessions = await db.drawSessions.where({ prizeId }).toArray();
    const sessionIds = sessions.map((s: DrawSession) => s.id);

    let confirmedWinners: DrawResult[] = [];
    if (sessionIds.length > 0) {
        confirmedWinners = await db.drawResults
            .where('drawSessionId').anyOf(sessionIds)
            .and((r: DrawResult) => r.verificationStatus === 'CONFIRMED_WINNER')
            .toArray();
    }

    const remaining = prize.winnerCount - confirmedWinners.length;
    return Math.max(0, remaining);
}

// --------------------------------------------------------
// 4. DRAW SESSION MANAGEMENT
// --------------------------------------------------------
export async function createDrawSession(eventId: string, prizeId: string, count: number, type: 'INITIAL' | 'REDRAW'): Promise<string> {
    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.drawSessions.add({
        id: sessionId,
        eventId,
        prizeId,
        type,
        requestedCount: count,
        startedAt: now,
        status: 'IDLE' // Starts idle, UI transitions it
    });

    return sessionId;
}

// --------------------------------------------------------
// 5. WINNER VERIFICATION OPERATIONS
// --------------------------------------------------------
export async function confirmWinner(resultId: string): Promise<void> {
    await db.drawResults.update(resultId, {
        verificationStatus: 'CONFIRMED_WINNER',
        updatedAt: new Date().toISOString()
    });
}

export async function markAbsent(resultId: string): Promise<void> {
    await db.drawResults.update(resultId, {
        verificationStatus: 'ABSENT',
        updatedAt: new Date().toISOString()
    });
}
