/**
 * Edge-compatible database functions using Supabase REST API directly.
 * These functions use fetch() instead of the Supabase client to work in Edge Runtime.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Check if a user is a PPM admin (edge-compatible).
 * Checks by user_id first, then falls back to email match.
 * Note: lazy-claim (filling user_id) is NOT done here — that happens
 * in the server-side isPPMAdmin() to avoid write operations in edge middleware.
 */
export async function lookupPPMAdmin(userId: string, email?: string): Promise<boolean> {
  try {
    const key = supabaseServiceKey || supabaseAnonKey

    // Check by user_id
    const url = new URL(`${supabaseUrl}/rest/v1/ppm_admins`)
    url.searchParams.set('user_id', `eq.${userId}`)
    url.searchParams.set('select', 'user_id')
    url.searchParams.set('limit', '1')

    const response = await fetch(url.toString(), {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.error('[lookupPPMAdmin] Supabase error:', response.status, await response.text())
      return false
    }

    const data = await response.json() as { user_id: string }[]
    if (data.length > 0) return true

    // Fallback: check by email (for unclaimed admin invites)
    if (email) {
      const emailUrl = new URL(`${supabaseUrl}/rest/v1/ppm_admins`)
      emailUrl.searchParams.set('email', `eq.${email.toLowerCase()}`)
      emailUrl.searchParams.set('select', 'email')
      emailUrl.searchParams.set('limit', '1')

      const emailResponse = await fetch(emailUrl.toString(), {
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
      })

      if (emailResponse.ok) {
        const emailData = await emailResponse.json() as { email: string }[]
        return emailData.length > 0
      }
    }

    return false
  } catch (err) {
    console.error('[lookupPPMAdmin] error:', err)
    return false
  }
}

/**
 * Look up a Client Hub by slug (edge-compatible).
 * Returns workos_org_id for org-scoped auth verification.
 */
export async function lookupHubBySlug(
  slug: string
): Promise<{ id: string; workos_org_id: string | null } | null> {
  try {
    const key = supabaseServiceKey || supabaseAnonKey
    const url = new URL(`${supabaseUrl}/rest/v1/client_hubs`)
    url.searchParams.set('slug', `eq.${slug}`)
    url.searchParams.set('is_active', 'eq.true')
    url.searchParams.set('select', 'id,workos_org_id')
    url.searchParams.set('limit', '1')

    const response = await fetch(url.toString(), {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) return null

    const data = await response.json() as { id: string; workos_org_id: string | null }[]
    if (!data || data.length === 0) return null

    return data[0]
  } catch {
    return null
  }
}
