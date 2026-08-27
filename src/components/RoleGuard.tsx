import { Navigate } from 'react-router-dom'
import { useUser, type UserRole } from '../contexts/UserContext'

interface Props {
  allowedRoles: UserRole[]
  children: React.ReactNode
}

export default function RoleGuard({ allowedRoles, children }: Props) {
  const { role } = useUser()

  if (!allowedRoles.includes(role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
