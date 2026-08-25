import type { z } from 'zod'

import type { FormApiOfT } from '@/components/forms/hooks/form-api-of'
import { editTransferFormSchema } from '@/lib/schemas/transfer-form'

export type EditTransferFormValuesT = z.infer<typeof editTransferFormSchema>

export type EditTransferFormApiT = FormApiOfT<EditTransferFormValuesT>
