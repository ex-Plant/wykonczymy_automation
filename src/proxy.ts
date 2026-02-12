import { NextResponse, type NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasToken = request.cookies.has('payload-token')

  // Not logged in → redirect to login
  if (!hasToken && pathname !== '/zaloguj') {
    return NextResponse.redirect(new URL('/zaloguj', request.url))
  }

  // Logged in → redirect away from login page
  if (hasToken && pathname === '/zaloguj') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - /admin (Payload admin panel)
     * - /api (Payload API routes)
     * - /_next (Next.js internals)
     * - Static assets (images, fonts, etc.)
     */
    '/((?!admin|api|_next|favicon\\.ico|fonts|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)',
  ],
}
