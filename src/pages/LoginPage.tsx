import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export default function LoginPage() {
  const { session } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // If already logged in, the router will redirect
  if (session) return null

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (!isSupabaseConfigured()) {
        setError('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.')
        setLoading(false)
        return
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (authError) {
        setError(authError.message === 'Invalid login credentials'
          ? 'Invalid email or password. Please try again.'
          : authError.message
        )
      }
      // onAuthStateChange in AuthContext will handle the redirect
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">
            <span className="text-brand-600">Loop</span>Wise
          </h1>
          <p className="text-sm text-surface-500 mt-1">
            Campus Sustainability Platform
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-surface-200 p-8">
          <h2 className="text-lg font-semibold text-surface-800 mb-1">
            Sign in to your account
          </h2>
          <p className="text-sm text-surface-400 mb-6">
            Enter your email and password to continue
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-surface-700 mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@university.edu"
                required
                autoComplete="email"
                className="w-full border border-surface-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-colors"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-surface-700 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                className="w-full border border-surface-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-colors"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email.trim() || !password}
              className="w-full bg-brand-600 text-white font-medium py-2.5 rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-surface-400 mt-6">
          Community-powered campus sustainability
        </p>
      </div>
    </div>
  )
}
