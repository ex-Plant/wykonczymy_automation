import { useRef, useState } from 'react'
import { toastMessage } from '@/lib/utils/toast'
import { getRegisterBalance } from '@/lib/queries/register-balance'

export function useRegisterBalance() {
  const [registerBalance, setRegisterBalance] = useState<number | null>(null)
  const [isRegisterBalanceLoading, setIsRegisterBalanceLoading] = useState(false)
  const requestRef = useRef(0)

  async function fetchRegisterBalance(registerId: string) {
    if (!registerId) return resetRegisterBalance()

    const requestId = ++requestRef.current
    setRegisterBalance(null)
    setIsRegisterBalanceLoading(true)
    try {
      const result = await getRegisterBalance(Number(registerId))
      if (requestRef.current === requestId) setRegisterBalance(result.registerBalance)
    } catch {
      // A superseded request stays silent — its failure would toast over a newer successful load.
      if (requestRef.current === requestId) toastMessage('Nie udało się pobrać salda', 'error')
    } finally {
      if (requestRef.current === requestId) setIsRegisterBalanceLoading(false)
    }
  }

  function resetRegisterBalance() {
    // Bump the id so a fetch still in flight is disowned — otherwise its response repopulates the
    // balance of the register the user has just cleared. Disowning it also makes that request's own
    // `finally` a no-op, so the reset has to clear the loading flag itself or it pins forever.
    requestRef.current++
    setRegisterBalance(null)
    setIsRegisterBalanceLoading(false)
  }

  return { registerBalance, isRegisterBalanceLoading, fetchRegisterBalance, resetRegisterBalance }
}
