import * as z from 'zod'

import { TAGS } from './tags.ts'
import type { ArticleRecord } from './pb.ts'

/** Relative: vite.config.ts proxies it and adds the TYPESAFE_API_KEY header. */
const JEV_URL = '/jev/v1/systemone'
const MODEL = 'jev-latest'

/**
 * The envelope only. Each question set knows the answer type it asked for and
 * parses its own answers, so one schema never widens to every Jev type.
 */
const SystemOneResponse = z.object({
  model: z.string().optional(),
  answers: z.record(z.string(), z.unknown()),
  usage: z
    .object({ input_tokens: z.number(), output_tokens: z.number() })
    .partial()
    .optional(),
})

// A noul answer is its own confidence, scored 0-1.
const NoulAnswer = z.object({
  type: z.literal('noul'),
  noul: z.number().min(0).max(1),
})

/**
 * What Jev sees. Readwise's `summary` is the page's meta description.
 *
 * The byline is left out on purpose: it predicts a topic only through what the
 * model already knows about that author, and System One guidance says not to
 * lean on knowledge stored in weights. `site` and `url` stay because the
 * domain and the slug are literal topic text.
 */
function articleState(article: ArticleRecord) {
  return {
    title: article.title,
    description: article.summary,
    site: article.site_name,
    url: article.source_url,
  }
}

export async function askJev(
  article: ArticleRecord,
  questions: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await postWithBackoff({ model: MODEL, state: articleState(article), questions })

  const parsed = SystemOneResponse.safeParse(await res.json())
  if (!parsed.success) {
    throw new Error(`Unexpected Jev response:\n${z.prettifyError(parsed.error)}`)
  }
  return parsed.data.answers
}

/** The state fields a question reads. Narrower than what `articleState` sends. */
export const INSPECT = ['title', 'description']

export async function scoreArticle(article: ArticleRecord): Promise<Record<string, number>> {
  const answers = await askJev(
    article,
    Object.fromEntries(
      TAGS.map((tag) => [
        tag.id,
        {
          type: 'noul',
          instructions: {
            question: tag.question,
            inspect: INSPECT,
            ...(tag.focus ? { focus: tag.focus } : {}),
          },
          criteria: tag.criteria,
        },
      ]),
    ),
  )

  return Object.fromEntries(
    TAGS.map((tag) => {
      // A missing or malformed answer must not read as "scored 0". That is
      // indistinguishable from a confident no.
      const answer = NoulAnswer.safeParse(answers[tag.id])
      if (!answer.success) throw new Error(`Jev gave no usable answer for "${tag.id}"`)
      return [tag.id, Math.round(answer.data.noul * 100)]
    }),
  )
}

/** 429 (rate limited) and 529 (overloaded) are the documented retryable codes. */
const RETRYABLE = new Set([429, 529])
const MAX_ATTEMPTS = 4

async function postWithBackoff(body: unknown): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(JEV_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) return res

    const retryable = RETRYABLE.has(res.status) && attempt < MAX_ATTEMPTS - 1
    if (!retryable) {
      throw new Error(`Jev ${res.status}: ${(await res.text()).slice(0, 300)}`)
    }
    await sleep(500 * 2 ** attempt)
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const CONCURRENCY = 4

/** One finished Jev request. Includes any backoff sleeps the retries spent. */
export type JevSample = { t: number; ms: number; ok: boolean }

export type JevResult<T> = {
  article: ArticleRecord
  sample: JevSample
  value?: T
  error?: Error
}

/**
 * `onResult` fires exactly once per article, awaited inside the pool slot so a
 * caller can persist the answer without widening the concurrency. A failure in
 * either the Jev request or `onResult` counts once in `failed` and never stops
 * the remaining articles.
 */
export async function askMany<T>(
  targets: ArticleRecord[],
  ask: (article: ArticleRecord) => Promise<T>,
  onResult: (result: JevResult<T>) => Promise<void> | void,
): Promise<{ done: number; failed: number }> {
  const outcomes = await pooled(targets, async (article) => {
    const started = performance.now()
    let result: JevResult<T>
    try {
      const value = await ask(article)
      result = { article, value, sample: sample(started, true) }
    } catch (error) {
      result = { article, error: asError(error), sample: sample(started, false) }
    }
    await onResult(result)
    if (result.error) throw result.error
  })

  const failed = outcomes.filter((outcome) => outcome.error).length
  return { done: targets.length - failed, failed }
}

const sample = (started: number, ok: boolean): JevSample => ({
  t: Date.now(),
  ms: performance.now() - started,
  ok,
})

const asError = (error: unknown) => (error instanceof Error ? error : new Error(String(error)))

export type Outcome<T> = { item: T; error?: unknown }

/**
 * Every item settles. A rejecting task becomes that item's outcome instead of
 * abandoning the rest, so callers count failures from the return value.
 */
export async function pooled<T>(
  items: T[],
  task: (item: T) => Promise<void>,
  concurrency = CONCURRENCY,
): Promise<Outcome<T>[]> {
  const outcomes: Outcome<T>[] = []
  let cursor = 0
  const worker = async () => {
    while (cursor < items.length) {
      const item = items[cursor++]!
      try {
        await task(item)
        outcomes.push({ item })
      } catch (error) {
        outcomes.push({ item, error })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return outcomes
}
