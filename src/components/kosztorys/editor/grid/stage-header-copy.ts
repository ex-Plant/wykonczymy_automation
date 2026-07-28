import { formatPLN } from '@/lib/utils/format-currency'

export const STAGE_HEADER_COPY = {
  planeSectionLabel: 'Rozliczenie',
  workerSectionLabel: 'Pracownik / ekipa',
  workerUnassigned: 'Bez przypisania',
  workerUnknown: 'nieznana osoba',
  workerNeedsPlane:
    'Najpierw wybierz rozliczenie etapu — bez niego etap nie ma ceny, więc nikomu nic nie nalicza.',
  planeUnconfirmed:
    'Wybierz jak rozliczać etap — do tego czasu ilości w tej kolumnie są zablokowane, bo nie weszłyby do rachunku żadnej ekipy.',
  renameAction: 'Zmień nazwę',
  removeAction: 'Usuń etap',
  removeConfirm: {
    title: (label: string) => `Usunąć „${label}"?`,
    description: 'Kolumna etapu i wszystkie wpisane w niej ilości zostaną usunięte.',
    confirmLabel: 'Usuń',
  },
  reassignConfirm: {
    title: (label: string) => `Przepisać „${label}" na inną osobę?`,
    description: (label: string, executedValue: number, from: string, to: string) =>
      `Etap „${label}" ma wykonane prace na ${formatPLN(executedValue)} przypisane do: ${from}. ` +
      `Przepisać na: ${to}? Kwota przejdzie do rozliczenia nowej osoby, a poprzedniej ` +
      `„pozostało do wypłaty" spadnie poniżej zera.`,
    confirmLabel: 'Przepisz',
  },
} as const
