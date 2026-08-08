import { useRef, useState } from 'react'
import { toastMessage } from '@/lib/utils/toast'
import { getRegisterSaldo } from '@/lib/queries/register-saldo'

export function useSaldo() {
  const [saldo, setSaldo] = useState<number | null>(null)
  const [isSaldoLoading, setIsSaldoLoading] = useState(false)
  const requestRef = useRef(0)

  async function fetchSaldo(registerId: string) {
    if (!registerId) return resetSaldo()

    const requestId = ++requestRef.current
    setSaldo(null)
    setIsSaldoLoading(true)
    try {
      const result = await getRegisterSaldo(Number(registerId))
      if (requestRef.current === requestId) setSaldo(result.saldo)
    } catch {
      // A superseded request stays silent — its failure would toast over a newer successful load.
      if (requestRef.current === requestId) toastMessage('Nie udało się pobrać salda', 'error')
    } finally {
      if (requestRef.current === requestId) setIsSaldoLoading(false)
    }
  }

  function resetSaldo() {
    // Bump the id so a fetch still in flight is disowned — otherwise its response repopulates the
    // saldo of the register the user has just cleared. Disowning it also makes that request's own
    // `finally` a no-op, so the reset has to clear the loading flag itself or it pins forever.
    requestRef.current++
    setSaldo(null)
    setIsSaldoLoading(false)
  }

  return { saldo, isSaldoLoading, fetchSaldo, resetSaldo }
}
