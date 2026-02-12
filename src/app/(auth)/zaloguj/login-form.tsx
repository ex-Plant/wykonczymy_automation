'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { loginAction } from '@/lib/auth/actions'

const loginSchema = z.object({
  email: z.string().email('Podaj prawidłowy adres email'),
  password: z.string().min(1, 'Hasło jest wymagane'),
})

export function LoginForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string>()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(undefined)

    const formData = new FormData(e.currentTarget)
    const raw = {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
    }

    const result = loginSchema.safeParse(raw)
    if (!result.success) {
      setError(result.error.issues[0].message)
      return
    }

    startTransition(async () => {
      const response = await loginAction(result.data)
      if (response.success) {
        router.push('/')
        router.refresh()
      } else {
        setError(response.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={isPending}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Hasło</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={isPending}
        />
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Button type="submit" disabled={isPending} className="mt-2">
        {isPending ? 'Logowanie...' : 'Zaloguj'}
      </Button>
    </form>
  )
}
