import { Routes, Route } from 'react-router-dom'
import { UserProvider } from './contexts/UserContext'
import Layout from './components/Layout'
import RoleGuard from './components/RoleGuard'
import Dashboard from './components/Dashboard'
import TrackPage from './pages/TrackPage'
import ReducePage from './pages/ReducePage'
import ReusePage from './pages/ReusePage'
import ImpactPage from './pages/ImpactPage'
import NotFoundPage from './pages/NotFoundPage'

export default function App() {
  return (
    <UserProvider>
      <Routes>
        <Route element={<Layout />}>
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
    </UserProvider>
  )
}
