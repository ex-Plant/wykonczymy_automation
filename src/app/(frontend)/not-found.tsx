import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-foreground text-lg font-semibold">Nie znaleziono</h2>
      <p className="text-muted-foreground text-sm">Nie udało się znaleźć żądanego zasobu</p>
      <Link href="/" className="text-primary text-sm underline underline-offset-4 hover:opacity-80">
        Wróć na stronę główną
      </Link>
    </div>
  )
}
