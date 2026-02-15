'use server'

import { redirect } from 'next/navigation'
import { login, logout } from '@payloadcms/next/auth'
import config from '@payload-config'

type LoginResultT = {
  success: boolean
  error?: string
}

export async function loginAction(data: {
  email: string
  password: string
}): Promise<LoginResultT> {
  try {
    await login({
      collection: 'users',
      config,
      email: data.email,
      password: data.password,
    })

    return { success: true }
  } catch {
    return { success: false, error: 'Nieprawidłowy email lub hasło' }
  }
}

export async function logoutAction(): Promise<never> {
  await logout({ config })
  redirect('/zaloguj')
}
