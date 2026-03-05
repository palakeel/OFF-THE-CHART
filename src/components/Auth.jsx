import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f13]">
      <div className="w-full max-w-md px-8 py-10 bg-[#1a1a2e] rounded-2xl border border-[#2d2d44]">

        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <h1 className="text-2xl font-bold text-white tracking-wide">Off The Chart</h1>
          <p className="text-[#888] text-sm mt-1">Trading Journal</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm text-[#888] mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-[#0f0f13] border border-[#2d2d44] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00c9a7] transition-colors"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm text-[#888] mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-[#0f0f13] border border-[#2d2d44] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00c9a7] transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#00c9a7] hover:bg-[#00b896] disabled:opacity-50 text-black font-semibold rounded-lg px-4 py-3 text-sm transition-colors mt-2"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-[#555] text-xs mt-8">
          Off The Chart — Personal Trading Analytics
        </p>
      </div>
    </div>
  )
}