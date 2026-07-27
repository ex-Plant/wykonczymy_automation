'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { SearchFilterInput } from '@/components/ui/search-filter-input'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { KosztorysAddMenu } from '@/components/kosztorys/editor/toolbar/menus/kosztorys-add-menu'
import { KosztorysActionsMenu } from '@/components/kosztorys/editor/toolbar/menus/kosztorys-actions-menu'
import { KosztorysTotalsPanelToggle } from '@/components/kosztorys/summary/kosztorys-totals-panel-toggle'
import { ToolbarToggle } from '@/components/ui/toolbar-toggle'
import {
  VIEWS,
  VIEW_LEGEND,
} from '@/components/kosztorys/editor/toolbar/kosztorys-view-axis-options'
import { KosztorysViewMenu } from '@/components/kosztorys/editor/toolbar/kosztorys-view-menu'
import { KosztorysSectionFilterMenu } from '@/components/kosztorys/editor/toolbar/menus/kosztorys-section-filter-menu'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'

export function KosztorysEditorToolbar() {
  const { investmentId, investmentName, search, setSearch, view, setView } =
    useKosztorysEditorContext()
  const router = useRouter()

  return (
    <div className="border-border shrink-0 border-b">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
        <SimpleTooltip content="Wróć">
          <button
            type="button"
            // History back, not a link to the investment — the reader may have arrived from the
            // investment page's settings link, the listing, or anywhere else, and „wróć" should
            // undo that navigation rather than always land on one fixed page.
            onClick={() => router.back()}
            aria-label="Wróć"
            className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
          >
            <ArrowLeft className="size-4" />
          </button>
        </SimpleTooltip>
        <h1 className="text-foreground text-sm font-medium">
          <Link href={`/inwestycje/${investmentId}`} className="hover:underline">
            {investmentName}
          </Link>
        </h1>
        <KosztorysTotalsPanelToggle />
        <ToolbarToggle
          legend={VIEW_LEGEND}
          options={VIEWS}
          value={view}
          onChange={setView}
          aria-label="Widok cen"
        />

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
          <KosztorysActionsMenu />
          <KosztorysSectionFilterMenu />
          <KosztorysViewMenu />
        </div>
      </div>
    </div>
  )
}
