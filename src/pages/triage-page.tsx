import { Eraser, Loader2, Wand2 } from 'lucide-react'

import { TypeSafeLogo } from '@/components/logos'
import { ArticleTable, type ResultColumn } from '@/components/article-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useJevRun } from '@/hooks/use-jev-run'
import type { ArticleRecord } from '@/lib/pb'
import {
  isTriaged,
  triageArticle,
  triageRank,
  VERDICTS,
  type Triage,
  type Verdict,
} from '@/lib/triage'

/** Drop is the one verdict worth spotting from across the table. */
const VERDICT_STYLE: Record<Verdict, string> = {
  read_now: 'border-transparent bg-foreground text-background',
  skim: 'bg-secondary text-secondary-foreground border-transparent',
  reference: 'text-muted-foreground',
  drop: 'border-dashed text-muted-foreground line-through decoration-1',
}

const LABELS = Object.fromEntries(VERDICTS.map((v) => [v.id, v.label])) as Record<Verdict, string>

function TriageCell({ triage }: { triage: Triage | null }) {
  if (!isTriaged(triage)) {
    return <span className="text-sm text-muted-foreground">not triaged</span>
  }
  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className={VERDICT_STYLE[triage.verdict]}>
        {LABELS[triage.verdict]}
      </Badge>
      <span className="text-xs tabular-nums text-muted-foreground">{triage.confidence}% sure</span>
    </div>
  )
}

const column: ResultColumn = {
  header: 'Verdict',
  rank: (article) => triageRank(article.triage),
  cell: (article) => <TriageCell triage={article.triage} />,
  isAnswered: (article) => isTriaged(article.triage),
}

export function TriagePage({ rows }: { rows: ArticleRecord[] }) {
  const run = useJevRun({
    ask: triageArticle,
    field: 'triage',
    verb: 'Triaged',
    empty: null,
  })

  const untriaged = rows.filter((a) => !isTriaged(a.triage))
  const triaged = rows.filter((a) => isTriaged(a.triage))

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
        <TypeSafeLogo />
        <Button
          variant="secondary"
          onClick={() => void run.run(untriaged)}
          disabled={run.isRunning || untriaged.length === 0}
        >
          {run.isRunning ? <Loader2 className="animate-spin" /> : <Wand2 />}
          Triage all ({untriaged.length})
        </Button>
        <Button
          variant="outline"
          onClick={() => void run.run(untriaged.slice(0, 10))}
          disabled={run.isRunning || untriaged.length === 0}
          title="Triage the 10 most recently saved untriaged articles"
        >
          Triage next 10
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            // One Jev request per article to rebuild, so confirm first.
            if (window.confirm(`Remove the verdict from ${triaged.length} article(s)?`)) {
              void run.clear(triaged)
            }
          }}
          disabled={run.isRunning || triaged.length === 0}
        >
          <Eraser />
          Clear verdicts ({triaged.length})
        </Button>
        <p className="ml-auto text-sm text-muted-foreground">
          One call per article · {triaged.length} triaged
        </p>
      </div>


      <ArticleTable
        data={rows}
        pending={run.pending}
        errors={run.errors}
        result={column}
        onRun={(article) => void run.run([article])}
      />
    </>
  )
}
