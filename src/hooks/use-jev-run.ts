import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { askMany, pooled } from '@/lib/jev'
import { articles, type ArticleRecord } from '@/lib/pb'
import { beginRun, record } from '@/lib/samples'

const message = (error: unknown) => (error instanceof Error ? error.message : String(error))

type RunOptions<T> = {
  ask: (article: ArticleRecord) => Promise<T>
  field: 'scores' | 'triage'
  /** Past tense, for the success toast. "Scored 12 articles." */
  verb: string
  /** What `clear` writes back. The value that reads as "never asked". */
  empty: ArticleRecord['scores'] | ArticleRecord['triage']
}

/**
 * Both pages differ only in the options above. The sequencing, the optimistic
 * write and the error accounting are one shared run.
 */
export function useJevRun<T>({ ask, field, verb, empty }: RunOptions<T>) {
  const queryClient = useQueryClient()
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Record<string, string>>({})

  const store = async (article: ArticleRecord, value: unknown) => {
    await articles().update(article.id, { [field]: value })
    // Refetching the whole list per article would mean one full read per
    // request in flight.
    queryClient.setQueryData<ArticleRecord[]>(['articles'], (rows) =>
      rows?.map((row) => (row.id === article.id ? { ...row, [field]: value } : row)),
    )
  }

  async function run(targets: ArticleRecord[]) {
    if (targets.length === 0) return
    const ids = targets.map((a) => a.id)
    // The metrics panel outlives this page, so it counts the run.
    beginRun(targets.length)
    setPending((prev) => new Set([...prev, ...ids]))
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !ids.includes(k))))

    const { failed } = await askMany(targets, ask, async ({ article, value, sample, error }) => {
      record(sample)
      try {
        if (error) throw error
        await store(article, value)
      } catch (failure) {
        setErrors((prev) => ({ ...prev, [article.id]: message(failure) }))
        throw failure
      } finally {
        setPending((prev) => {
          const next = new Set(prev)
          next.delete(article.id)
          return next
        })
      }
    })

    void queryClient.invalidateQueries({ queryKey: ['articles'] })
    if (failed > 0) toast.error(`${failed} of ${targets.length} failed.`)
    else toast.success(`${verb} ${targets.length} article${targets.length === 1 ? '' : 's'}.`)
  }

  async function clear(targets: ArticleRecord[]) {
    if (targets.length === 0) return
    const outcomes = await pooled(targets, (article) => store(article, empty))
    const failed = outcomes.filter((outcome) => outcome.error).length

    setErrors({})
    void queryClient.invalidateQueries({ queryKey: ['articles'] })
    if (failed > 0) toast.error(`${failed} of ${targets.length} could not be cleared.`)
    else toast.success(`Cleared ${targets.length} article${targets.length === 1 ? '' : 's'}.`)
  }

  return { pending, errors, run, clear, isRunning: pending.size > 0 }
}
