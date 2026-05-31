import { create } from 'zustand';

export const useNavigationLoadingStore = create((set) => ({
  isNavigating: false,
  startNavigation: () => set({ isNavigating: true }),
  stopNavigation: () => set({ isNavigating: false }),
}));
