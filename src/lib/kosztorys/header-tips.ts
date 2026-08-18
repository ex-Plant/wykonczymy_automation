import {
  STAGE_VALUE_GROSS_COLUMN_GROUP,
  STAGE_VALUE_NET_COLUMN_GROUP,
} from '@/lib/kosztorys/stage-keys'

// calc.ts `netForQtyForView` applies the rabat in the client view only — without saying so, a reader
// assumes a discount flows down to the subcontractor bill.
const DISCOUNT_IS_CLIENT_ONLY =
  'Rabat dotyczy wyłącznie ceny dla inwestora — nie obniża cen robocizny dla ekip. W widokach „Z narzędziami" i „Bez narzędzi" kwoty są zawsze przed rabatem.'

// Audit aid (may be temporary): each header explains the column's intent + the formula that
// drives it, so mismatches between intent and calc are visible.
export const HEADER_TIPS: Record<string, string> = {
  plannedQty: 'Przedmiar — ilość planowana',
  // The only column whose editor doesn't look like its cell: the overlay is invisible until you open
  // it, and Shift+Enter is unguessable — nothing on screen says the newline isn't Enter.
  note: 'Naciśnij enter lub kliknij dwukrotnie aby otworzyć.\n\nShift+Enter — nowa linia\nEnter — zapisz i przejdź niżej\nEscape — cofnij zmiany\nTab — zakończ edycję',
  stageQtySum:
    'Pomiar — ilość faktycznie wykonana.\nSuma ilości z etapów widocznych w tym widoku: w „Inwestorze" ze wszystkich, w widoku ekipy tylko z etapów rozliczanych z tą ekipą.',
  divergence:
    'Różnica między „Pomiarem z natury" z arkusza Google a sumą etapów rozpisanych w tej aplikacji.\nNa plusie = arkusz Google pokazuje więcej, niż rozpisano tutaj na etapy.',
  priceCoeff:
    '1 = tyle co Cena dla inwestora \n 0.65 = 65% ceny dla inwestora · 1.2 = 120% ceny dla inwestora.\n\nSzary kursywą = dziedziczony (z sekcji lub domyślny z inwestycji). Wpisanie własnego przestawia wiersz na „własny mnożnik".\n„—" Kwota stała, mnożnik się nie stosuje',
  priceMode: 'Auto = mnożnik dziedziczony - domyślny z inwestycji lub ustawiony dla danej sekcji.',
  discountType: `Rabat — typ rabatu: — brak · % procent · zł kwota.\nUstawienie „Bez rabatu" czyści też Rabat wart.\n\n${DISCOUNT_IS_CLIENT_ONLY}`,
  discountAmount: `Rabat kwota netto — ile złotych faktycznie schodzi z tej pozycji (Pomiar × Cena j.m. − Netto).\nPrzy rabacie % przelicza punkty procentowe na złotówki; przy rabacie zł jest równy wpisanej kwocie.\n\n${DISCOUNT_IS_CLIENT_ONLY}`,
  plannedNet: 'Przedmiar × Cena − Rabat.',
  plannedGross: '(Przedmiar × Cena − Rabat) × (1 + VAT).',
  net: `Pomiar × Cena − Rabat.\n\n${DISCOUNT_IS_CLIENT_ONLY}`,
  gross: `(Pomiar × Cena − Rabat) × (1 + VAT).\n\n${DISCOUNT_IS_CLIENT_ONLY}`,
  remaining:
    'Wartość przedmiaru − wartość netto pomiaru.\nIle z oferty nie zostało jeszcze wykonane.\nNa minusie = przekroczono przedmiar.\n„—" = pozycja nie ma przedmiaru.',
  remainingGross:
    'Wartość przedmiaru − wartość pomiaru, brutto = netto × (1 + VAT).\nIle z oferty nie zostało jeszcze wykonane.\nNa minusie = przekroczono przedmiar.\n„—" = pozycja nie ma przedmiaru.',
  donePercent:
    '% wykonania względem przedmiaru.\nIle procent oferty jest zrobione.\n„—" = brak przedmiaru. Powyżej 100% oznacza przekroczenie założeń z przedmiaru.',
  // The stage-VALUE axes key by column GROUP, not by column id — every stage's column shares
  // its axis's tip, because the only thing that differs between them is the stage's name. The etap
  // ilość header itself carries no tip (etap is self-evident, and it would fight the plane warning).
  [STAGE_VALUE_NET_COLUMN_GROUP]: `Ilość wykonana w tym etapie × cena j.m. − udział etapu w rabacie.\nUdział jest proporcjonalny do ilości (rabat zł jest rabatem od całego wiersza, więc etap niesie tylko swoją część).\nZależy od aktywnego widoku cen.\n\n${DISCOUNT_IS_CLIENT_ONLY}`,
  [STAGE_VALUE_GROSS_COLUMN_GROUP]: 'Etap — kwota brutto = Etap — kwota netto × (1 + VAT).',
}
