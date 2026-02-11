import { Button } from '@/components/ui/button'
import { useFormContext } from './hooks/form-hooks'
import { useFormStatus } from './hooks/use-form-status'
import { Loader } from '../ui/loader/loader'

export default function FormFooter() {
  const form = useFormContext()

  const { isInvalid, isSubmitting } = useFormStatus(form)

  return (
    <>
      <footer>
        <Button disabled={isSubmitting} type="submit">
          Submit
        </Button>
        {isInvalid && (
          <p className="text-destructive mt-2 text-sm font-medium">{'Formularz zawiera blędy '}</p>
        )}
      </footer>
      <Loader loading={isSubmitting} portal />
    </>
  )
}
