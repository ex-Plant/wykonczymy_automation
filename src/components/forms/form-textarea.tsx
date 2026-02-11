import { Textarea } from '@/components/ui/textarea'
import FormBase from './form-base'
import { FormControlPropsT } from './types/form-types'
import { useFieldContext } from './hooks/form-hooks'

export function FormTextarea(props: FormControlPropsT) {
  const field = useFieldContext<string>()
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid

  return (
    <FormBase {...props}>
      <Textarea
        placeholder={props.placeholder}
        id={field.name}
        name={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        aria-invalid={isInvalid}
        className={props.className}
      />
    </FormBase>
  )
}
