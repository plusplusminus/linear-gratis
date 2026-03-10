export interface PulseConfig {
  widgetKey: string
  apiUrl?: string
  theme?: 'auto' | 'light' | 'dark'
  position?: 'bottom-right' | 'bottom-left'
  triggerText?: string
  collectConsole?: boolean
  consoleLimit?: number
  sentry?: {
    enabled?: boolean
  }
  user?: {
    email?: string
    name?: string
  }
  custom?: Record<string, string>
  onSubmit?: (result: SubmitResult) => void
  onOpen?: () => void
  onClose?: () => void
}

export interface SubmitResult {
  id: string
  linearIssueId: string | null
  linearIssueUrl: string | null
  status: 'created' | 'failed'
}

export interface ConsoleEntry {
  level: string
  message: string
  timestamp: string
}

export interface SentryContext {
  replayId: string | null
  replayUrl: string | null
  sessionId: string | null
  traceId: string | null
}

export interface WidgetContext {
  url: string
  userAgent: string
  viewport: { width: number; height: number }
  timestamp: string
  console: ConsoleEntry[]
  sentry: SentryContext | null
  custom: Record<string, string>
}

export interface FeedbackPayload {
  title: string
  description?: string
  type: 'bug' | 'feedback' | 'idea'
  metadata: WidgetContext
  reporter: {
    email: string
    name?: string
  }
  screenshot?: string
}

export type WidgetState = 'closed' | 'open' | 'capturing' | 'annotating' | 'submitting' | 'success' | 'error'
