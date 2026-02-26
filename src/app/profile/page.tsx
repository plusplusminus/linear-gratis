'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { encryptTokenClient, decryptTokenClient } from '@/lib/client-encryption'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
  const { user, signOut, loading: authLoading } = useAuth()
  const [linearToken, setLinearToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [syncStatus, setSyncStatus] = useState<{
    connected: boolean
    issueCount: number
    commentCount: number
    teamCount: number
    projectCount: number
    initiativeCount: number
    lastSyncedAt: string | null
    subscription: { id: string; teamId: string; createdAt: string } | null
  } | null>(null)
  const [syncLoading, setSyncLoading] = useState(false)
  const [resyncLoading, setResyncLoading] = useState(false)
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const router = useRouter()

  const loadProfile = useCallback(async () => {
    if (!user) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('linear_api_token')
        .eq('id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error loading profile:', error)
      } else if (data?.linear_api_token) {
        try {
          const decryptedToken = await decryptTokenClient(data.linear_api_token)
          setLinearToken(decryptedToken)
        } catch (error) {
          console.error('Error decrypting token:', error)
          setMessage({ type: 'error', text: 'Error loading saved token. Please re-enter your token.' })
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  const loadSyncStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/sync/subscribe')
      if (res.ok) {
        const data = await res.json() as typeof syncStatus
        setSyncStatus(data)
      }
    } catch (error) {
      console.error('Error loading sync status:', error)
    }
  }, [])

  const toggleSync = async () => {
    setSyncLoading(true)
    setSyncMessage(null)
    try {
      if (syncStatus?.connected) {
        const res = await fetch('/api/sync/subscribe', { method: 'DELETE' })
        if (res.ok) {
          setSyncMessage({ type: 'success', text: 'Sync disconnected.' })
          await loadSyncStatus()
        } else {
          const data = await res.json() as { error?: string }
          setSyncMessage({ type: 'error', text: data.error || 'Failed to disconnect.' })
        }
      } else {
        const res = await fetch('/api/sync/subscribe', { method: 'POST' })
        if (res.ok) {
          setSyncMessage({ type: 'success', text: 'Sync enabled! Your Linear data will start syncing shortly.' })
          await loadSyncStatus()
        } else {
          const data = await res.json() as { error?: string }
          setSyncMessage({ type: 'error', text: data.error || 'Failed to enable sync.' })
        }
      }
    } catch (error) {
      setSyncMessage({ type: 'error', text: 'Something went wrong.' })
      console.error('Error toggling sync:', error)
    } finally {
      setSyncLoading(false)
    }
  }

  const resync = async () => {
    setResyncLoading(true)
    setSyncMessage(null)
    try {
      const res = await fetch('/api/sync/initial', { method: 'POST' })
      const data = await res.json() as {
        success?: boolean
        error?: string
        issueCount?: number
        commentCount?: number
        teamCount?: number
        projectCount?: number
        initiativeCount?: number
      }
      if (res.ok && data.success) {
        const parts = []
        if (data.issueCount) parts.push(`${data.issueCount} issues`)
        if (data.commentCount) parts.push(`${data.commentCount} comments`)
        if (data.teamCount) parts.push(`${data.teamCount} teams`)
        if (data.projectCount) parts.push(`${data.projectCount} projects`)
        if (data.initiativeCount) parts.push(`${data.initiativeCount} initiatives`)
        setSyncMessage({ type: 'success', text: `Synced ${parts.join(', ')}.` })
        await loadSyncStatus()
      } else {
        setSyncMessage({ type: 'error', text: data.error || 'Sync failed.' })
      }
    } catch (error) {
      setSyncMessage({ type: 'error', text: 'Something went wrong.' })
      console.error('Error re-syncing:', error)
    } finally {
      setResyncLoading(false)
    }
  }

  useEffect(() => {
    if (authLoading) return // Wait for auth to finish loading

    if (!user) {
      router.push('/login')
      return
    }

    // Load existing token and sync status
    loadProfile()
    loadSyncStatus()
  }, [user, authLoading, router, loadProfile, loadSyncStatus])

  const saveProfile = async () => {
    if (!user) return

    setSaving(true)
    setMessage(null)

    try {
      let encryptedToken = null
      if (linearToken) {
        try {
          encryptedToken = await encryptTokenClient(linearToken)
        } catch (error) {
          setMessage({ type: 'error', text: 'Failed to encrypt token. Please try again.' })
          console.error('Error encrypting token:', error)
          setSaving(false)
          return
        }
      }

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email!,
          linear_api_token: encryptedToken,
          updated_at: new Date().toISOString()
        })

      if (error) {
        setMessage({ type: 'error', text: 'Failed to save profile. Please try again.' })
        console.error('Error saving profile:', error)
      } else {
        setMessage({ type: 'success', text: 'Profile saved successfully!' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save profile. Please try again.' })
      console.error('Error saving profile:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Loading...</h2>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Loading...</h2>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Profile settings</h1>
          <Button variant="outline" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Account information</CardTitle>
            <CardDescription>
              Your account details and preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email address</Label>
              <Input value={user.email || ''} disabled />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Linear integration</CardTitle>
            <CardDescription>
              Connect your Linear workspace to start collecting customer feedback directly in your issues.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading && (
              <div className="text-center py-4">
                <p className="text-gray-600">Loading profile...</p>
              </div>
            )}

            {!loading && (
              <>
                {/* Instructions */}
                <div className="bg-muted/50 rounded-lg p-4 border border-border/50">
                  <h3 className="font-semibold mb-3">How to get your Linear API token:</h3>
                  <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                    <li>
                      <span className="font-medium">Open Linear</span> and go to{' '}
                      <span className="bg-muted px-2 py-1 rounded text-xs font-mono">Settings → API</span>
                    </li>
                    <li>
                      <span className="font-medium">Click &quot;Create personal API key&quot;</span>
                    </li>
                    <li>
                      <span className="font-medium">Give it a name</span> like &quot;Linear Integration&quot; or &quot;Customer Feedback&quot;
                    </li>
                    <li>
                      <span className="font-medium">Copy the generated token</span> and paste it below
                    </li>
                  </ol>
                  <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800/30 rounded text-xs text-yellow-800 dark:text-yellow-400">
                    <strong>Important:</strong> Keep this token secure. It provides access to your Linear workspace.
                  </div>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); saveProfile(); }} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="linear-token">Linear API token</Label>
                    <Input
                      id="linear-token"
                      type="password"
                      placeholder={linearToken ? "Token is configured" : "Paste your Linear API token here"}
                      value={linearToken}
                      onChange={(e) => setLinearToken(e.target.value)}
                      autoComplete="current-password"
                    />
                    <p className="text-sm text-muted-foreground">
                      This token will be encrypted and stored securely. It&apos;s used to create customer requests in your Linear workspace.
                    </p>
                  </div>

                  {message && (
                    <div className={`p-3 rounded-lg text-sm ${
                      message.type === 'success'
                        ? 'bg-green-50 border border-green-200 text-green-800 dark:bg-green-950/20 dark:border-green-800/30 dark:text-green-400'
                        : 'bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/20 dark:border-red-800/30 dark:text-red-400'
                    }`}>
                      {message.text}
                      {message.type === 'success' && (
                        <div className="mt-2">
                          <Button variant="link" className="h-auto p-0 text-sm" onClick={() => router.push('/')}>
                            → Go to Linear integration
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={saving || !linearToken.trim()}
                    className="w-full"
                  >
                    {saving ? 'Saving token...' : linearToken ? 'Save Linear token' : 'Enter token to continue'}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Data sync</CardTitle>
                <CardDescription>
                  Sync your Linear issues and comments to enable faster loading and offline access.
                </CardDescription>
              </div>
              {syncStatus && (
                <Badge variant={syncStatus.connected ? 'default' : 'secondary'}>
                  {syncStatus.connected ? 'Connected' : 'Disconnected'}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {syncStatus?.connected && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-muted/50 rounded-lg p-3 border border-border/50">
                    <p className="text-xs text-muted-foreground">Issues</p>
                    <p className="text-xl font-semibold">{syncStatus.issueCount}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 border border-border/50">
                    <p className="text-xs text-muted-foreground">Projects</p>
                    <p className="text-xl font-semibold">{syncStatus.projectCount}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 border border-border/50">
                    <p className="text-xs text-muted-foreground">Teams</p>
                    <p className="text-xl font-semibold">{syncStatus.teamCount}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    {syncStatus.lastSyncedAt
                      ? `Last synced ${new Date(syncStatus.lastSyncedAt).toLocaleString()}`
                      : 'Not yet synced'}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resync}
                    disabled={resyncLoading}
                  >
                    {resyncLoading ? 'Syncing...' : 'Re-sync now'}
                  </Button>
                </div>
              </div>
            )}

            {!syncStatus?.connected && !linearToken && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800/30 rounded text-sm text-yellow-800 dark:text-yellow-400">
                Save your Linear API token above before enabling sync.
              </div>
            )}

            {syncMessage && (
              <div className={`p-3 rounded-lg text-sm ${
                syncMessage.type === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-800 dark:bg-green-950/20 dark:border-green-800/30 dark:text-green-400'
                  : 'bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/20 dark:border-red-800/30 dark:text-red-400'
              }`}>
                {syncMessage.text}
              </div>
            )}

            <Button
              onClick={toggleSync}
              disabled={syncLoading || (!syncStatus?.connected && !linearToken)}
              variant={syncStatus?.connected ? 'outline' : 'default'}
              className="w-full"
            >
              {syncLoading
                ? 'Processing...'
                : syncStatus?.connected
                  ? 'Disconnect sync'
                  : 'Enable sync'}
            </Button>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button variant="link" onClick={() => router.push('/')}>
            ← Back to Linear integration
          </Button>
        </div>
      </div>
    </div>
  )
}