import fs from 'fs'
import path from 'path'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Navigation } from '@/components/navigation'
import { Button } from '@/components/ui/button'
import { MarkdownRenderer } from '@/components/markdown-renderer'

const docsDir = path.join(process.cwd(), 'docs', 'development')

export async function generateStaticParams() {
  if (!fs.existsSync(docsDir)) return []
  const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.md'))
  return files.map(f => ({ slug: f.replace(/\.md$/, '') }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const filePath = path.join(docsDir, `${slug}.md`)
  if (!fs.existsSync(filePath)) return { title: 'Not Found' }

  const content = fs.readFileSync(filePath, 'utf-8')
  const titleMatch = content.match(/^#\s+(.+)$/m)
  const title = titleMatch ? titleMatch[1] : slug.replace(/-/g, ' ')

  return { title: `${title} | Docs` }
}

export default async function DevDocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const filePath = path.join(docsDir, `${slug}.md`)

  if (!fs.existsSync(filePath)) {
    notFound()
  }

  const content = fs.readFileSync(filePath, 'utf-8')

  return (
    <div className="min-h-screen gradient-bg">
      <Navigation />

      <div className="container mx-auto px-6 py-12 max-w-4xl">
        <Link href="/docs">
          <Button variant="ghost" size="sm" className="mb-6 -ml-2 text-muted-foreground">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            Back to docs
          </Button>
        </Link>

        <article className="prose prose-sm dark:prose-invert max-w-none
          prose-headings:font-semibold
          prose-h1:text-3xl prose-h1:mb-6 prose-h1:pb-3 prose-h1:border-b prose-h1:border-border
          prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4
          prose-h3:text-lg prose-h3:mt-8 prose-h3:mb-3
          prose-p:text-muted-foreground prose-p:leading-relaxed
          prose-li:text-muted-foreground
          prose-strong:text-foreground prose-strong:font-semibold
          prose-code:text-xs prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
          prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded-lg
          prose-table:text-sm
          prose-th:text-foreground prose-th:font-semibold prose-th:border-border
          prose-td:text-muted-foreground prose-td:border-border
          prose-a:text-primary prose-a:no-underline hover:prose-a:underline
          prose-hr:border-border
        ">
          <MarkdownRenderer content={content} />
        </article>
      </div>
    </div>
  )
}
