import { describe, expect, it } from 'vitest'
import { pluralize } from '@/lib/utils/polish-plural'

const sekcje = (count: number) => pluralize(count, ['sekcja', 'sekcje', 'sekcji'])

describe('pluralize', () => {
  it('takes the singular for 1', () => {
    expect(sekcje(1)).toBe('sekcja')
  })

  it('takes the paucal for 2-4', () => {
    expect([sekcje(2), sekcje(3), sekcje(4)]).toEqual(['sekcje', 'sekcje', 'sekcje'])
  })

  it('takes the genitive for 0 and 5+', () => {
    expect([sekcje(0), sekcje(5), sekcje(11)]).toEqual(['sekcji', 'sekcji', 'sekcji'])
  })

  // The trap the naive `last % 10 in 2..4` rule falls into: „22 sekcje" but „12 sekcji".
  it('keeps the teens genitive while their last digit says paucal', () => {
    expect([sekcje(12), sekcje(13), sekcje(14)]).toEqual(['sekcji', 'sekcji', 'sekcji'])
    expect([sekcje(22), sekcje(103)]).toEqual(['sekcje', 'sekcje'])
  })
})
