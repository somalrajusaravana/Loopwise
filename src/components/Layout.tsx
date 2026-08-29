import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const STUDENT_NAV = [
  { to: '/', label: 'Dashboard', icon: '◉' },
  { to: '/track', label: 'Track', icon: '⊕' },
  { to: '/reuse', label: 'Reuse', icon: '♻️' },
  { to: '/impact', label: 'Impact', icon: '📈' },
]

const ECO_CLUB_NAV = [
  { to: '/', label: 'Dashboard', icon: '◉' },
  { to: '/reduce', label: 'Reduce', icon: '↓' },
  { to: '/reuse', label: 'Reuse', icon: '♻️' },
  { to: '/impact', label: 'Impact', icon: '📈' },
]

export default function Layout() {
  const { appUser, role, signOut } = useAuth()
  const navItems = role === 'student' ? STUDENT_NAV : ECO_CLUB_NAV
  const userName = appUser?.name ?? 'Loading...'
  const userInitials = appUser?.name
    ? appUser.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '..'
  const roleLabel = role === 'student' ? 'Student' : role === 'eco-club' ? 'Eco Club' : 'Loading…'

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 bg-surface-900 text-white flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-surface-700">
          <h1 className="text-lg font-bold tracking-tight">
            <span className="text-brand-400">Loop</span>Wise
          </h1>
          <p className="text-xs text-surface-400 mt-0.5">
            Campus Sustainability
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-600 text-white'
                    : 'text-surface-300 hover:bg-surface-800 hover:text-white'
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Sign Out */}
        <div className="px-3 py-3 border-t border-surface-700">
          <button
            onClick={signOut}
            className="w-full px-3 py-2 text-xs font-medium text-surface-400 hover:text-white hover:bg-surface-800 rounded-lg transition-colors"
          >
            Sign out
          </button>
        </div>

        {/* User Profile */}
        <div className="px-5 py-4 border-t border-surface-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-sm font-semibold">
              {userInitials}
            </div>
            <div>
              <p className="text-sm font-medium">{userName}</p>
              <p className="text-xs text-surface-400">
                {roleLabel}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        {/* Top Bar */}
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-surface-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-surface-400">
              Community-reported data — not exact measurements
            </p>
            <span className="text-xs bg-brand-50 text-brand-700 px-2.5 py-1 rounded-full font-medium">
              Round 1
            </span>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
