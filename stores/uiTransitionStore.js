'use client';

import { create } from 'zustand';

/** @typedef {'accent' | 'mode' | 'locale'} UiTransitionReason */

export const useUiTransitionStore = create((set) => ({
  transitionId: 0,
  reason: null,

  triggerTransition: (reason) => {
    set((state) => ({
      transitionId: state.transitionId + 1,
      reason,
    }));
  },
}));
