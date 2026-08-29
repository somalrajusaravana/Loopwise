import { Navigate } from 'react-router-dom'
import { useAuth, type UserRole } from '../contexts/AuthContext'

interface Props {
  allowedRoles: UserRole[]
  children: React.ReactNode
}

export default function RoleGuard({ allowedRoles, children }: Props) {
  const { role } = useAuth()

  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
