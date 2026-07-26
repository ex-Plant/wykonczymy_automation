'use client'

import Link from 'next/link'

import { SearchFilterInput } from '@/components/ui/search-filter-input'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { KosztorysAddMenu } from '@/components/kosztorys/editor/toolbar/menus/kosztorys-add-menu'
import { KosztorysToolbarActions } from '@/components/kosztorys/editor/toolbar/kosztorys-toolbar-actions'
import { KosztorysToolbarTotalsToggle } from '@/components/kosztorys/editor/toolbar/kosztorys-toolbar-totals-toggle'
import { KosztorysToolbarViewToggles } from '@/components/kosztorys/editor/toolbar/kosztorys-toolbar-view-toggles'
import { KosztorysViewMenu } from '@/components/kosztorys/editor/toolbar/kosztorys-view-menu'
import { KosztorysSectionFilterMenu } from '@/components/kosztorys/editor/toolbar/menus/kosztorys-section-filter-menu'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'

export function KosztorysEditorToolbar() {
  const { investmentId, investmentName, search, setSearch } = useKosztorysEditorContext()

  return (
    <div className="border-border shrink-0 border-b">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
        <h1 className="text-foreground text-sm font-medium">
          <Link href={`/inwestycje/${investmentId}`} className="hover:underline">
            {investmentName}
          </Link>
        </h1>
        <KosztorysToolbarTotalsToggle />
        <KosztorysToolbarViewToggles />

        <KosztorysAddMenu />
        <SimpleTooltip content="Szukaj pozycji / sekcji">
          {/* SearchFilterInput takes no ref, so the tooltip anchors to a wrapper */}
          <div>
            <SearchFilterInput
              value={search}
              onChange={setSearch}
              placeholder="Szukaj…"
              debounceMs={200}
            />
          </div>
        </SimpleTooltip>
        <div className="ml-auto flex items-center gap-1">
          <KosztorysToolbarActions />
          <KosztorysSectionFilterMenu />
          <KosztorysViewMenu />
        </div>
      </div>
    </div>
  )
}
