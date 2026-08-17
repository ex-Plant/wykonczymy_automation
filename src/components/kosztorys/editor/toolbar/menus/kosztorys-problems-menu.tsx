'use client'

import { Check, RefreshCw, TriangleAlert } from 'lucide-react'
import { FilterTriggerButton } from '@/components/filters/filter-trigger-button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  allProblemIds,
  problemsMenuModel,
} from '@/components/kosztorys/editor/toolbar/menus/problems-menu-model'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { cn } from '@/lib/utils/cn'

/**
 * „Co jest tu zepsute" — its own trigger rather than a group inside „Filtry", because it is not the
 * same question: a filter says what the reader wants to see, a problem says what the kosztorys is
 * waiting on. Folded into the filters it was a warning behind a closed dropdown, one heading down a
 * list about something else.
 *
 * The button exists only while something is wrong. A permanently present „Problemy (0)" would be
 * chrome to skip past; a button that appears IS the alarm, which is why the trigger carries the
 * triangle and the destructive tone rather than a neutral icon plus a badge.
 *
 * One problem at a time (owner): each pick narrows the grid to that problem's own matches and reveals
 * that problem's columns, so two at once showed the sum of two unrelated sets with nothing on screen
 * to say which row belonged to which. Picking the engaged one again turns it off — there is no
 * „wszystkie problemy" row, because the union is exactly what makes no sense here.
 */
export function KosztorysProblemsMenu() {
  const { engagedConditionIds, toggleConditionExclusive, conditionCounts, refreshProblemRows } =
    useKosztorysEditorContext()

  const { problemToggles, hasProblems } = problemsMenuModel({
    engagedIds: engagedConditionIds,
    counts: conditionCounts,
  })

  if (!hasProblems) return null

  const engaged = problemToggles.find((toggle) => toggle.active)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* The toolbar's shared filter trigger, same as „Filtry" and every filter on the transfers
            side: „(n)" for how many of its own filters are on, and the app's own active styling when
            one is. Only the tone and the triangle are this menu's — they are what the button says
            that the others don't. */}
        <FilterTriggerButton
          active={Boolean(engaged)}
          tone="destructive"
          icon={TriangleAlert}
          iconPosition="right"
          className="w-fit min-w-0"
        >
          {engaged ? 'Problemy (1)' : 'Problemy'}
        </FilterTriggerButton>
      </DropdownMenuTrigger>
      {/* „Pokaż pozycje ze zbyt wysoką stawką wykonawcy w widoku z narzędziami (1)" is a sentence, not
          a label: at the default width every row wrapped to three or four lines. */}
      <DropdownMenuContent align="end" className="w-80">
        {/* A poprawiona pozycja is held in place while it is being fixed, so something has to say
            „skończyłem, przelicz to teraz" — and that gesture is this, not toggling the problem off
            and on again to get the same effect sideways. Shown only while one is engaged, because
            with nothing narrowed there is nothing being held to release. */}
        {engaged && (
          <>
            <DropdownMenuItem onSelect={refreshProblemRows}>
              <RefreshCw />
              Odśwież — ukryj poprawione
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuLabel>Pokaż tylko to, co wymaga poprawki</DropdownMenuLabel>
        {problemToggles.map((toggle) => (
          <DropdownMenuItem
            key={toggle.id}
            onSelect={() => toggleConditionExclusive(toggle.id, allProblemIds())}
          >
            <Check className={cn('shrink-0', toggle.active ? 'opacity-100' : 'opacity-0')} />
            <span className="whitespace-normal">{toggle.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
