"use client"

import type { FormEvent } from 'react'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const result = await signIn('credentials', {
      username,
      password,
      redirect: false,
      callbackUrl: '/week'
    })

    if (!result || result.error) {
      setError('Invalid username or password.')
      setIsSubmitting(false)
      return
    }

    router.push(result.url ?? '/week')
    router.refresh()
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4 py-10">
      <section className="w-full rounded-xl border border-surface-border bg-surface-elevated p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
          Silicone Desert Golf League
        </p>
        <h1 className="mt-2 text-xl font-bold text-text-primary">Commissioner Login</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Sign in with the commissioner credentials seeded into the database.
        </p>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm text-text-secondary">
            Username
            <input
              aria-label="Username"
              className="mt-2 w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-text-primary outline-none"
              name="username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
          <label className="block text-sm text-text-secondary">
            Password
            <input
              aria-label="Password"
              className="mt-2 w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-text-primary outline-none"
              name="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error ? (
            <p className="rounded-md border border-danger bg-danger-dim px-3 py-2 text-sm text-danger-text">
              {error}
            </p>
          ) : null}
          <button
            className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
      </section>
    </main>
  )
}
