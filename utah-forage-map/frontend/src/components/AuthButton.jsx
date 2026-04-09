import { useAuth0 } from '@auth0/auth0-react'
import { useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function AuthButton() {
  const { loginWithPopup, logout, user, isAuthenticated, getAccessTokenSilently } = useAuth0()

  // Sync user record to our backend on every login
  useEffect(() => {
    if (!isAuthenticated) return
    ;(async () => {
      try {
        const token = await getAccessTokenSilently()
        await fetch(`${API_URL}/api/v1/users/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: token }),
        })
      } catch (e) {
        console.error('User sync failed:', e)
      }
    })()
  }, [isAuthenticated, getAccessTokenSilently])

  if (isAuthenticated && user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {user.picture && (
          <img
            src={user.picture}
            alt={user.name}
            style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
          />
        )}
        <span style={{ fontSize: 13, color: '#374151', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.name}
        </span>
        <button
          onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
          style={{
            fontSize: 12, padding: '4px 10px',
            background: '#f3f4f6', border: '1px solid #d1d5db',
            borderRadius: 6, cursor: 'pointer', color: '#374151',
          }}
        >
          Sign out
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => loginWithPopup()}
      style={{
        fontSize: 13, padding: '6px 14px',
        background: '#3b82f6', color: '#fff', border: 'none',
        borderRadius: 6, cursor: 'pointer', fontWeight: 500,
      }}
    >
      Sign in
    </button>
  )
}
