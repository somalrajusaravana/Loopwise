import { createContext, useContext, useState, type ReactNode } from 'react'

export type UserRole = 'student' | 'eco-club'

interface UserContextValue {
  role: UserRole
  setRole: (role: UserRole) => void
  userName: string
  userInitials: string
}

const UserContext = createContext<UserContextValue | null>(null)

const ROLE_CONFIG: Record<UserRole, { name: string; initials: string }> = {
  student: { name: 'Alex Chen', initials: 'AC' },
  'eco-club': { name: 'Eco Club', initials: 'EC' },
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>('student')
  const config = ROLE_CONFIG[role]

  return (
    <UserContext.Provider
      value={{
        role,
        setRole,
        userName: config.name,
        userInitials: config.initials,
      }}
    >
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser must be used within UserProvider')
  return ctx
}
