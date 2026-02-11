import { create } from 'zustand'

export type UseDebugToolsT = {
  gridVisible: boolean
  toggleGrid: (gridVisible: boolean) => void
  outlinesVisible: boolean
  toggleOutlines: (outlinesVisible: boolean) => void
  layersVisible: boolean
  toggleLayers: (layersVisible: boolean) => void
}

export const useDebugTools = create<UseDebugToolsT>((set) => {
  return {
    gridVisible: false,
    toggleGrid: () => set((state) => ({ gridVisible: !state.gridVisible })),
    outlinesVisible: false,
    toggleOutlines: () => set((state) => ({ outlinesVisible: !state.outlinesVisible })),
    layersVisible: false,
    toggleLayers: () => set((state) => ({ layersVisible: !state.layersVisible })),
  }
})
