import PocketBase, { type RecordModel } from 'pocketbase'

import type { Triage } from './triage.ts'

// `import.meta.env` exists under Vite only. The test runner loads this module
// for its record types, so the read must survive its absence.
const env = (import.meta as { env?: { VITE_PB_URL?: string } }).env

export const pb = new PocketBase(env?.VITE_PB_URL ?? 'http://127.0.0.1:8090')

// Requests to one collection run in parallel here. PocketBase cancels all but
// the last of them by default.
pb.autoCancellation(false)

export type ArticleRecord = RecordModel & {
  readwise_id: string
  title: string
  source_url: string
  summary: string
  site_name: string
  author: string
  saved_at: string
  existing_tags: string[]
  /** Keyed by tag id, 0-100. Empty until Jev scores the article. */
  scores: Record<string, number>
  triage: Triage | null
}

export type SyncStateRecord = RecordModel & {
  source: string
  next_cursor: string
  exhausted: boolean
}

export const articles = () => pb.collection<ArticleRecord>('articles')
export const syncState = () => pb.collection<SyncStateRecord>('sync_state')
