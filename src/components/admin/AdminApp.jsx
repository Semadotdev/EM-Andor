import { Navigate, Route, Routes, useOutletContext } from 'react-router-dom'
import AdminLayout from './AdminLayout.jsx'
import AdminLogin from './AdminLogin.jsx'
import AdminProjects from './AdminProjects.jsx'
import ProjectDetail from './ProjectDetail.jsx'
import AdminAgents from './AdminAgents.jsx'
import AdminCommissions from './AdminCommissions.jsx'
import AdminInquiries from './AdminInquiries.jsx'
import AdminNotifications from './AdminNotifications.jsx'
import AdminCMS from './AdminCMS.jsx'
import AdminActivityLog from './AdminActivityLog.jsx'
import AgentLots from './AgentLots.jsx'
import AgentSales from './AgentSales.jsx'
import AgentCommissions from './AgentCommissions.jsx'
import AgentDownline from './AgentDownline.jsx'

function RoleIndex() {
  const { agent } = useOutletContext()
  return <Navigate to={agent.role === 'admin' ? '/admin/projects' : '/admin/lots'} replace />
}

function AdminOnly({ children }) {
  const { agent } = useOutletContext()
  if (agent.role !== 'admin') return <Navigate to="/admin/lots" replace />
  return children
}

function AgentOnly({ children }) {
  const { agent } = useOutletContext()
  if (agent.role === 'admin') return <Navigate to="/admin/projects" replace />
  return children
}

export default function AdminApp() {
  return (
    <Routes>
      <Route path="login" element={<AdminLogin />} />
      <Route element={<AdminLayout />}>
        <Route index element={<RoleIndex />} />
        <Route path="projects" element={<AdminOnly><AdminProjects /></AdminOnly>} />
        <Route path="projects/:id" element={<AdminOnly><ProjectDetail /></AdminOnly>} />
        <Route path="agents" element={<AdminOnly><AdminAgents /></AdminOnly>} />
        <Route path="commissions" element={<AdminOnly><AdminCommissions /></AdminOnly>} />
        <Route path="inquiries" element={<AdminOnly><AdminInquiries /></AdminOnly>} />
        <Route path="notifications" element={<AdminOnly><AdminNotifications /></AdminOnly>} />
        <Route path="cms" element={<AdminOnly><AdminCMS /></AdminOnly>} />
        <Route path="activity" element={<AdminOnly><AdminActivityLog /></AdminOnly>} />
        <Route path="lots" element={<AgentOnly><AgentLots /></AgentOnly>} />
        <Route path="sales" element={<AgentOnly><AgentSales /></AgentOnly>} />
        <Route path="my-commissions" element={<AgentOnly><AgentCommissions /></AgentOnly>} />
        <Route path="downline" element={<AgentOnly><AgentDownline /></AgentOnly>} />
        <Route path="*" element={<RoleIndex />} />
      </Route>
    </Routes>
  )
}
