import { create } from 'zustand';

export const useUIStore = create((set) => ({
  isSidebarOpen: false,
  isSidebarCompact: false,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  toggleSidebarCompact: () => set((state) => ({ isSidebarCompact: !state.isSidebarCompact })),
  closeSidebar: () => set({ isSidebarOpen: false }),
  openSidebar: () => set({ isSidebarOpen: true }),

  isVisualizerOpen: false,
  visualizerMode: 'bars',
  toggleVisualizer: () => set((state) => ({ isVisualizerOpen: !state.isVisualizerOpen })),
  setVisualizerMode: (mode) => set({ visualizerMode: mode }),

  isPlayerOpen: false,
  openPlayer: () => set({ isPlayerOpen: true }),
  closePlayer: () => set({ isPlayerOpen: false }),
  togglePlayer: () => set((state) => ({ isPlayerOpen: !state.isPlayerOpen })),

  isRightPanelOpen: window.innerWidth > 1200,
  toggleRightPanel: () => set((state) => ({ isRightPanelOpen: !state.isRightPanelOpen })),
  setRightPanelOpen: (isOpen) => set({ isRightPanelOpen: isOpen }),

  isAudioLabOpen: false,
  toggleAudioLab: () => set((state) => ({ isAudioLabOpen: !state.isAudioLabOpen })),
  closeAudioLab: () => set({ isAudioLabOpen: false }),
}));
