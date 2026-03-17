'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
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

// Pixel art "404" bitmap (each char is 5 wide x 7 tall, with 1px gap between)
const PIXEL_FONT: Record<string, number[]> = {
  '4': [
    0,0,1,0,0,
    0,1,1,0,0,
    1,0,1,0,0,
    1,1,1,1,0,
    0,0,1,0,0,
    0,0,1,0,0,
    0,0,1,0,0,
  ],
  '0': [
    0,1,1,1,0,
    1,0,0,0,1,
    1,0,0,1,1,
    1,0,1,0,1,
    1,1,0,0,1,
    1,0,0,0,1,
    0,1,1,1,0,
  ],
}

const PURPLE_PALETTE = [
  '#c084fc', '#a855f7', '#9333ea', '#7e22ce',
  '#6b21a8', '#d8b4fe', '#e9d5ff', '#8b5cf6',
]

interface Particle {
  x: number
  y: number
  targetX: number
  targetY: number
  vx: number
  vy: number
  size: number
  color: string
  alpha: number
  phase: 'explode' | 'drift' | 'assemble' | 'settled'
  delay: number
  trail: { x: number; y: number; alpha: number }[]
}

function getTextPixels(text: string, pixelSize: number, centerX: number, centerY: number) {
  const chars = text.split('')
  const charW = 5
  const charH = 7
  const gap = 1
  const totalW = chars.length * (charW + gap) - gap
  const startX = centerX - (totalW * pixelSize) / 2
  const startY = centerY - (charH * pixelSize) / 2

  const pixels: { x: number; y: number }[] = []

  chars.forEach((char, ci) => {
    const bitmap = PIXEL_FONT[char]
    if (!bitmap) return
    for (let row = 0; row < charH; row++) {
      for (let col = 0; col < charW; col++) {
        if (bitmap[row * charW + col]) {
          pixels.push({
            x: startX + (ci * (charW + gap) + col) * pixelSize,
            y: startY + row * pixelSize,
          })
        }
      }
    }
  })

  return pixels
}

function PixelAnimation({ onClose }: { onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const frameRef = useRef<number>(0)
  const startTimeRef = useRef<number>(0)
  const phaseRef = useRef<'explode' | 'drift' | 'assemble' | 'settled'>('explode')

  const init = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const cx = canvas.width / 2
    const cy = canvas.height / 2
    const pixelSize = Math.max(6, Math.min(10, canvas.width / 80))

    const targets = getTextPixels('404', pixelSize, cx, cy)
    const particles: Particle[] = targets.map((target, i) => {
      const angle = Math.random() * Math.PI * 2
      const speed = 8 + Math.random() * 16
      return {
        x: cx,
        y: cy,
        targetX: target.x,
        targetY: target.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: pixelSize,
        color: PURPLE_PALETTE[Math.floor(Math.random() * PURPLE_PALETTE.length)],
        alpha: 1,
        phase: 'explode',
        delay: i * 2,
        trail: [],
      }
    })

    // Add extra decorative particles
    for (let i = 0; i < 80; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 4 + Math.random() * 12
      particles.push({
        x: cx,
        y: cy,
        targetX: cx + (Math.random() - 0.5) * canvas.width,
        targetY: cy + (Math.random() - 0.5) * canvas.height,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: pixelSize * (0.3 + Math.random() * 0.5),
        color: PURPLE_PALETTE[Math.floor(Math.random() * PURPLE_PALETTE.length)],
        alpha: 0.7,
        phase: 'explode',
        delay: Math.random() * 100,
        trail: [],
      })
    }

    particlesRef.current = particles
    startTimeRef.current = performance.now()
    phaseRef.current = 'explode'
  }, [])

  useEffect(() => {
    init()
    const handleResize = () => init()
    window.addEventListener('resize', handleResize)

    const animate = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const elapsed = performance.now() - startTimeRef.current
      const particles = particlesRef.current

      // Phase transitions
      if (elapsed > 1200 && phaseRef.current === 'explode') {
        phaseRef.current = 'drift'
      }
      if (elapsed > 2500 && phaseRef.current === 'drift') {
        phaseRef.current = 'assemble'
      }
      if (elapsed > 4500 && phaseRef.current === 'assemble') {
        phaseRef.current = 'settled'
      }

      // Dark overlay with slight pixel grid feel
      ctx.fillStyle = 'rgba(0, 0, 0, 0.92)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw scanlines
      ctx.fillStyle = 'rgba(255, 255, 255, 0.015)'
      for (let y = 0; y < canvas.height; y += 4) {
        ctx.fillRect(0, y, canvas.width, 1)
      }

      let allSettled = true

      particles.forEach((p) => {
        if (elapsed < p.delay) return

        // Store trail
        p.trail.push({ x: p.x, y: p.y, alpha: p.alpha * 0.5 })
        if (p.trail.length > 6) p.trail.shift()

        switch (phaseRef.current) {
          case 'explode':
            p.x += p.vx
            p.y += p.vy
            p.vx *= 0.96
            p.vy *= 0.96
            p.vy += 0.15 // slight gravity
            allSettled = false
            break

          case 'drift':
            p.x += p.vx * 0.3
            p.y += p.vy * 0.3
            p.vx *= 0.95
            p.vy *= 0.95
            // Gentle float
            p.x += Math.sin(elapsed * 0.002 + p.delay) * 0.3
            p.y += Math.cos(elapsed * 0.003 + p.delay) * 0.3
            allSettled = false
            break

          case 'assemble': {
            const dx = p.targetX - p.x
            const dy = p.targetY - p.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            const spring = 0.08
            const damping = 0.82
            p.vx = (p.vx + dx * spring) * damping
            p.vy = (p.vy + dy * spring) * damping
            p.x += p.vx
            p.y += p.vy
            if (dist > 1) allSettled = false
            break
          }

          case 'settled': {
            const sdx = p.targetX - p.x
            const sdy = p.targetY - p.y
            p.x += sdx * 0.2
            p.y += sdy * 0.2
            // Gentle breathing
            const breathe = Math.sin(elapsed * 0.003 + p.delay * 0.1) * 0.5
            p.x += breathe * 0.2
            break
          }
        }

        // Draw trail
        p.trail.forEach((t, ti) => {
          const trailAlpha = (ti / p.trail.length) * 0.15
          ctx.fillStyle = p.color
          ctx.globalAlpha = trailAlpha
          const trailSize = p.size * (0.5 + (ti / p.trail.length) * 0.5)
          ctx.fillRect(
            Math.round(t.x / 2) * 2,
            Math.round(t.y / 2) * 2,
            trailSize,
            trailSize
          )
        })

        // Draw pixel (snap to grid for that pixel art feel)
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = p.color
        const snapX = Math.round(p.x / 2) * 2
        const snapY = Math.round(p.y / 2) * 2
        ctx.fillRect(snapX, snapY, p.size, p.size)

        // Inner highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
        ctx.fillRect(snapX, snapY, p.size * 0.5, p.size * 0.5)

        ctx.globalAlpha = 1
      })

      // Draw "click anywhere to close" after settled
      if (phaseRef.current === 'settled') {
        const blink = Math.sin(elapsed * 0.004) > 0
        if (blink) {
          ctx.fillStyle = 'rgba(168, 85, 247, 0.4)'
          ctx.font = '14px monospace'
          ctx.textAlign = 'center'
          ctx.fillText('[ click anywhere to close ]', canvas.width / 2, canvas.height / 2 + 80)
        }
      }

      if (!allSettled || phaseRef.current !== 'settled') {
        frameRef.current = requestAnimationFrame(animate)
      } else {
        // Keep breathing animation going
        frameRef.current = requestAnimationFrame(animate)
      }
    }

    frameRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(frameRef.current)
      window.removeEventListener('resize', handleResize)
    }
  }, [init])

  return (
    <canvas
      ref={canvasRef}
      onClick={onClose}
      className="fixed inset-0 z-50 cursor-pointer"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}

export default function NotFound() {
  const [index, setIndex] = useState(0)
  const [fade, setFade] = useState(true)
  const [showAnimation, setShowAnimation] = useState(false)

  useEffect(() => {
    setIndex(Math.floor(Math.random() * glitches.length))
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false)
      setTimeout(() => {
        setIndex((prev) => {
          let next = prev
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
      {showAnimation && (
        <PixelAnimation onClose={() => setShowAnimation(false)} />
      )}
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <button
          onClick={() => setShowAnimation(true)}
          className="cursor-pointer border-none bg-transparent p-0"
          aria-label="Trigger easter egg"
        >
          <Image
            src="/pulse-logo.png"
            alt="Pulse"
            width={56}
            height={56}
            className="animate-pulse transition-transform hover:scale-110"
          />
        </button>

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
