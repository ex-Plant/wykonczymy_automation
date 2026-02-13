import { Input } from '@/components/ui/input'
import { FormControlPropsT } from './types/form-types'
import FormBase from './form-base'
import { useFieldContext } from './hooks/form-hooks'

export function FormInput(props: FormControlPropsT) {
  const field = useFieldContext<string>()
  const isInvalid = field.state.meta.errors.length > 0

  return (
    <FormBase {...props}>
      <Input
        placeholder={props.placeholder}
        id={field.name}
        name={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        aria-invalid={isInvalid}
        type={props.type}
        className={props.className}
      />
    </FormBase>
  )
}
