import { create } from "zustand"

type PanelVisibilityStore = {
  visible: boolean
  setVisible: (visible: boolean) => void
}

export const usePanelVisibilityStore = create<PanelVisibilityStore>((set) => ({
  visible: true,
  setVisible: (visible) => set({ visible }),
}))
