import { signOut, withAuth } from '@workos-inc/authkit-nextjs'
import { redirect } from 'next/navigation'
import { isPPMAdmin } from '@/lib/ppm-admin'
import { getHubForUser } from '@/lib/hub-auth'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function Home() {
  const { user } = await withAuth()

  if (user) {
    // PPM admins go to the admin portal
    if (await isPPMAdmin(user.id, user.email)) {
      redirect('/admin')
    }

    // Clients go to their hub
    const hubSlug = await getHubForUser(user.id, user.email)
    if (hubSlug) {
      redirect(`/hub/${hubSlug}`)
    }

    // Authenticated but no role — show no-access message
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex w-full max-w-sm flex-col items-center gap-6 px-4 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-foreground">
            <svg
              width="20"
              height="20"
              viewBox="0 0 100 100"
              fill="none"
              className="text-background"
            >
              <path
                d="M50 0L93.3 25V75L50 100L6.7 75V25L50 0Z"
                fill="currentColor"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              No access
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              You don&apos;t have access to any portals. Contact your administrator if you believe this is an error.
            </p>
          </div>
          <form action={async () => {
            'use server'
            await signOut()
          }}>
            <Button variant="outline" type="submit" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 px-4">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-foreground">
            <svg
              width="20"
              height="20"
              viewBox="0 0 100 100"
              fill="none"
              className="text-background"
            >
              <path
                d="M50 0L93.3 25V75L50 100L6.7 75V25L50 0Z"
                fill="currentColor"
              />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-foreground">
            PPM Client Hub
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in to continue
          </p>
        </div>
        <Button asChild className="w-full">
          <Link href="/auth/sign-in">Sign in</Link>
        </Button>
      </div>
    </div>
  )
}
