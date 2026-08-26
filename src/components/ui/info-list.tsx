import { cn } from '@/lib/utils/cn'

type InfoListPropsT = {
  items: { label: string; value: React.ReactNode }[]
  /**
   * `stacked` puts each label above its value, one entry per row — the shape a block needs once its
   * values are wide (a row of checkboxes), where the label column would squeeze everything into one
   * thin stripe.
   */
  layout?: 'inline' | 'stacked'
  className?: string
}

export function InfoList({ items, layout = 'inline', className }: InfoListPropsT) {
  const stacked = layout === 'stacked'

  return (
    <dl
      className={cn(
        'text-sm',
        stacked ? 'space-y-4' : 'grid grid-cols-[auto_1fr] gap-x-4 gap-y-2',
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className={stacked ? 'space-y-1' : 'contents'}>
          <dt className="text-muted-foreground font-medium">{item.label}</dt>
          {/* A blank <dd> reads as a rendering bug rather than as „nothing recorded", so an empty
              value falls back here instead of at every call site. */}
          <dd className="text-foreground">{item.value || '—'}</dd>
        </div>
      ))}
    </dl>
  )
}
