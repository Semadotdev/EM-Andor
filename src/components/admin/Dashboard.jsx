import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { PageHeader } from '../shared/ui'
import AgentStats from './AgentStats.jsx'
import DashboardStats from './DashboardStats.jsx'

const AGENT_LINKS = [
  { to: '/admin/lots', title: 'Available Lots', description: 'Browse the lots you can sell.' },
  { to: '/admin/sales', title: 'My Sales', description: 'Track the lots you have sold.' },
  { to: '/admin/my-commissions', title: 'My Commissions', description: 'See what you have earned and been paid.' },
  { to: '/admin/downline', title: 'My Downline', description: 'View the agents under you.' },
]

export default function Dashboard() {
  const { agent, downline } = useOutletContext()
  const navigate = useNavigate()

  if (agent.role === 'admin') {
    return (
      <div>
        <PageHeader
          title="Dashboard"
          description="Portfolio, inquiries, and recent activity at a glance."
        />
        <DashboardStats onJumpToInquiries={() => navigate('/admin/inquiries')} />
      </div>
    )
  }

  const links = AGENT_LINKS.filter((item) => item.to !== '/admin/downline' || downline.length > 0)

  return (
    <div>
      <PageHeader title="Dashboard" description="Your sales, commissions, and team at a glance." />
      <AgentStats agent={agent} downlineCount={downline.length} />
      <div className="grid gap-4 sm:grid-cols-2">
        {links.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="rounded-lg border border-mist bg-white p-5 hover:border-brand/40"
          >
            <p className="font-display font-bold text-brand-deep">{item.title}</p>
            <p className="mt-1 text-sm text-ink/60">{item.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
