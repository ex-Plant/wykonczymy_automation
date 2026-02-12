import { LoginForm } from './login-form'

export default function LoginPage() {
  return (
    <div className="w-full max-w-sm px-4">
      <h1 className="text-foreground mb-6 text-center text-xl font-semibold">Zaloguj się</h1>
      <LoginForm />
    </div>
  )
}
