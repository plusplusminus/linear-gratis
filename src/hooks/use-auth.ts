'use client'
import { useAuth as useWorkOSAuth } from '@workos-inc/authkit-nextjs/components'

export function useAuth() {
  const { user, loading, signOut } = useWorkOSAuth()
  return { user, loading, signOut }
}
