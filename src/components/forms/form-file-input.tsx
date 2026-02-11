'use client'

import { useRef } from 'react'
import Icon from '@/components/ui/icons/icon'
import { cn } from '@/lib/cn'
import FormBase from './form-base'
import { FormControlPropsT } from './types/form-types'
import { useFieldContext } from './hooks/form-hooks'

type FormFileInputPropsT = FormControlPropsT & {
  accept?: string
}

export function FormFileInput({ accept, ...props }: FormFileInputPropsT) {
  const field = useFieldContext<File | undefined>()
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
  const inputRef = useRef<HTMLInputElement>(null)
  const fileName = field.state.value?.name

  return (
    <FormBase {...props}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        id={field.name}
        name={field.name}
        aria-invalid={isInvalid}
        onBlur={field.handleBlur}
        onChange={(e) => {
          const file = e.target.files?.[0]
          field.handleChange(file)
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          'fest-body-small border-black-10 bg-white-100 flex h-8 w-full items-center gap-2 rounded-[6px] border px-2 text-left transition-[color,box-shadow] outline-none',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
          fileName ? 'text-black-100' : 'text-black-50',
        )}
      >
        <Icon iconName="plus" size="sm" />
        <span className="truncate">{fileName ?? props.placeholder ?? 'Wybierz plik...'}</span>
      </button>
    </FormBase>
  )
}
