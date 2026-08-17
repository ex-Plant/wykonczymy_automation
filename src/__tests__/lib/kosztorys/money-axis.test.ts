import { describe, expect, it } from 'vitest'

import { effectiveMoneyAxis } from '@/lib/kosztorys/money-axis'

describe('effectiveMoneyAxis', () => {
  it('honours the persisted pick in the client view', () => {
    expect(effectiveMoneyAxis('client', 'net')).toBe('net')
    expect(effectiveMoneyAxis('client', 'gross')).toBe('gross')
    expect(effectiveMoneyAxis('client', 'both')).toBe('both')
  })

  // Subcontractor work is paid without VAT (EX-558), so brutto has no meaning on those planes — the
  // lock holds even when the picker remembers 'gross' from the client view.
  it('locks to netto on both subcontractor planes', () => {
    expect(effectiveMoneyAxis('w_tools', 'gross')).toBe('net')
    expect(effectiveMoneyAxis('own_tools', 'both')).toBe('net')
  })

  // 'none' hides every money column — a picker state, not a reading. In the client view it would
  // leave the grid with no money at all, so it reads as 'both'.
  it('reads none as both under the client view', () => {
    expect(effectiveMoneyAxis('client', 'none')).toBe('both')
  })
})
