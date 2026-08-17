'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BUSINESS_TYPES, FOOD_DRINK_OPTIONS } from '@/data/brand-options'

export default function SignupPage() {
  const router = useRouter()
  const [brandName, setBrandName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [description, setDescription] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [foodDrinkType, setFoodDrinkType] = useState('')
  const [location, setLocation] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!brandName || !password || !confirmPassword) {
      setError('All fields are required')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_name: brandName,
          password,
          description,
          business_type: businessType,
          food_drink_type: foodDrinkType,
          location,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'Signup failed')
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
        <h1 className="mb-1 text-2xl font-bold text-gray-900">Create Account</h1>
        <p className="mb-6 text-sm text-gray-500">
          AI-powered content tools for food &amp; beverage operators.
        </p>

        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-gray-700">Account</h2>
            <div>
              <Label htmlFor="brand-name" className="text-xs">
                Brand Name
              </Label>
              <Input
                id="brand-name"
                placeholder="Your brand name"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                required
                className="mt-1 text-sm"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-xs">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 text-sm"
              />
            </div>

            <div>
              <Label htmlFor="confirm-password" className="text-xs">
                Confirm Password
              </Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="mt-1 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1 border-t pt-4">
            <h2 className="text-sm font-semibold text-gray-700">Brand Info</h2>
            <div>
              <Label htmlFor="description" className="text-xs">
                Description
              </Label>
              <Input
                id="description"
                placeholder="What's your brand about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 text-sm"
              />
            </div>

            <div>
              <Label htmlFor="business-type" className="text-xs">
                Business Type
              </Label>
              <select
                id="business-type"
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                required
                className="border-input bg-background mt-1 w-full rounded-md border px-2.5 py-1.5 text-sm"
              >
                <option value="">Select type</option>
                {BUSINESS_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="food-drink-type" className="text-xs">
                Food & Drink Type
              </Label>
              <select
                id="food-drink-type"
                value={foodDrinkType}
                onChange={(e) => setFoodDrinkType(e.target.value)}
                required
                className="border-input bg-background mt-1 w-full rounded-md border px-2.5 py-1.5 text-sm"
              >
                <option value="">Select type</option>
                {FOOD_DRINK_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="location" className="text-xs">
                Location
              </Label>
              <Input
                id="location"
                placeholder="e.g., Brooklyn, Downtown"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="mt-1 text-sm"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" disabled={loading} className="w-full cursor-pointer">
            {loading ? 'Creating account…' : 'Sign up'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <a
            href="/auth/login"
            className="font-medium text-gray-900 underline underline-offset-2 hover:text-gray-700"
          >
            Sign in
          </a>
        </p>
      </Card>
    </main>
  )
}
