import { supabase } from '../lib/supabase'

export default function Dashboard({ session }) {
  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-[#0f0f13] flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-[#00c9a7] mb-2">Off The Chart</h1>
        <p className="text-[#888] mb-2">Welcome, {session.user.email}</p>
        <p className="text-[#555] text-sm mb-8">Dashboard coming in Phase 1</p>
        <button
          onClick={handleSignOut}
          className="bg-[#1a1a2e] border border-[#2d2d44] hover:border-[#00c9a7] text-[#888] hover:text-white rounded-lg px-6 py-2 text-sm transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}