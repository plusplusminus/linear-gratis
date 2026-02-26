import { authkit, handleAuthkitHeaders } from '@workos-inc/authkit-nextjs'
import { NextResponse, type NextRequest } from 'next/server'
import { lookupCustomDomain } from '@/lib/edge-db'

export default async function middleware(request: NextRequest) {
  const { session, headers, authorizationUrl } = await authkit(request)
  const { pathname } = request.nextUrl

  // Enforce auth on protected routes
  const protectedPaths = ['/forms', '/views', '/roadmaps', '/profile', '/docs']
  const isProtected = protectedPaths.some(p => pathname === p || pathname.startsWith(p + '/'))

  if (isProtected && !session.user && authorizationUrl) {
    return handleAuthkitHeaders(request, headers, { redirect: authorizationUrl })
  }

  const hostname = request.headers.get('host') || ''

  // Skip custom domain logic for API routes, static files, and Next.js internals
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.includes('.')
  ) {
    return handleAuthkitHeaders(request, headers)
  }

  // Check if this is a custom domain (not the main domain)
  const mainDomains = [
    'linear.gratis',
    'localhost:3000',
    'localhost',
    'workers.dev',
    process.env.NEXT_PUBLIC_APP_DOMAIN || '',
  ].filter(Boolean)

  const isMainDomain = mainDomains.some((domain) => hostname.includes(domain))

  // If it's not the main domain, check if it's a verified custom domain
  if (!isMainDomain) {
    try {
      const result = await lookupCustomDomain(hostname)

      if (result.success) {
        const { domain } = result

        if (domain.target_type === 'form' && domain.target_slug) {
          const rewriteUrl = new URL(`/form/${domain.target_slug}`, request.url)
          request.nextUrl.searchParams.forEach((value, key) => {
            rewriteUrl.searchParams.set(key, value)
          })
          return NextResponse.rewrite(rewriteUrl)
        } else if (domain.target_type === 'view' && domain.target_slug) {
          const rewriteUrl = new URL(`/view/${domain.target_slug}`, request.url)
          request.nextUrl.searchParams.forEach((value, key) => {
            rewriteUrl.searchParams.set(key, value)
          })
          return NextResponse.rewrite(rewriteUrl)
        } else if (domain.target_type === 'roadmap' && domain.target_slug) {
          const rewriteUrl = new URL(`/roadmap/${domain.target_slug}`, request.url)
          request.nextUrl.searchParams.forEach((value, key) => {
            rewriteUrl.searchParams.set(key, value)
          })
          return NextResponse.rewrite(rewriteUrl)
        }
      } else if ('notFound' in result && result.notFound) {
        return new NextResponse(
          'This domain is not registered with our service.',
          { status: 404 }
        )
      } else {
        console.error('Domain lookup error:', result.error)
        return new NextResponse(
          'An error occurred while processing this domain.',
          { status: 500 }
        )
      }

      return handleAuthkitHeaders(request, headers)
    } catch (error) {
      console.error('Custom domain middleware error:', error)
      return new NextResponse(
        'An error occurred while processing this domain.',
        { status: 500 }
      )
    }
  }

  // Main domain - process normally
  return handleAuthkitHeaders(request, headers)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
}
