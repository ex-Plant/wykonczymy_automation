// Formula tips for the investments listing headers, mirroring the kosztorys grid's `HEADER_TIPS`:
// each money column says out loud which terms it adds and where they come from, because the same
// noun („robocizna", „rabat") names a different number on each plane and the listing shows both.
const FROM_TRANSACTIONS = 'Robocizna i rabat z transferów (v1).'
const FROM_KOSZTORYS = 'Robocizna i rabat z kosztorysu (v2) — bez kosztorysu „brak danych".'

// Wpłaty, materiały, wypłaty, strata i wydatki rozliczone są transakcyjne na OBU planach, więc
// bilans i marża różnią się między v1 a v2 wyłącznie parą robocizna/rabat.
const BALANCE = 'Wpłaty − materiały − robocizna + rabat + obniżka materiałów + strata.'

export const INVESTMENT_HEADER_TIPS: Record<string, string> = {
  totalCostsFromTransactions: `Materiały + robocizna (przed rabatem).\n${FROM_TRANSACTIONS}`,
  totalCosts: `Materiały + robocizna (przed rabatem).\n${FROM_KOSZTORYS}`,
  balanceFromTransactions: `${BALANCE}\n${FROM_TRANSACTIONS}\nNa minusie = inwestor jest winien firmie.`,
  balance: `${BALANCE}\n${FROM_KOSZTORYS}\nNa minusie = inwestor jest winien firmie.`,
  balanceGross: `Bilans netto v2 − VAT × (robocizna − rabat).\nVAT jedzie wyłącznie po pracach i po pracach po rabacie — złotówka zrabatowana nigdy nie była zafakturowana. Strata schodzi w wartości nominalnej, już w bilansie netto, i nie poszerza podstawy VAT.`,
  margin: `Robocizna − wypłaty − rabat − strata − wydatki wliczone w robociznę − obniżka materiałów.\n${FROM_TRANSACTIONS}`,
  marginV2: `Robocizna − rabat − należne ekipom − wydatki wliczone w robociznę − strata.\n${FROM_KOSZTORYS}\nZamiast wypłat wchodzi to, co ekipom się NALEŻY za rozpisane etapy: gotówka chodzi swoim rytmem, więc ekipa zapłacona z opóźnieniem czytałaby się jako zysk. Obniżki materiałów tu nie ma — to ustępstwo na przelotowym koszcie, nie koszt wykonania pracy.\n„ustaw etapy" = któryś etap ma wykonaną pracę bez rozliczenia, więc kwota jest nieznana, a nie zerowa.`,
  laborCostsFromTransactions:
    'Σ transferów typu „Robocizna", przed rabatem.\nTutaj zostaje robocizna zaksięgowana transferami, dopóki ta praca nie trafi do kosztorysu.',
  laborCostsFromKosztorys:
    'Σ wartości prac wykonanych w kosztorysie, w cenie dla inwestora, przed rabatem.\nKosztorys jest jedynym źródłem — brak kosztorysu to odpowiedź „nic nie wpisano", a nie pytanie przekierowane do transferów.',
  totalInvestmentExpense:
    'Materiały, którymi obciążany jest inwestor: paragon brutto ÷ (1 + stawka netto materiałów).\nBez zapisanej stawki — sam paragon, bez przeliczania.',
  totalSettled:
    'Σ wydatków oznaczonych „rozliczone" — firma je kupiła, ale są już w cenie robocizny, więc inwestor nie płaci ich osobno. Obniżają marżę i nie wchodzą do bilansu.',
  totalPayouts: 'Σ transferów typu „Wypłata" — gotówka faktycznie wypłacona ekipom.',
}
