import { Section, Text, Link, Hr } from '@react-email/components'

interface EmailFooterProps {
  hubSlug: string
}

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

export function EmailFooter({ hubSlug }: EmailFooterProps) {
  const settingsUrl = `${getBaseUrl()}/hub/${hubSlug}/settings`

  return (
    <Section style={{ padding: '0 32px 24px' }}>
      <Hr style={{ borderColor: '#e5e5e5', margin: '24px 0 16px' }} />
      <Text style={{ color: '#888888', fontSize: '12px', lineHeight: '18px', textAlign: 'center' as const, margin: '0 0 8px' }}>
        <Link href={settingsUrl} style={{ color: '#888888', textDecoration: 'underline' }}>
          Manage notification settings
        </Link>
      </Text>
      <Text style={{ color: '#aaaaaa', fontSize: '11px', lineHeight: '16px', textAlign: 'center' as const, margin: '0' }}>
        PlusPlusMinus Design &amp; Development
      </Text>
    </Section>
  )
}
