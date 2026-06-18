'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const router = useRouter()
  const [brandName, setBrandName] = useState(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('remembered_brand_name') || ''
  })
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (rememberMe) {
        localStorage.setItem('remembered_brand_name', brandName)
      } else {
        localStorage.removeItem('remembered_brand_name')
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_name: brandName, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'Login failed')
        return
      }

      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-sm p-8">
        <h1 className="mb-1 text-2xl font-bold text-gray-900">Welcome to DOTS</h1>
        <p className="mb-6 text-sm text-gray-500">
          AI-powered content tools for food &amp; beverage operators.
        </p>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <Label htmlFor="brand-name">Username</Label>
            <Input
              id="brand-name"
              placeholder="Enter your username"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              required
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="remember-me" className="mb-0 text-sm font-normal text-gray-500">
              Remember me
            </Label>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Don&apos;t have an account?{' '}
          <a
            href="/auth/signup"
            className="font-medium text-gray-900 underline underline-offset-2 hover:text-gray-700"
          >
            Sign up
          </a>
        </p>
      </Card>
    </main>
  )
}
