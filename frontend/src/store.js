import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useStore = create(
  persist(
    (set) => ({
      userProfile: {
        name: '',
        gender: 'ชาย',
        birthDate: '',
        weight: '',
        height: '',
        bloodType: 'O',
        emergencyContact: '',
        chronicDiseases: [],
        drugAllergies: '',
        foodAllergies: '',
        medications: '',
      },
      history: [],
      setUserProfile: (profile) => set({ userProfile: profile }),
      addHistory: (item) => set((state) => ({ history: [item, ...state.history] })),
      updateHistory: (id, newAnalysis) => set((state) => ({
        history: state.history.map(item => item.id === id ? { ...item, analysis: newAnalysis } : item)
      })),
    }),
    {
      name: 'healtate-storage',
    }
  )
);
