---
change_id: heic-upload-gap
title: Close the HEIC upload bypass, drop the AppFieldComponentsT mirror, backfill legacy HEIC media
status: implemented
created: 2026-08-25
updated: 2026-08-25
archived_at: null
branch: heic-upload-gap
worktree: null
---

## Notes

Zamknięcie ścieżki uploadu z pominięciem konwersji HEIC (edit-transfer-form), usunięcie ręcznego
mirrora AppFieldComponentsT, backfill 18 rekordów media image/heic → JPEG (najpierw staging, potem
prod).

### Skąd to wyszło

Audyt EX-394 (ostatni otwarty punkt: „Backfill existing HEIC media"). Prześledzenie wszystkich
powierzchni uploadu wykazało, że konwersja HEIC→JPEG (EX-457) jest **wyłącznie kliencka** —
`ingestFiles()` → `processUploadFile()`. Serwer nie konwertuje nic: `collections/media.ts` ma tylko
`sanitizeFileName`, a `upload.mimeTypes: ['image/*']` przepuszcza `image/heic`.

### Zakres — trzy rzeczy

1. **`edit-transfer-form.tsx` omija ingest.** Bierze surowe `fileRef.current.files` prosto do
   `resolveInvoicePageIds()` — bez konwersji, bez kompresji i **bez guardu 4 MB** (ten ostatni to
   `413 FUNCTION_PAYLOAD_TOO_LARGE`, nie do złapania w funkcji). Dziura jest na `origin/main`
   i na `staging`. Wpuściła `media.id = 1052` (`IMG_5259-e53451.HEIC`, 2,79 MB, faktura na
   `transactions.id = 3626`) **cztery dni po** wdrożeniu fixa na proda.
   Pozostałe powierzchnie (wydatek: pick/drop/per-wiersz/submit, komórka faktury w tabeli przelewów,
   przegląd pojazdu) ingestują poprawnie.

2. **`AppFieldComponentsT` — ręczny mirror.** `form-types.ts` powtarza ręcznie listę komponentów
   zarejestrowanych w `form-hooks.ts`; 58 adnotacji w 14 plikach. Nic nie łączy obu list.
   Zmierzone zachowanie: mirror z **nadmiarowym** wpisem wywala każdy anotowany call site (to
   wysypało kasowanie `FileInput`), ale **brakujący wpis lub błędny typ propsa** łapie się wyłącznie
   przez realne użycie — a w anotowanym call site to **mirror wygrywa z prawdziwym komponentem**.
   Adnotacja jest zbędna: zdjęta w całości z `worker-form.tsx` → `tsc` przechodzi, TanStack
   wnioskuje `field` sam.

3. **Backfill 18 rekordów `image/heic`.** Najpierw staging, potem — po weryfikacji — prod.

### Świadomie POZA zakresem

- Panel `/admin` Payloada i `POST /api/media` — obie omijają konwersję (kod Payloada, nie da się tego
  załatać po stronie klienta; wymagałoby konwersji serwerowej w hooku kolekcji). Decyzja
  właściciela: olewamy.

### Ustalenia, które trzeba znać przy backfillu

- **`sharp` w tym repo nie dekoduje HEIC.** `libvips 8.17.3`, `heif input fileSuffix: ['.avif']` —
  sam AVIF, brak HEVC. Dlatego 18/18 rekordów ma `width/height = NULL` i zero miniatur (dla
  porównania: 617/617 JPEG-ów ma jedno i drugie). Narzędzie do backfillu **nie może** opierać się
  na `sharp` — trzeba czegoś z obsługą HEVC (`sips` na macOS, `heif-convert`, ImageMagick +
  libheif).
- **Optymalizator Next to dla HEIC passthrough.** Zmierzone curl-em:
  `/_next/image?...IMG_5259-e53451.HEIC&w=1080&q=50` → `Content-Type: image/heic`, 2 794 830 B —
  bajt w bajt oryginał. Do tego `invoice-preview-button.tsx:51` przekazuje `unoptimized`
  (EX-455, `0edbb4a7`), więc podgląd i tak serwuje surowy plik.
- **Wniosek: pliki NIE są nieczytelne.** Przeglądarka dekoduje je sama, jeśli OS ma kodek (Kometa/
  Chromium na macOS — potwierdzone zrzutem). Uzasadnieniem backfillu jest więc **waga (2,79 MB na
  każde otwarcie, `quality`/`sizes` martwe) i brak miniatur**, a nie ratowanie nieczytelnych faktur.
- Rozkład dat: 17 szt. do 2026-07-06 (przed fixem) + 1 szt. 2026-07-17 (przez dziurę #1).

### Odłożone

- **E2E dla dziury #1 — EX-732** (label `e2e-backlog`): pick HEIC w dialogu edycji przelewu → zapis →
  wiersz `media` ma `image/jpeg`. Szew, który pękł, to przeglądarka → `/api/upload-file`; żaden test
  jednostkowy go nie przechodzi.
