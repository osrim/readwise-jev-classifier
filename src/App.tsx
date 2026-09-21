import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Loader2, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

import { ReadwiseLogo } from '@/components/logos'
import { MetricsPanel } from '@/components/metrics-panel'
import { TagsPage } from '@/pages/tags-page'
import { TriagePage } from '@/pages/triage-page'
import { Button } from '@/components/ui/button'
import { articles } from '@/lib/pb'
import { fetchNextBatch, getSyncState, resetCursor } from '@/lib/readwise'

const message = (error: unknown) => (error instanceof Error ? error.message : String(error))

const PAGES = { tags: 'Tags', triage: 'Triage' } as const
type Page = keyof typeof PAGES

/** Two pages, so the hash is the whole router. */
function usePage(): [Page, (page: Page) => void] {
  const [hash, setHash] = useState(() => window.location.hash.slice(1))
  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash.slice(1))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const page: Page = hash in PAGES ? (hash as Page) : 'tags'
  return [page, (next) => { window.location.hash = next }]
}

export default function App() {
  const queryClient = useQueryClient()
  const [page, setPage] = usePage()

  const articlesQuery = useQuery({
    queryKey: ['articles'],
    queryFn: () => articles().getFullList({ sort: '-saved_at' }),
  })
  const syncQuery = useQuery({ queryKey: ['sync'], queryFn: getSyncState })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['articles'] })
    void queryClient.invalidateQueries({ queryKey: ['sync'] })
  }

  const fetchBatch = useMutation({
    mutationFn: fetchNextBatch,
    onSuccess: ({ added, updated, exhausted }) => {
      toast.success(
        exhausted && added === 0
          ? 'Inbox fully fetched — nothing left.'
          : `Fetched ${added} new${updated ? `, refreshed ${updated}` : ''}.`,
      )
      refresh()
    },
    onError: (error) => toast.error(message(error)),
  })

  const reset = useMutation({
    mutationFn: resetCursor,
    onSuccess: () => {
      toast.success('Cursor cleared — next fetch starts from the top.')
      refresh()
    },
  })

  const rows = articlesQuery.data ?? []
  const exhausted = syncQuery.data?.exhausted ?? false

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Readwise × Jev</h1>
        <p className="text-sm text-muted-foreground">
          Proof of concept — answers are stored locally and never written back to Readwise.
        </p>
      </header>

      <MetricsPanel />

      <nav className="flex gap-1 border-b">
        {(Object.keys(PAGES) as Page[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setPage(id)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-sm ${
              page === id
                ? 'border-foreground font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {PAGES[id]}
          </button>
        ))}
      </nav>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
        <ReadwiseLogo />
        <Button onClick={() => fetchBatch.mutate(10)} disabled={fetchBatch.isPending || exhausted}>
          {fetchBatch.isPending ? <Loader2 className="animate-spin" /> : <Download />}
          Fetch next 10
        </Button>
        <Button
          variant="outline"
          onClick={() => fetchBatch.mutate(100)}
          disabled={fetchBatch.isPending || exhausted}
        >
          Fetch next 100
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => reset.mutate()}
          disabled={reset.isPending}
          title="Forget the Readwise cursor and start from the top of the inbox"
        >
          <RotateCcw />
          Reset cursor
        </Button>

        <p className="ml-auto text-sm text-muted-foreground">
          {rows.length} stored
          {exhausted && ' · inbox exhausted'}
        </p>
      </div>

      {articlesQuery.isError ? (
        <p className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Cannot reach PocketBase: {message(articlesQuery.error)}. Run <code>npm run pb</code>.
        </p>
      ) : page === 'triage' ? (
        <TriagePage rows={rows} />
      ) : (
        <TagsPage rows={rows} />
      )}
    </main>
  )
}
