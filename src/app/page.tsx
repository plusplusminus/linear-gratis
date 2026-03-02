import { getSignInUrl, withAuth } from '@workos-inc/authkit-nextjs'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function Home() {
  const { user } = await withAuth()

  if (user) {
    redirect('/admin')
  }

  const signInUrl = await getSignInUrl()

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
            linear.gratis
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in to continue
          </p>
        </div>
        <Button asChild className="w-full">
          <Link href={signInUrl}>Sign in</Link>
        </Button>
      </div>
    </div>
  )
}
