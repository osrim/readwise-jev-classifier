import { useState, type ReactNode } from 'react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import {
  createColumnHelper,
  createSortedRowModel,
  flexRender,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { ArrowUpDown, ExternalLink, Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ArticleRecord } from '@/lib/pb'
import { appliedTags, isScored, TAG_THRESHOLD, uncertainTags } from '@/lib/tags'

// v9 tree-shakes anything not registered here.
const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
})

dayjs.extend(relativeTime)

const column = createColumnHelper<typeof features, ArticleRecord>()

/** The one column each page owns. The rest of the table is shared. */
export type ResultColumn = {
  header: string
  /** Sort key. Rows with no answer rank below rows that have one. */
  rank: (article: ArticleRecord) => number
  /** Must render its own "nothing asked yet" state. */
  cell: (article: ArticleRecord) => ReactNode
  isAnswered: (article: ArticleRecord) => boolean
}

export type ArticleTableProps = {
  data: ArticleRecord[]
  /** PocketBase record ids in flight. */
  pending: Set<string>
  errors: Record<string, string>
  result: ResultColumn
  onRun: (article: ArticleRecord) => void
}

export function ArticleTable({ data, pending, errors, result, onRun }: ArticleTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'saved_at', desc: true }])

  const columns: ColumnDef<typeof features, ArticleRecord>[] = [
    column.accessor('title', {
      header: 'Article',
      sortFn: 'alphanumeric',
      cell: ({ row }) => <TitleCell article={row.original} />,
    }),
    column.accessor('summary', {
      header: 'Meta description',
      enableSorting: false,
      cell: ({ getValue }) => (
        <p className="line-clamp-3 max-w-2xs text-sm whitespace-normal text-muted-foreground">
          {getValue() || <span className="italic">none</span>}
        </p>
      ),
    }),
    column.accessor((row) => (row.saved_at ? dayjs(row.saved_at).valueOf() : 0), {
      id: 'saved_at',
      header: 'Saved',
      sortFn: 'basic',
      cell: ({ row }) => <SavedCell savedAt={row.original.saved_at} />,
    }),
    column.accessor((row) => result.rank(row), {
      id: 'result',
      header: result.header,
      sortFn: 'basic',
      cell: ({ row }) => (
        <ResultCell
          article={row.original}
          isPending={pending.has(row.original.id)}
          error={errors[row.original.id]}
          render={result.cell}
        />
      ),
    }),
    column.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <ActionsCell
          article={row.original}
          isPending={pending.has(row.original.id)}
          answered={result.isAnswered(row.original)}
          onRun={onRun}
        />
      ),
    }),
  ] as ColumnDef<typeof features, ArticleRecord>[]

  const table = useTable({
    features,
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
  })

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.column.getCanSort() ? (
                    <button
                      type="button"
                      className="flex items-center gap-1 hover:text-foreground"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <ArrowUpDown className="size-3 opacity-50" />
                    </button>
                  ) : (
                    flexRender(header.column.columnDef.header, header.getContext())
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                Nothing fetched yet. Use “Fetch next 10” above.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className="align-top">
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id} className="py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function TitleCell({ article }: { article: ArticleRecord }) {
  return (
    <div className="max-w-xs space-y-1">
      <a
        href={article.source_url}
        target="_blank"
        rel="noreferrer"
        className="group flex items-start gap-1 font-medium hover:underline"
      >
        <span className="line-clamp-2">{article.title}</span>
        <ExternalLink className="mt-1 size-3 shrink-0 opacity-0 group-hover:opacity-60" />
      </a>
      <p className="truncate text-xs text-muted-foreground">
        {article.site_name || new URL(article.source_url || 'https://unknown').hostname}
      </p>
      {article.existing_tags.length > 0 && (
        <p className="text-xs text-muted-foreground">
          already tagged: {article.existing_tags.join(', ')}
        </p>
      )}
    </div>
  )
}

function SavedCell({ savedAt }: { savedAt: string }) {
  const saved = dayjs(savedAt)
  if (!savedAt || !saved.isValid()) {
    return <span className="text-sm text-muted-foreground">—</span>
  }
  return (
    <span className="whitespace-nowrap text-sm text-muted-foreground" title={saved.format('YYYY-MM-DD HH:mm')}>
      {saved.fromNow()}
    </span>
  )
}

function ResultCell({
  article,
  isPending,
  error,
  render,
}: {
  article: ArticleRecord
  isPending: boolean
  error?: string
  render: (article: ArticleRecord) => ReactNode
}) {
  if (isPending) {
    return (
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> asking…
      </span>
    )
  }
  if (error) {
    return <span className="text-sm text-destructive">{error}</span>
  }
  return render(article)
}

export function TagCell({ article }: { article: ArticleRecord }) {
  if (!isScored(article.scores)) {
    return <span className="text-sm text-muted-foreground">not scored</span>
  }

  const tags = appliedTags(article.scores)
  // A noul value is its own confidence, so a mid-band score means "cannot
  // tell" rather than no. The cell shows those for review.
  const unsure = uncertainTags(article.scores)

  if (tags.length === 0 && unsure.length === 0) {
    return <span className="text-sm text-muted-foreground">no tag reached {TAG_THRESHOLD}</span>
  }

  return (
    <div className="max-w-xs space-y-1.5">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map(({ tag, score }) => (
            <Badge key={tag.id} variant="secondary" title={tag.question}>
              {tag.label}
              <span className="ml-1 tabular-nums opacity-60">{score}</span>
            </Badge>
          ))}
        </div>
      )}
      {unsure.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-xs text-muted-foreground">unsure</span>
          {unsure.map(({ tag, score }) => (
            <Badge
              key={tag.id}
              variant="outline"
              className="border-dashed text-muted-foreground"
              title={tag.question}
            >
              {tag.label}
              <span className="ml-1 tabular-nums opacity-60">{score}</span>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

function ActionsCell({
  article,
  isPending,
  answered,
  onRun,
}: {
  article: ArticleRecord
  isPending: boolean
  answered: boolean
  onRun: (article: ArticleRecord) => void
}) {
  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={isPending || answered} onClick={() => onRun(article)}>
        Ask Jev
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={isPending || !answered}
        onClick={() => onRun(article)}
      >
        Retry
      </Button>
    </div>
  )
}
