'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

const glitches = [
  "This page pulled a Houdini.",
  "Looks like this page went off-grid.",
  "Even our best engineers can't find this one.",
  "This page is on permanent vacation.",
  "Page not found. Motivation also missing.",
  "You've reached the edge of the known internet.",
  "This page exists in a parallel universe. Not this one.",
  "Plot twist: the page was inside you all along. Just kidding, it's gone.",
  "We looked everywhere. Under the couch cushions, too.",
  "This page left no forwarding address.",
  "Gone. Reduced to atoms.",
  "The page you're looking for is in another castle.",
  "Have you tried turning it off and on again?",
  "This page was last seen running into the woods.",
  "Error: page.exe has stopped working.",
  "This page took an arrow to the knee.",
  "Congratulations, you've found nothing.",
  "The void stares back.",
  "Schrödinger's page: it both exists and doesn't. But mostly doesn't.",
  "This page was deprecated before it was cool.",
  "Task failed successfully.",
  "If you stare long enough, a page might appear. (It won't.)",
  "We blame the intern.",
  "This page is still in the backlog.",
]

export default function NotFound() {
  const [index, setIndex] = useState(0)
  const [fade, setFade] = useState(true)

  useEffect(() => {
    // Start with a random message
    setIndex(Math.floor(Math.random() * glitches.length))
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false)
      setTimeout(() => {
        setIndex((prev) => {
          let next = prev
          // Avoid repeating the same message
          while (next === prev) {
            next = Math.floor(Math.random() * glitches.length)
          }
          return next
        })
        setFade(true)
      }, 200)
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <Image
          src="/pulse-logo.png"
          alt="Pulse"
          width={56}
          height={56}
          className="animate-pulse"
        />

        <div className="flex flex-col gap-2">
          <p className="font-mono text-6xl font-bold tracking-tighter text-foreground/20">
            404
          </p>
          <p
            className="h-12 text-base text-muted-foreground transition-opacity duration-200"
            style={{ opacity: fade ? 1 : 0 }}
          >
            {glitches[index]}
          </p>
        </div>

        <Button asChild variant="outline" size="sm">
          <Link href="/">Take me home</Link>
        </Button>
      </div>
    </div>
  )
}
