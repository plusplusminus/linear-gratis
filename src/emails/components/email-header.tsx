import { Section, Img, Text } from '@react-email/components'

interface EmailHeaderProps {
  hubName: string
  logoUrl?: string
  primaryColor?: string
}

export function EmailHeader({ hubName, logoUrl, primaryColor = '#5E6AD2' }: EmailHeaderProps) {
  return (
    <Section style={{ backgroundColor: primaryColor, padding: '24px 32px', borderRadius: '8px 8px 0 0' }}>
      {logoUrl ? (
        <Img
          src={logoUrl}
          alt={hubName}
          height="32"
          style={{ display: 'block', margin: '0 auto 8px' }}
        />
      ) : (
        <Text style={{ color: '#ffffff', fontSize: '20px', fontWeight: 600, textAlign: 'center' as const, margin: '0' }}>
          {hubName}
        </Text>
      )}
    </Section>
  )
}
