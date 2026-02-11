import { Button } from '@/components/ui/button'
import { NavDataT } from './header'
import Link from 'next/link'
import { Separator } from '@/components/ui/separator'
import { NavGroupWrapper } from './nav-group-wrapper'
import { AccessibilityMenu } from './accessibility'

export default function NavDesktop({ data }: { data: NavDataT }) {
  return (
    <div className={`ml-auto hidden flex-wrap items-center justify-end gap-1 lg:flex`}>
      {data.map((group) => {
        return <NavItemGroup key={group.id} group={group} />
      })}
      <AccessibilityMenu />
    </div>
  )
}

function NavItemGroup({ group }: { group: NavDataT[0] }) {
  return (
    <NavGroupWrapper>
      {group.items.map((item, i) => {
        return (
          <div key={group.id + i} className={`ml-auto flex flex-wrap items-center`}>
            <NavItem key={item.link} link={item.link} label={item.label} />
            <Separator className={i === group.items.length - 1 ? 'hidden' : ''} />
          </div>
        )
      })}
    </NavGroupWrapper>
  )
}

function NavItem({ link, label }: { link: string; label: string }) {
  return (
    <Link href={link}>
      <Button className={``} variant="default" tabIndex={-1}>
        {label}
      </Button>
    </Link>
  )
}
