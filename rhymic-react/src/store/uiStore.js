import { create } from 'zustand';

export const useUIStore = create((set) => ({
  isSidebarOpen: false,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  closeSidebar: () => set({ isSidebarOpen: false }),
  openSidebar: () => set({ isSidebarOpen: true }),

  isPlayerOpen: false,
  openPlayer: () => set({ isPlayerOpen: true }),
  closePlayer: () => set({ isPlayerOpen: false }),
  togglePlayer: () => set((state) => ({ isPlayerOpen: !state.isPlayerOpen })),

  isRightPanelOpen: window.innerWidth > 1200,
  toggleRightPanel: () => set((state) => ({ isRightPanelOpen: !state.isRightPanelOpen })),
  setRightPanelOpen: (isOpen) => set({ isRightPanelOpen: isOpen }),
}));