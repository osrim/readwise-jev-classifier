import { Eraser, Loader2, Sparkles } from 'lucide-react'

import { TypeSafeLogo } from '@/components/logos'
import { ArticleTable, TagCell, type ResultColumn } from '@/components/article-table'
import { Button } from '@/components/ui/button'
import { useJevRun } from '@/hooks/use-jev-run'
import { scoreArticle } from '@/lib/jev'
import type { ArticleRecord } from '@/lib/pb'
import { appliedTags, isScored, TAG_THRESHOLD } from '@/lib/tags'

const column: ResultColumn = {
  header: 'Jev tags',
  rank: (article) => appliedTags(article.scores).length,
  cell: (article) => <TagCell article={article} />,
  isAnswered: (article) => isScored(article.scores),
}

export function TagsPage({ rows }: { rows: ArticleRecord[] }) {
  const run = useJevRun({ ask: scoreArticle, field: 'scores', verb: 'Scored', empty: {} })

  const unscored = rows.filter((a) => !isScored(a.scores))
  const scored = rows.filter((a) => isScored(a.scores))

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
        <TypeSafeLogo />
        <Button
          variant="secondary"
          onClick={() => void run.run(unscored)}
          disabled={run.isRunning || unscored.length === 0}
        >
          {run.isRunning ? <Loader2 className="animate-spin" /> : <Sparkles />}
          Auto tag all ({unscored.length})
        </Button>
        <Button
          variant="outline"
          onClick={() => void run.run(unscored.slice(0, 10))}
          disabled={run.isRunning || unscored.length === 0}
          title="Score the 10 most recently saved unscored articles"
        >
          Tag next 10
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            // Re-scoring costs a Jev request per article, so a misclick is expensive.
            if (window.confirm(`Remove Jev tags from ${scored.length} article(s)?`)) {
              void run.clear(scored)
            }
          }}
          disabled={run.isRunning || scored.length === 0}
        >
          <Eraser />
          Clear all tags ({scored.length})
        </Button>
        <p className="ml-auto text-sm text-muted-foreground">
          A tag is applied at {TAG_THRESHOLD} or above · {scored.length} scored
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
