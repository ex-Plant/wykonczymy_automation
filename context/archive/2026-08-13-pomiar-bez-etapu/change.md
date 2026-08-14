---
change_id: pomiar-bez-etapu
title: Rozjazd „Pomiar z natury" vs suma etapów — trwały podgląd i ręczna naprawa w aplikacji
status: archived
created: 2026-08-13
updated: 2026-08-14
archived_at: 2026-08-14T16:05:00Z
branch: pomiar-bez-etapu
worktree: ../wykonczymy-worktrees/pomiar-bez-etapu
---

## Notes

> Slug `pomiar-bez-etapu` pochodzi z pierwszego, **odrzuconego** pomysłu (syntetyczny etap-kubełek na
> różnicę). Zostaje jako identyfikator folderu — nic w tej zmianie takiego etapu nie tworzy.

Import z arkusza gubi pracę, którą właściciel odhaczył w „Pomiar z natury", ale której nie rozbił na
etapy. W modelu aplikacji Pomiar JEST sumą etapów (EX-494/EX-489), więc ta praca nie ma gdzie wylądować.

Dowody zebrane 2026-08-13 (odczyt formuł przez `scripts/inspect-sheet.mjs`):

| Arkusz                                | Pomiar jako formuła `=SUM(D:M)` | Pomiar > Σetap       | Pomiar < Σetap     |
| ------------------------------------- | ------------------------------- | -------------------- | ------------------ |
| kanoniczny (16 lipca, pusta oferta)   | 435 / 435                       | 0                    | 0                  |
| „wypełniony kosztorys do testów"      | 0 / 253                         | 27 poz. (+18 782 zł) | 3 poz. (−4 279 zł) |
| inwestycja 31 (11 listopada Gabinety) | 0 / 245                         | 32 poz. (+41 377 zł) | 0                  |

Formuła w kolumnie Pomiar przeżywa tylko w pustym arkuszu ofertowym — na którym budowany był model.
Każdy realnie wypełniony arkusz ma ją nadpisaną ręcznym wpisem, więc rozjazd to reguła, nie wyjątek.
**Ta sama obserwacja jest jednocześnie sygnałem, na którym stoi rozwiązanie**: formuła znaczy „nie ma
tu ręcznego pomiaru", wpis ręczny znaczy „arkusz twierdzi coś własnego".

Inwestycja 31 pokazuje to najczyściej: stopka arkusza niesie DWIE kwoty — „wartość netto" 508 196 zł
(suma `Pomiar × Cena j.m.`) i „R netto - suma prac wykonannych" 466 819 zł (`SUM(U:AD)`, czyli suma
wartości z etapów). Aplikacja liczy 466 819 zł, co do złotówki równe drugiej z nich. Różnica
41 377 zł siedzi w 32 pozycjach; w 30 z nich etapy są całkiem puste, a Pomiar wpisany (montaż
baterii, umywalek, syfonów, WC, grzejników, drzwi, gniazdek, lamp). W sekcji Podłogi to jedna
pozycja: „Posadzki z mikrocementu" — Pomiar 95, etapy 25 + 30 = 55, czyli 38 000 zł vs 22 000 zł.
Sam arkusz to widzi: kolumna bilans pokazuje tam 16 000 zł.

### Ustalony kształt (decyzje właściciela, 2026-08-13)

- **Liczba odniesienia przy pozycji, tylko do odczytu.** Import zapisuje ręcznie wpisany Pomiar
  z arkusza. Nie wchodzi do robocizny, marży ani rozliczeń z ekipami — jedyne zadanie to porównanie.
  Model bez zmian: suma etapów zostaje jedyną prawdą o pracy wykonanej.
- **Rozjazd wyliczany na żywo**, nie zapisywany. Lista kurczy się sama, gdy właściciel wpisuje ilości
  w etapy — „ta lista powinna być dynamiczna, żeby nie krzyczała o rozjeździe, którego już nie ma".
- **Stały podgląd, nie tylko przy imporcie.** „Naprawimy to w apce" — nie czekamy, aż właściciel
  poprawi arkusz.
- **Filtr wierszy „tylko rozjechane"** w siatce, żeby naprawiać na miejscu zamiast skakać między
  listą a kosztorysem.
- **Czerwony znacznik na rozjechanym wierszu**, z podpowiedzią niosącą obie liczby i kwotę różnicy.
- **Akcja „etapy są prawdą"** przy wierszu — czyści odniesienie tam, gdzie to arkusz się myli.
- **Ponowny import odtwarza odniesienia z arkusza**, więc wiersz odznaczony wraca, jeśli arkusz nadal
  twierdzi swoje.
- Wszystko wyłącznie dla właściciela — nigdy w podglądzie klienta.

Zarzut „dwie prawdy" (EX-494) nie stosuje się: zapisana liczba **niczego nie liczy**, więc nie
konkuruje z sumą etapów o bycie prawdą o pracy wykonanej.

### Odrzucone

- **Syntetyczny etap „Pomiar bez etapu"** na różnicę — decyzja właściciela: „zmieniamy w chuj model
  danych po to, żeby obsłużyć import starych arkuszy". Dodatkowo rozpoznanie wykazało, że kubełek
  trzymany jako zapisana ilość **nie opróżnia się sam**: dopisanie ilości do prawdziwego etapu nie
  zdejmuje jej z kubełka, więc suma etapów wychodzi ponad Pomiar.
- Przywrócenie „Pomiaru z natury" jako pola **liczącego** — wraca problem dwóch prawd, który model
  celowo wyciął.
- Doklejanie różnicy do ostatniego niepustego etapu — cicha, zła atrybucja (rozliczenie ekipy za
  pracę, której nie zrobiła).
- Blokowanie importu do czasu poprawy arkusza — w praktyce blokuje wszystko.
