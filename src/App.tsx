import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import RoleGuard from './components/RoleGuard'
import LoginPage from './pages/LoginPage'
import Dashboard from './components/Dashboard'
import TrackPage from './pages/TrackPage'
import ReducePage from './pages/ReducePage'
import ReusePage from './pages/ReusePage'
import ImpactPage from './pages/ImpactPage'
import NotFoundPage from './pages/NotFoundPage'

// ── Auth gate: redirects to /login if not authenticated ──────
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, appUser, loading, authError } = useAuth()

  if (loading || (session && !appUser && !authError)) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-surface-500 mt-3">Loading…</p>
        </div>
      </div>
    )
  }

  if (authError && session && !appUser) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <p className="text-3xl mb-4">⚠️</p>
          <h2 className="text-lg font-semibold text-surface-800 mb-2">Profile Not Found</h2>
          <p className="text-sm text-surface-500 mb-4">{authError}</p>
          <p className="text-xs text-surface-400 mb-6">You are signed in, but your user profile could not be loaded from the database.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

// ── Public route: redirects to / if already logged in ────────
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) return null
  if (session) return <Navigate to="/" replace />

  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public: Login */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />

        {/* Protected: All app routes */}
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          {/* Common routes — both roles */}
          <Route path="/" element={<Dashboard />} />
          <Route path="/reuse" element={<ReusePage />} />
          <Route path="/impact" element={<ImpactPage />} />

          {/* Student-only routes */}
          <Route
            path="/track"
            element={
              <RoleGuard allowedRoles={['student']}>
                <TrackPage />
              </RoleGuard>
            }
          />

          {/* Eco Club-only routes */}
          <Route
            path="/reduce"
            element={
              <RoleGuard allowedRoles={['eco-club']}>
                <ReducePage />
              </RoleGuard>
            }
          />

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
