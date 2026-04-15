import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase, getProfile } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const loadingRef = useRef(false) // Prevent double-load race condition
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    // onAuthStateChange é a fonte primária — getSession é apenas para estado inicial
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (!mountedRef.current) return
      setSession(sess)
      if (sess?.user) {
        loadProfile(sess.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    // getSession como fallback para estado inicial (não dispara onAuthStateChange em alguns browsers)
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!mountedRef.current) return
      // Só processar se onAuthStateChange ainda não setou
      if (!session && initialSession?.user) {
        setSession(initialSession)
        loadProfile(initialSession.user.id)
      } else if (!initialSession) {
        setLoading(false)
      }
    })

    return () => {
      mountedRef.current = false
      subscription.unsubscribe()
    }
  }, [])

  async function loadProfile(userId) {
    if (loadingRef.current) return // Evitar double-load
    loadingRef.current = true
    try {
      const p = await getProfile(userId)
      if (mountedRef.current) setProfile(p)
    } catch {
      if (mountedRef.current) setProfile(null)
    } finally {
      loadingRef.current = false
      if (mountedRef.current) setLoading(false)
    }
  }

  return (
    <AuthContext.Provider value={{
      session, profile, loading,
      isAdmin: profile?.role === 'admin',
      refresh: () => session && loadProfile(session.user.id)
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
