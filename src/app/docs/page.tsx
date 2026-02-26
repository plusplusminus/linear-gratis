'use client'

import { useAuth } from '@/hooks/use-auth'
import { Navigation } from '@/components/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  BookOpen,
  Settings,
  FileText,
  Eye,
  Map,
  Palette,
  Globe,
  Users,
  Lightbulb,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react'
import Link from 'next/link'

export default function DocsPage() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg">
        <Navigation />
        <div className="container mx-auto px-6 py-24 text-center text-muted-foreground">
          Loading...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen gradient-bg">
      <Navigation />

      <div className="container mx-auto px-6 py-12 max-w-4xl">
        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-2">Documentation</h1>
          <p className="text-muted-foreground">
            Everything you need to know about setting up and using linear.gratis for your clients.
          </p>
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <Link href="/docs/customer-experience">
              <Button variant="outline" size="sm">
                Customer experience
                <ArrowRight className="ml-2 h-3.5 w-3.5" />
              </Button>
            </Link>
            <Link href="/docs/features">
              <Button variant="outline" size="sm">
                Feature inventory
                <ArrowRight className="ml-2 h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="space-y-8">
          {/* Getting Started */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="h-5 w-5 text-primary" />
                Getting Started
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <p>
                <strong className="text-foreground">linear.gratis</strong> is a free platform that connects to your Linear workspace to provide client-facing feedback forms, public project views, and shareable roadmaps — without giving clients direct access to Linear.
              </p>
              <p>
                It sits between your Linear workspace and your clients: they submit feedback and track progress through linear.gratis, while everything syncs back to your Linear projects as issues and updates.
              </p>
            </CardContent>
          </Card>

          {/* Initial Setup */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Settings className="h-5 w-5 text-primary" />
                Initial Setup
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <ol className="list-decimal list-inside space-y-2">
                <li><strong className="text-foreground">Sign up</strong> — Create an account at linear.gratis using your email.</li>
                <li><strong className="text-foreground">Connect Linear</strong> — Go to <Link href="/profile" className="text-primary underline underline-offset-2">Profile</Link> and paste your Linear API token. You can generate one from Linear &gt; Settings &gt; API &gt; Personal API keys.</li>
                <li><strong className="text-foreground">Verify connection</strong> — Once saved, your Linear teams and projects will be available when creating forms, views, and roadmaps.</li>
              </ol>
            </CardContent>
          </Card>

          {/* Setting Up Customer Forms */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-primary" />
                Setting Up Customer Forms
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <p>Forms let your clients submit feedback, bug reports, or feature requests that automatically create issues in Linear.</p>
              <ol className="list-decimal list-inside space-y-2">
                <li><strong className="text-foreground">Create a form</strong> — Go to <Link href="/forms" className="text-primary underline underline-offset-2">Forms</Link> and click &quot;Create form&quot;. Give it a name and select which Linear team and project submissions should go to.</li>
                <li><strong className="text-foreground">Configure fields</strong> — Choose which fields to show (title, description, priority, labels, etc.). Set defaults for fields you want pre-filled.</li>
                <li><strong className="text-foreground">Share the link</strong> — Each form gets a unique URL you can send to clients. You can also create prefill links that pre-populate fields (useful for embedding in specific contexts).</li>
              </ol>
              <p>
                Every submission creates a real Linear issue in your chosen project, with the client&apos;s details attached.
              </p>
            </CardContent>
          </Card>

          {/* Public Views */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Eye className="h-5 w-5 text-primary" />
                Public Views
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <p>Public views are read-only kanban boards that let stakeholders see project progress without needing a Linear account.</p>
              <ol className="list-decimal list-inside space-y-2">
                <li><strong className="text-foreground">Create a view</strong> — Go to <Link href="/views" className="text-primary underline underline-offset-2">Public Views</Link> and select a Linear project to display.</li>
                <li><strong className="text-foreground">Configure visibility</strong> — Choose which statuses and fields are visible. You can hide internal statuses or sensitive fields.</li>
                <li><strong className="text-foreground">Password protection</strong> — Optionally set a password so only authorised stakeholders can access the board.</li>
              </ol>
              <p>
                Views update whenever the underlying Linear project changes — no manual syncing needed.
              </p>
            </CardContent>
          </Card>

          {/* Public Roadmaps */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Map className="h-5 w-5 text-primary" />
                Public Roadmaps
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <p>Roadmaps give clients a high-level view of what you&apos;re building and what&apos;s coming next.</p>
              <ol className="list-decimal list-inside space-y-2">
                <li><strong className="text-foreground">Create a roadmap</strong> — Go to <Link href="/roadmaps" className="text-primary underline underline-offset-2">Roadmaps</Link> and select one or more Linear projects to include.</li>
                <li><strong className="text-foreground">Choose a layout</strong> — Kanban (status columns) or timeline view.</li>
                <li><strong className="text-foreground">Enable engagement</strong> — Turn on voting and/or comments to let clients signal what matters to them.</li>
                <li><strong className="text-foreground">Password protect</strong> — Restrict access to specific clients or stakeholders.</li>
              </ol>
            </CardContent>
          </Card>

          {/* Custom Branding */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Palette className="h-5 w-5 text-primary" />
                Custom Branding
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <p>Make forms, views, and roadmaps look like your own product.</p>
              <ul className="list-disc list-inside space-y-2">
                <li><strong className="text-foreground">Logo</strong> — Upload your company logo in <Link href="/profile/branding" className="text-primary underline underline-offset-2">Branding</Link>. It appears on all public-facing pages.</li>
                <li><strong className="text-foreground">Colours</strong> — Set a primary brand colour that applies to buttons, links, and accents.</li>
                <li><strong className="text-foreground">Remove &quot;powered by&quot;</strong> — Hide the linear.gratis attribution for a fully white-labelled experience.</li>
              </ul>
            </CardContent>
          </Card>

          {/* Custom Domains */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Globe className="h-5 w-5 text-primary" />
                Custom Domains
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <p>Use your own domain (e.g. feedback.yourcompany.com) instead of a linear.gratis URL.</p>
              <ol className="list-decimal list-inside space-y-2">
                <li><strong className="text-foreground">Add domain</strong> — Go to <Link href="/profile/domains" className="text-primary underline underline-offset-2">Domains</Link> and enter your custom domain.</li>
                <li><strong className="text-foreground">DNS verification</strong> — Add the provided CNAME record to your DNS provider and wait for verification.</li>
                <li><strong className="text-foreground">Link content</strong> — Assign the domain to a specific form, view, or roadmap. Visitors to that domain will see your branded content directly.</li>
              </ol>
            </CardContent>
          </Card>

          {/* Per-Client Setup Workflow */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-primary" />
                Per-Client Setup Workflow
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <p>Checklist for onboarding each new client:</p>
              <div className="space-y-2">
                {[
                  'Create a Linear project for the client (if not already done)',
                  'Create a feedback form linked to that project',
                  'Create a public view for the client\'s project',
                  'Create a roadmap (if applicable)',
                  'Apply branding — upload their logo and set colours',
                  'Set up a custom domain (optional)',
                  'Share the form URL and view/roadmap links with the client',
                  'Set passwords on views/roadmaps if they should be restricted',
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground/50 mt-0.5 shrink-0" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Tips & Best Practices */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Lightbulb className="h-5 w-5 text-primary" />
                Tips & Best Practices
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <ul className="list-disc list-inside space-y-2">
                <li><strong className="text-foreground">Naming conventions</strong> — Use consistent names like &quot;[Client] Feedback Form&quot; and &quot;[Client] Project Board&quot; so you can quickly find things as you scale.</li>
                <li><strong className="text-foreground">Password protection</strong> — Always password-protect views and roadmaps for client-specific projects. Use unique passwords per client.</li>
                <li><strong className="text-foreground">Multiple clients</strong> — Each client should have their own form, view, and roadmap. Don&apos;t share a single form across clients — you&apos;ll lose the ability to track submissions per client.</li>
                <li><strong className="text-foreground">Prefill links</strong> — Use prefill links when embedding forms in specific contexts (e.g. a &quot;Report a bug&quot; link can prefill the label to &quot;Bug&quot;).</li>
                <li><strong className="text-foreground">Branding per use case</strong> — If you serve very different clients, consider using custom domains so each client sees a fully branded experience.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
