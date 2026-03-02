import { Section, Text } from '@react-email/components'

interface EmailHeaderProps {
  hubName: string
  subtitle?: string
}

export function EmailHeader({ hubName, subtitle }: EmailHeaderProps) {
  return (
    <Section style={{ backgroundColor: '#5E6AD2', padding: '16px 32px', borderRadius: '8px 8px 0 0' }}>
      <Text style={{ color: '#ffffff', fontSize: '18px', fontWeight: 600, margin: '0' }}>
        {hubName}
      </Text>
      {subtitle && (
        <Text style={{ color: 'rgba(255, 255, 255, 0.75)', fontSize: '12px', margin: '4px 0 0' }}>
          {subtitle}
        </Text>
      )}
    </Section>
  )
}
