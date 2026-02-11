import { useRef } from 'react'
import { DebugToolsCheckbox } from './debug-tools-checkbox'
import { useDebugTools } from './use-debug-tools'

export const DebugToolsTriggers = () => {
  const gridInputRef = useRef<HTMLInputElement | null>(null)
  const layersInputRef = useRef<HTMLInputElement | null>(null)
  const outlinesInputRef = useRef<HTMLInputElement | null>(null)

  const { layersVisible, outlinesVisible, gridVisible, toggleGrid, toggleOutlines, toggleLayers } =
    useDebugTools()

  return (
    <div className={`absolute right-4 bottom-4 flex gap-4`}>
      <DebugToolsCheckbox
        toggleFunc={toggleGrid}
        currentVal={gridVisible}
        label={`grid`}
        ref={gridInputRef}
      />
      <DebugToolsCheckbox
        toggleFunc={toggleOutlines}
        currentVal={outlinesVisible}
        label={`outlines`}
        ref={outlinesInputRef}
      />
      <DebugToolsCheckbox
        toggleFunc={toggleLayers}
        currentVal={layersVisible}
        label={`layers`}
        ref={layersInputRef}
      />
    </div>
  )
}
