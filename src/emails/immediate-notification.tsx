import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Preview,
} from '@react-email/components'
import { EmailHeader } from './components/email-header'
import { EmailFooter } from './components/email-footer'

export interface ImmediateNotificationProps {
  hubName: string
  hubSlug: string
  event: {
    type: string
    summary: string
    entityType: string
    entityId: string
    actorName?: string
    metadata?: Record<string, string>
  }
  deepLinkUrl: string
}

export function ImmediateNotification({
  hubName,
  hubSlug,
  event,
  deepLinkUrl,
}: ImmediateNotificationProps) {
  const previewText = `${event.summary} — ${hubName}`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={body}>
        <Container style={container}>
          <EmailHeader hubName={hubName} subtitle={`${formatEventType(event.type)} · ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`} />

          <Section style={content}>
            <Text style={summary}>
              {event.summary}
            </Text>

            {event.actorName && (
              <Text style={meta}>
                by {event.actorName}
              </Text>
            )}

            {event.metadata && Object.keys(event.metadata).length > 0 ? (
              <Section style={metadataSection}>
                {Object.entries(event.metadata).map(([key, value]) => (
                  <Text key={key} style={metadataLine}>
                    <span style={{ color: '#888888' }}>{key}:</span> {value}
                  </Text>
                ))}
                <Link href={deepLinkUrl} style={viewLink}>
                  View &rarr;
                </Link>
              </Section>
            ) : (
              <Link href={deepLinkUrl} style={viewLink}>
                View &rarr;
              </Link>
            )}
          </Section>

          <EmailFooter hubSlug={hubSlug} />
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

const summary = {
  color: '#1a1a1a',
  fontSize: '16px',
  lineHeight: '24px',
  fontWeight: 500 as const,
  margin: '0 0 4px',
} as const

const meta = {
  color: '#888888',
  fontSize: '13px',
  lineHeight: '20px',
  margin: '0 0 16px',
} as const

const metadataSection = {
  backgroundColor: '#fafafa',
  borderRadius: '6px',
  padding: '12px 16px',
  margin: '12px 0 20px',
} as const

const metadataLine = {
  color: '#444444',
  fontSize: '13px',
  lineHeight: '20px',
  margin: '2px 0',
} as const

const viewLink = {
  color: '#5E6AD2',
  fontSize: '13px',
  fontWeight: 500 as const,
  textDecoration: 'none',
  marginTop: '8px',
  display: 'inline-block' as const,
} as const

export default ImmediateNotification
