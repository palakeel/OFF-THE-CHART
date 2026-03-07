import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { TrendingUp } from 'lucide-react'

const INPUT_BASE = {
  width: '100%',
  background: '#0f0f0f',
  borderRadius: 8,
  padding: '12px 16px',
  color: '#e2e8f0',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
}

const LABEL_STYLE = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  color: '#555',
  marginBottom: 8,
}

export default function Auth() {
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)
  const [focusedField, setFocusedField] = useState(null)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f0f0f',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>

        {/* Brand */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 40 }}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: '#1a1a1a',
            border: '1px solid #1f1f1f',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
            boxShadow: '0 4px 24px rgba(0,0,0,0.4), 0 1px 8px rgba(0,201,167,0.1)',
          }}>
            <TrendingUp size={22} color="#00c9a7" />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', margin: 0, letterSpacing: '-0.3px' }}>
            Off The Chart
          </h1>
          <p style={{ color: '#3a3a3a', fontSize: 13, marginTop: 6 }}>Trading Journal</p>
        </div>

        {/* Card */}
        <div style={{
          background: '#1a1a1a',
          border: '1px solid #1f1f1f',
          borderRadius: 16,
          padding: '36px 32px 32px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 1px 4px rgba(0,201,167,0.06)',
        }}>
          <p style={{ fontSize: 14, color: '#666', margin: '0 0 28px 0' }}>
            Sign in to your account
          </p>

          <form onSubmit={handleLogin}>
            {/* Email */}
            <div style={{ marginBottom: 18 }}>
              <label style={LABEL_STYLE}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                required
                placeholder="you@example.com"
                style={{
                  ...INPUT_BASE,
                  border: `1px solid ${focusedField === 'email' ? '#00c9a7' : '#1f1f1f'}`,
                }}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 28 }}>
              <label style={LABEL_STYLE}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                required
                placeholder="••••••••"
                style={{
                  ...INPUT_BASE,
                  border: `1px solid ${focusedField === 'password' ? '#00c9a7' : '#1f1f1f'}`,
                }}
              />
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: 'rgba(233,69,96,0.08)',
                border: '1px solid rgba(233,69,96,0.2)',
                borderRadius: 8,
                padding: '11px 14px',
                color: '#e94560',
                fontSize: 13,
                marginBottom: 20,
              }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: '#00c9a7',
                color: '#000',
                fontWeight: 700,
                fontSize: 14,
                border: 'none',
                borderRadius: 8,
                padding: '13px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: 'opacity 0.15s',
                letterSpacing: '0.01em',
              }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: '#2a2a2a', fontSize: 12, marginTop: 24 }}>
          Personal use only
        </p>
      </div>
    </div>
  )
}
