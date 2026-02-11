import { forwardRef } from 'react'

type DebugToolsInputFieldPropsT = {
  toggleFunc: (prev: boolean) => void
  currentVal: boolean
  label: string
}

export const DebugToolsCheckbox = forwardRef<HTMLInputElement, DebugToolsInputFieldPropsT>(
  (props, ref) => {
    const { toggleFunc, currentVal, label } = props
    return (
      <div className={`text-10 mt-4 flex items-center justify-between gap-2`}>
        <p>{label}</p>
        <input
          ref={ref}
          type="checkbox"
          onChange={() => toggleFunc(currentVal)}
          checked={currentVal}
        />
      </div>
    )
  },
)

DebugToolsCheckbox.displayName = 'DebugToolsInputField'
