import { ClientResponseError } from 'pocketbase'
import * as z from 'zod'

import { articles, pb, syncState, type ArticleRecord, type SyncStateRecord } from './pb.ts'

/** Relative: vite.config.ts proxies it and adds the READWISE_TOKEN header. */
const LIST_URL = '/readwise/api/v3/list/'
const SOURCE = 'readwise-inbox'

// Readwise returns many more fields. Zod strips the unused ones.
const ReadwiseDoc = z.object({
  id: z.string(),
  title: z.string().nullish(),
  source_url: z.string().nullish(),
  /** The page's meta description. */
  summary: z.string().nullish(),
  site_name: z.string().nullish(),
  author: z.string().nullish(),
  saved_at: z.string().nullish(),
  tags: z.record(z.string(), z.unknown()).nullish(),
})

const ListResponse = z.object({
  count: z.number(),
  nextPageCursor: z.string().nullish(),
  results: z.array(ReadwiseDoc),
})

type ReadwiseDoc = z.infer<typeof ReadwiseDoc>

export async function getSyncState(): Promise<SyncStateRecord | null> {
  try {
    return await syncState().getFirstListItem(`source="${SOURCE}"`)
  } catch (error) {
    // 404 is the only "no cursor yet". Swallowing the rest would make an
    // unreachable PocketBase look like a fresh inbox.
    if (error instanceof ClientResponseError && error.status === 404) return null
    throw error
  }
}

function toArticle(doc: ReadwiseDoc) {
  return {
    readwise_id: doc.id,
    title: doc.title ?? '(untitled)',
    source_url: doc.source_url ?? '',
    summary: doc.summary ?? '',
    site_name: doc.site_name ?? '',
    author: doc.author ?? '',
    saved_at: doc.saved_at ?? '',
    existing_tags: Object.keys(doc.tags ?? {}),
  }
}

export type FetchResult = { added: number; updated: number; exhausted: boolean }

/**
 * The cursor in `sync_state` drives pagination, so repeated calls always
 * advance. The unique index on `readwise_id` is the second guard: a document
 * that reappears updates its row and keeps its scores.
 */
export async function fetchNextBatch(limit: number): Promise<FetchResult> {
  const state = await getSyncState()
  if (state?.exhausted) return { added: 0, updated: 0, exhausted: true }

  const params = new URLSearchParams({
    location: 'new',
    category: 'article',
    limit: String(limit),
  })
  if (state?.next_cursor) params.set('pageCursor', state.next_cursor)

  const res = await fetch(`${LIST_URL}?${params}`)
  if (!res.ok) {
    throw new Error(`Readwise ${res.status}: ${(await res.text()).slice(0, 300)}`)
  }

  const parsed = ListResponse.safeParse(await res.json())
  if (!parsed.success) {
    throw new Error(`Unexpected Readwise response:\n${z.prettifyError(parsed.error)}`)
  }
  const page = parsed.data

  const incoming = page.results.map(toArticle)
  const existing = await findExisting(incoming.map((a) => a.readwise_id))

  let added = 0
  let updated = 0
  for (const article of incoming) {
    const match = existing.get(article.readwise_id)
    if (match) {
      await articles().update(match.id, article)
      updated++
    } else {
      await articles().create({ ...article, scores: {} })
      added++
    }
  }

  const exhausted = !page.nextPageCursor
  const next = { source: SOURCE, next_cursor: page.nextPageCursor ?? '', exhausted }
  if (state) await syncState().update(state.id, next)
  else await syncState().create(next)

  return { added, updated, exhausted }
}

async function findExisting(ids: string[]): Promise<Map<string, ArticleRecord>> {
  if (ids.length === 0) return new Map()
  // Ids come from Readwise, so bind them as parameters instead of
  // interpolating them into the filter.
  const expr = ids.map((_, i) => `readwise_id={:id${i}}`).join(' || ')
  const params = Object.fromEntries(ids.map((id, i) => [`id${i}`, id]))
  const found = await articles().getFullList({ filter: pb.filter(expr, params) })
  return new Map(found.map((r) => [r.readwise_id, r]))
}

export async function resetCursor(): Promise<void> {
  const state = await getSyncState()
  if (state) await syncState().delete(state.id)
}
