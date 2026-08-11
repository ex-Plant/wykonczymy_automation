import { SelectItem } from '@/components/ui/select'
import { VAT_PLANES, VAT_PLANE_LABELS } from '@/lib/constants/transfers'

type VatPlaneFieldPropsT = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly form: any
}

export function VatPlaneField({ form }: VatPlaneFieldPropsT) {
  return (
    <form.AppField name="vatPlane">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {(field: any) => (
        <field.Select
          label="Rozliczenie netto/brutto"
          description="Określ czy wpłata ma trafić do puli netto czy brutto. Na tej podstawie określamy wartość rozliczenia mieszanego (część brutto, część netto)."
          showError
        >
          {VAT_PLANES.map((p) => (
            <SelectItem key={p} value={p}>
              {VAT_PLANE_LABELS[p]}
            </SelectItem>
          ))}
        </field.Select>
      )}
    </form.AppField>
  )
}
