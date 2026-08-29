import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import type { Session, User as SupabaseUser } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

// ── App User type (from our users table) ─────────────────────

export type UserRole = 'student' | 'eco-club'

export interface AppUser {
  id: string          // TEXT id like 'u-001'
  name: string
  email: string | null
  role: UserRole
  points: number
  authId: string      // UUID from auth.users
}

// ── Context type ─────────────────────────────────────────────

interface AuthContextValue {
  session: Session | null
  appUser: AppUser | null
  role: UserRole | null
  loading: boolean
  authError: string | null
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ── Provider ─────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [appUser, setAppUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const resolvingRef = useRef<string | null>(null)

  // Resolve app user from Supabase Auth user
  const resolveAppUser = useCallback(async (authUser: SupabaseUser) => {
    // Guard against duplicate concurrent resolutions for the same user
    if (resolvingRef.current === authUser.id) return
    resolvingRef.current = authUser.id

    if (!isSupabaseConfigured()) {
      // Mock mode: return a default student user
      setAppUser({
        id: 'u-001',
        name: 'Alex Chen',
        email: 'alex@loopwise.edu',
        role: 'student',
        points: 40,
        authId: authUser.id,
      })
      setLoading(false)
      return
    }

    // Look up app user by auth_id
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', authUser.id)
      .single()

    if (error || !data) {
      console.error('Failed to resolve app user:', error)
      setAuthError(
        'Could not load your user profile. Please check that RLS policies on the users table allow authenticated users to read.'
      )
      setAppUser(null)
      setLoading(false)
      resolvingRef.current = null
      return
    }

    setAuthError(null)
    setAppUser({
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role as UserRole,
      points: data.points,
      authId: authUser.id,
    })
    setLoading(false)
  }, [])

  // Initialize: check for existing session
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      // Mock mode: auto-login as student
      setSession(null)
      resolveAppUser({ id: 'mock-uuid', aud: 'authenticated' } as SupabaseUser)
      return
    }

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession)
      if (currentSession?.user) {
        resolveAppUser(currentSession.user)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession)
        if (newSession?.user) {
          resolveAppUser(newSession.user)
        } else {
          setAppUser(null)
          setLoading(false)
          resolvingRef.current = null
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [resolveAppUser])

  const signOut = useCallback(async () => {
    resolvingRef.current = null
    setAuthError(null)
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut()
    }
    setSession(null)
    setAppUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        session,
        appUser,
        role: appUser?.role ?? null,
        loading,
        authError,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// ── Hook ─────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

// ── Backward-compatible alias ────────────────────────────────
// Allows gradual migration: existing components can keep using useUser()
// until they're updated to use useAuth() directly.

export function useUser() {
  const { appUser, role, loading, signOut } = useAuth()
  return {
    role: role ?? 'student' as UserRole,
    setRole: () => {},  // No-op — role cannot be changed from frontend
    userName: appUser?.name ?? 'Loading...',
    userInitials: appUser?.name
      ? appUser.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
      : '..',
    userId: appUser?.id ?? '',
    loading,
    signOut,
  }
}
