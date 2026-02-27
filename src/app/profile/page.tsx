'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type SyncStatus = {
  connected: boolean
  webhookId: string | null
  hubCount: number
  issueCount: number
  commentCount: number
  teamCount: number
  projectCount: number
  initiativeCount: number
  lastSyncedAt: string | null
}

export default function ProfilePage() {
  const { user, signOut, loading: authLoading } = useAuth()
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const router = useRouter()

  const loadSyncStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/sync/subscribe')
      if (res.ok) {
        const data = await res.json() as SyncStatus
        setSyncStatus(data)
      }
    } catch (error) {
      console.error('Error loading sync status:', error)
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push('/login')
      return
    }
    loadSyncStatus()
  }, [user, authLoading, router, loadSyncStatus])

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Profile</h1>
          <Button variant="outline" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user.email || ''} disabled />
            </div>
            {(user.firstName || user.lastName) && (
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={[user.firstName, user.lastName].filter(Boolean).join(' ')} disabled />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Workspace sync</CardTitle>
                <CardDescription>
                  Linear data synced across all hubs.
                </CardDescription>
              </div>
              {syncStatus && (
                <Badge variant={syncStatus.connected ? 'default' : 'secondary'}>
                  {syncStatus.connected ? 'Connected' : 'Not configured'}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {syncStatus?.connected ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <StatCard label="Teams" value={syncStatus.teamCount} />
                  <StatCard label="Projects" value={syncStatus.projectCount} />
                  <StatCard label="Issues" value={syncStatus.issueCount} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <StatCard label="Initiatives" value={syncStatus.initiativeCount} />
                  <StatCard label="Comments" value={syncStatus.commentCount} />
                  <StatCard label="Hubs" value={syncStatus.hubCount} />
                </div>
                {syncStatus.lastSyncedAt && (
                  <p className="text-xs text-muted-foreground">
                    Last synced {new Date(syncStatus.lastSyncedAt).toLocaleString()}
                  </p>
                )}
              </>
            ) : (
              <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  No Linear connection configured yet.
                </p>
              </div>
            )}

            <Link href="/admin/settings/linear">
              <Button variant="outline" className="w-full">
                Manage Linear connection
              </Button>
            </Link>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button variant="link" onClick={() => router.push('/')}>
            &larr; Back to home
          </Button>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-muted/50 rounded-lg p-3 border border-border/50">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  )
}
