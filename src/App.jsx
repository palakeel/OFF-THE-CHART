import { useState, useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import TradeEntryPage from './pages/TradeEntryPage'
import DayViewPage from './pages/DayViewPage'
import TradeViewPage from './pages/TradeViewPage'
import TradeDetailPage from './pages/TradeDetailPage'
import ReportsPage from './pages/ReportsPage'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0f0f13]">
        <div className="text-[#00c9a7] text-xl">Loading...</div>
      </div>
    )
  }

  if (!session) return <Auth />

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout session={session} />}>
          <Route index                   element={<DashboardPage   session={session} />} />
          <Route path="add-trade"        element={<TradeEntryPage  session={session} />} />
          <Route path="day-view"         element={<DayViewPage     session={session} />} />
          <Route path="trades"           element={<TradeViewPage   session={session} />} />
          <Route path="trades/:id"       element={<TradeDetailPage session={session} />} />
          <Route path="trades/:id/edit"  element={<TradeEntryPage  session={session} />} />
          <Route path="reports"          element={<ReportsPage     session={session} />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
