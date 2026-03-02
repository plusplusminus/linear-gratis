import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Hr,
  Preview,
} from '@react-email/components'
import { EmailHeader } from './components/email-header'
import { EmailFooter } from './components/email-footer'
import { EventRow } from './components/event-row'

export interface DigestEvent {
  type: string
  summary: string
  timestamp: string
  deepLinkUrl: string
}

export interface DigestNotificationProps {
  hubName: string
  hubSlug: string
  logoUrl?: string
  primaryColor?: string
  accentColor?: string
  footerText?: string
  events: Record<string, DigestEvent[]>
  period: 'daily' | 'weekly'
  dateRange: string
}

export function DigestNotification({
  hubName,
  hubSlug,
  logoUrl,
  primaryColor = '#5E6AD2',
  accentColor = '#5E6AD2',
  footerText,
  events,
  period,
  dateRange,
}: DigestNotificationProps) {
  const totalCount = Object.values(events).reduce((sum, items) => sum + items.length, 0)
  const summaryParts = Object.entries(events).map(
    ([type, items]) => `${items.length} ${formatEventType(type).toLowerCase()}`
  )
  const summaryText = summaryParts.join(', ')
  const previewText = `${period === 'daily' ? 'Daily' : 'Weekly'} digest: ${summaryText} — ${hubName}`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={body}>
        <Container style={container}>
          <EmailHeader hubName={hubName} logoUrl={logoUrl} primaryColor={primaryColor} />

          <Section style={content}>
            <Text style={title}>
              {period === 'daily' ? 'Daily' : 'Weekly'} Digest
            </Text>
            <Text style={dateRangeStyle}>
              {dateRange}
            </Text>

            <Section style={statsBar}>
              <Text style={statsText}>
                {totalCount} update{totalCount !== 1 ? 's' : ''}: {summaryText}
              </Text>
            </Section>

            {Object.entries(events).map(([type, items]) => (
              <Section key={type} style={{ marginBottom: '16px' }}>
                <Text style={sectionHeader}>
                  {formatEventType(type)} ({items.length})
                </Text>
                <Hr style={{ borderColor: '#e5e5e5', margin: '0 0 4px' }} />
                {items.map((event, i) => (
                  <EventRow
                    key={i}
                    summary={event.summary}
                    timestamp={event.timestamp}
                    deepLinkUrl={event.deepLinkUrl}
                    accentColor={accentColor}
                  />
                ))}
              </Section>
            ))}
          </Section>

          <EmailFooter hubSlug={hubSlug} footerText={footerText} />
        </Container>
      </Body>
    </Html>
  )
}

function formatEventType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

const body = {
  backgroundColor: '#f4f4f5',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  padding: '40px 0',
} as const

const container = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  maxWidth: '560px',
  margin: '0 auto',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
} as const

const content = {
  padding: '24px 32px',
} as const

const title = {
  color: '#1a1a1a',
  fontSize: '20px',
  fontWeight: 600 as const,
  margin: '0 0 4px',
} as const

const dateRangeStyle = {
  color: '#888888',
  fontSize: '13px',
  margin: '0 0 16px',
} as const

const statsBar = {
  backgroundColor: '#fafafa',
  borderRadius: '6px',
  padding: '12px 16px',
  marginBottom: '20px',
} as const

const statsText = {
  color: '#444444',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0',
} as const

const sectionHeader = {
  color: '#1a1a1a',
  fontSize: '14px',
  fontWeight: 600 as const,
  margin: '0 0 4px',
} as const

export default DigestNotification
