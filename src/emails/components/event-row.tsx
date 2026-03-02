import { Section, Text, Button, Link } from '@react-email/components'

interface EventRowProps {
  summary: string
  timestamp: string
  deepLinkUrl: string
  accentColor?: string
}

export function EventRow({ summary, timestamp, deepLinkUrl, accentColor = '#5E6AD2' }: EventRowProps) {
  return (
    <Section style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
      <Text style={{ color: '#1a1a1a', fontSize: '14px', lineHeight: '22px', margin: '0 0 4px' }}>
        {summary}
      </Text>
      <Text style={{ color: '#999999', fontSize: '12px', lineHeight: '16px', margin: '0 0 8px' }}>
        {timestamp}
      </Text>
      <Link href={deepLinkUrl} style={{ color: accentColor, fontSize: '13px', fontWeight: 500, textDecoration: 'none' }}>
        View &rarr;
      </Link>
    </Section>
  )
}
