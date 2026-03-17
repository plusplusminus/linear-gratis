import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

const glitches = [
  "This page pulled a Houdini.",
  "Looks like this page went off-grid.",
  "Even our best engineers can't find this one.",
  "This page is on permanent vacation.",
  "404: Page not found. Motivation also missing.",
  "You've reached the edge of the known internet.",
  "This page exists in a parallel universe. Not this one.",
  "Plot twist: the page was inside you all along. Just kidding, it's gone.",
]

export default function NotFound() {
  // Pick a deterministic-ish message based on the current minute
  // so it feels random per visit but works with SSR
  const message = glitches[new Date().getMinutes() % glitches.length]

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <Image
          src="/pulse-logo.png"
          alt="Pulse"
          width={56}
          height={56}
          className="opacity-40 grayscale"
        />

        <div className="flex flex-col gap-2">
          <p className="font-mono text-6xl font-bold tracking-tighter text-foreground/20">
            404
          </p>
          <p className="text-base text-muted-foreground">
            {message}
          </p>
        </div>

        <Button asChild variant="outline" size="sm">
          <Link href="/">Take me home</Link>
        </Button>
      </div>
    </div>
  )
}
