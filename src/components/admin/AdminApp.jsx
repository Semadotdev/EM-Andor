import { Route, Routes } from 'react-router-dom'
import AdminDashboard from './AdminDashboard.jsx'
import AdminLogin from './AdminLogin.jsx'

export default function AdminApp() {
  return (
    <Routes>
      <Route path="login" element={<AdminLogin />} />
      <Route path="*" element={<AdminDashboard />} />
    </Routes>
  )
}
