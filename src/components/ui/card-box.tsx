import { cn } from '@/lib/cn'
import Icon from '@/components/ui/icons/icon'

type IconNameT = React.ComponentProps<typeof Icon>['iconName']

type CardBoxPropsT = React.ComponentProps<'section'> & {
  title?: string
  icon?: IconNameT
}

function CardBox({ className, title, icon, children, ...props }: CardBoxPropsT) {
  return (
    <section
      data-slot="card-box"
      className={cn(
        'border-black-10 bg-white-50 flex flex-col gap-4 rounded-lg border px-4 pt-3 pb-4',
        className,
      )}
      {...props}
    >
      {title && <CardBoxHeader title={title} icon={icon} />}
      {children}
    </section>
  )
}

function CardBoxHeader({ title, icon }: { title: string; icon?: IconNameT }) {
  return (
    <div data-slot="card-box-header" className="flex items-center gap-2">
      {icon && <Icon iconName={icon} size="sm" />}
      <span className="fest-label-small text-black-100">{title}</span>
    </div>
  )
}

export { CardBox, CardBoxHeader }
