import { Section, Text, Link } from '@react-email/components'

interface EventRowProps {
  summary: string
  timestamp: string
  deepLinkUrl: string
  actorName?: string
  metadata?: Record<string, string>
}

const HIDDEN_KEYS = new Set(['_', 'team_key'])

export function EventRow({ summary, timestamp, deepLinkUrl, actorName, metadata }: EventRowProps) {
  const meta = metadata ?? {}
  const project = meta['Project'] || meta['project']
  const otherMeta = Object.entries(meta)
    .filter(([k]) => !HIDDEN_KEYS.has(k) && k !== 'team_key' && !k.startsWith('_') && k.toLowerCase() !== 'project')
    .map(([k, v]) => `${k}: ${v}`)

  // Build context parts: Project first, then other metadata, then actor · date last
  const parts: string[] = []

  if (project) parts.push(project)
  parts.push(...otherMeta)
  if (actorName) parts.push(actorName)
  parts.push(timestamp)

  return (
    <Section style={{ padding: '10px 0', borderBottom: '1px solid #ebebeb' }}>
      <Text style={{ color: '#1a1a1a', fontSize: '14px', lineHeight: '20px', margin: '0 0 2px', fontWeight: 500 }}>
        {summary}
      </Text>
      <Text style={{ color: '#888888', fontSize: '12px', lineHeight: '16px', margin: '0' }}>
        {parts.join(' · ')}
      </Text>
      <Link href={deepLinkUrl} style={{ color: '#5E6AD2', fontSize: '12px', fontWeight: 500, textDecoration: 'none', marginTop: '6px', display: 'inline-block' }}>
        View &rarr;
      </Link>
    </Section>
  )
}
