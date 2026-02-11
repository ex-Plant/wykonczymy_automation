'use client'

import React from 'react'
import { NavigationBottom } from './navigation-bottom'
import { useTranslation } from '@/lib/i18n/hooks/use-translation'

export const Footer = () => {
  const { t } = useTranslation('footer')

  return (
    <footer className={`fest-container mt-auto mb-40 flex`}>
      <NavigationBottom leftText={t('newEditionComingSoon')} rightText={t('join')} href="#" />
    </footer>
  )
}
