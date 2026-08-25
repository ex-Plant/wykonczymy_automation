---
change_id: kosztorys-decimal-cell-draft
title: One edit contract for every numeric kosztorys cell — draft, settle on blur, roll back with a toast
status: implementing
created: 2026-08-25
updated: 2026-08-25
branch: heic-upload-gap
archived_at: null
worktree: null
---

## Notes

Jeden kontrakt edycji dla wszystkich komórek liczbowych w gridzie kosztorysu: **draft w trakcie
pisania → zatwierdzenie na blur → wartość odrzucona wraca i mówi o tym toastem.**

1. Wyciągnąć generyczny `useCellDraft` z `useOverrideEdit`
   (`src/components/kosztorys/editor/grid/cells/subcontractor-columns.tsx:117`), który dziś spawa
   trzy rzeczy: cykl draft/settle/rollback, parę pól override i guard od ceny. Ogólny jest tylko
   pierwszy — obie komórki wykonawcy zostają przy swoim guardzie, ich zachowanie się nie rusza.
2. Przenieść na niego „Rabat wart." (`cells/discount-columns.tsx:38`). Dziś to input
   **kontrolowany**, zatwierdzający każdy klawisz: `12,` parsuje się na 12 (`Number('12.')`),
   zapisuje 12, React resetuje DOM do „12", przecinek znika i następna cyfra się dokleja —
   **12,5 zapisuje się jako 125**. W tę komórkę nie da się wpisać żadnego ułamka.
3. Przenieść na niego „Cena j.m." (widok Inwestor), „Przedmiar" i „ilość" per etap. Dziś używają
   `decimalColumn`, gdzie `parseUserInput` dostaje sam string i nie widzi podmienianej wartości —
   nie ma jak powiedzieć „odrzuć i zostaw stare", więc niedokończony wpis („-") czyści komórkę.

Uwaga na EX-422: komponent komórki musi mieć stabilną tożsamość na poziomie modułu, wszystko przez
`columnData` — inline `component:` to nowy typ przy każdym renderze, dsg remountuje komórkę i gubi
wpisany tekst. Grid potrafi mieć 1000+ wierszy, więc krok 3 dotyka najgęściej klikanych komórek.

Zmiana leci na **istniejącym branchu `heic-upload-gap`**, bez worktree.

### Skąd to wyszło

Zgłoszenie: „przecinek nie działa, a kropka zamienia się w przecinek w komórkach". Przyczyna —
gotowa kolumna `floatColumn` z react-datasheet-grid: `parseFloat('12,5')` = 12 (zatrzymuje się na
przecinku i zwraca prefiks zamiast błędu), a `new Intl.NumberFormat()` bez argumentu locale
renderuje w locale przeglądarki, czyli komórka pokazywała separator, którego nie przyjmowała.

Naprawione osobno, poza tą zmianą (`decimalColumn` w
`src/components/ui/datasheet-grid/decimal-column.ts` + spec) — zostały dwie dziury z listy powyżej,
które wymagają draftu, a nie lepszego parsera.
