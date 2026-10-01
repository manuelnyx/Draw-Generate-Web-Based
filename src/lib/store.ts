import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
    activeEventId: string | null;
    setActiveEventId: (id: string | null) => void;
    operatorLock: boolean;
    setOperatorLock: (locked: boolean) => void;
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            activeEventId: null,
            setActiveEventId: (id) => set({ activeEventId: id }),
            operatorLock: false,
            setOperatorLock: (locked) => set({ operatorLock: locked }),
        }),
        {
            name: 'lucky-draw-storage',
        }
    )
);
