import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { LayoutDashboard, Plus, CalendarDays, BarChart2, LogOut, TrendingUp, ChevronLeft, ChevronRight, Table2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

const NAV = [
  { to: '/',         icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/add-trade', icon: Plus,           label: 'Add Trade' },
  { to: '/trades',   icon: Table2,          label: 'Trades' },
  { to: '/day-view', icon: CalendarDays,    label: 'Day View' },
  { to: '/reports',  icon: BarChart2,       label: 'Reports' },
]

export default function Layout({ session }) {
  const [collapsed, setCollapsed] = useState(false)

  const handleSignOut = () => supabase.auth.signOut()

  return (
    <div className="flex bg-[#0f0f0f]" style={{ height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside
        className="flex-shrink-0 flex flex-col transition-all duration-200 ease-in-out"
        style={{
          width: collapsed ? 64 : 220,
          background: '#1a1a1a',
          borderRight: '1px solid #1f1f1f',
        }}
      >
        {/* Brand */}
        <div
          className="flex items-center transition-all duration-200"
          style={{
            padding: collapsed ? '20px 0' : '18px 16px 18px 20px',
            justifyContent: collapsed ? 'center' : 'space-between',
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#0f0f0f] border border-[#1f1f1f] flex items-center justify-center">
              <TrendingUp size={14} className="text-[#00c9a7]" />
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <div className="text-[13px] font-bold text-white leading-tight whitespace-nowrap">Off The Chart</div>
                <div className="text-[10px] text-[#444] whitespace-nowrap">Trading Journal</div>
              </div>
            )}
          </div>

          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              title="Collapse sidebar"
              className="flex-shrink-0 flex items-center justify-center rounded-md transition-colors text-[#333] hover:text-[#888]"
              style={{ width: 26, height: 26, background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <ChevronLeft size={14} />
            </button>
          )}
        </div>

        <div className="h-px bg-[#1f1f1f]" />

        {/* Nav */}
        <nav className="flex-1" style={{ padding: collapsed ? '10px 0' : '10px 8px' }}>
          {collapsed && (
            <button
              onClick={() => setCollapsed(false)}
              title="Expand sidebar"
              className="flex items-center justify-center w-full transition-colors text-[#333] hover:text-[#888]"
              style={{ height: 36, background: 'transparent', border: 'none', cursor: 'pointer', marginBottom: 4 }}
            >
              <ChevronRight size={14} />
            </button>
          )}
          {NAV.map(({ to, icon: Icon, label, end, disabled }) => {
            if (disabled) {
              return (
                <div
                  key={to}
                  title={collapsed ? label : undefined}
                  className="flex items-center gap-3 rounded-lg cursor-not-allowed"
                  style={{
                    padding: collapsed ? '10px 0' : '10px 12px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    color: '#2a2a2a',
                  }}
                >
                  <Icon size={16} className="flex-shrink-0" />
                  {!collapsed && <span className="text-sm whitespace-nowrap">{label}</span>}
                </div>
              )
            }
            return (
              <NavLink
                key={to}
                to={to}
                end={end}
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg transition-colors ${
                    isActive ? 'text-[#00c9a7]' : 'text-[#555] hover:text-[#e2e8f0]'
                  }`
                }
                style={({ isActive }) => ({
                  padding: collapsed ? '10px 0' : '10px 12px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  background: isActive ? 'rgba(0,201,167,0.08)' : 'transparent',
                  marginBottom: 2,
                })}
              >
                <Icon size={16} className="flex-shrink-0" />
                {!collapsed && <span className="text-sm whitespace-nowrap">{label}</span>}
              </NavLink>
            )
          })}
        </nav>

        <div className="h-px bg-[#1f1f1f]" />

        {/* User / sign out */}
        <div style={{ padding: collapsed ? '12px 0' : '12px 8px' }}>
          {!collapsed && (
            <div className="text-[11px] text-[#333] truncate mb-1" style={{ padding: '0 12px' }}>
              {session.user.email}
            </div>
          )}
          <button
            onClick={handleSignOut}
            title={collapsed ? 'Sign out' : undefined}
            className="flex items-center gap-3 w-full rounded-lg text-[#666] hover:text-[#e2e8f0] transition-colors"
            style={{
              padding: collapsed ? '10px 0' : '10px 12px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <LogOut size={15} className="flex-shrink-0" />
            {!collapsed && <span className="text-sm whitespace-nowrap">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-[#0f0f0f]" style={{ overflowY: 'auto', height: '100vh' }}>
        <Outlet />
      </main>
    </div>
  )
}
