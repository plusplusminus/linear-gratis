import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = process.env.FROM_EMAIL || 'notifications@lineargratis.com'

export async function sendEmail(options: {
  to: string | string[]
  subject: string
  react: React.ReactElement
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, subject, react } = options

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { data, error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: Array.isArray(to) ? to : [to],
        subject,
        react,
      })

      if (error) {
        // Don't retry on client errors (4xx)
        if (attempt === 0 && isTransientError(error)) continue
        console.error('Resend API error:', error)
        return { success: false, error: error.message }
      }

      return { success: true, messageId: data?.id }
    } catch (err) {
      if (attempt === 0) continue
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error('Failed to send email:', message)
      return { success: false, error: message }
    }
  }

  return { success: false, error: 'Unexpected: exhausted retries' }
}

function isTransientError(error: { statusCode?: number | null; name?: string }): boolean {
  if (error.statusCode && error.statusCode >= 500) return true
  if (error.name === 'rate_limit_exceeded') return true
  return false
}
