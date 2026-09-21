import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import { askMany, pooled, scoreArticle, type JevResult } from './jev.ts'
import { TAGS } from './tags.ts'
import type { ArticleRecord } from './pb.ts'

const article = (id: string) =>
  ({
    id,
    title: `article ${id}`,
    summary: 'meta description',
    site_name: 'example.com',
    source_url: `https://example.com/${id}`,
  }) as ArticleRecord

/** A full answer set: Jev replies to every tag in one request. */
const answers = (noul: number) =>
  Object.fromEntries(TAGS.map((tag) => [tag.id, { type: 'noul', noul }]))

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

/** Replaces fetch and records how many calls were in flight at the peak. */
function stubFetch(handler: (call: number) => Promise<Response> | Response) {
  const state = { calls: 0, inFlight: 0, peak: 0 }
  globalThis.fetch = (async () => {
    state.inFlight++
    state.peak = Math.max(state.peak, state.inFlight)
    try {
      return await handler(++state.calls)
    } finally {
      state.inFlight--
    }
  }) as typeof fetch
  return state
}

test('scoreArticle scales every noul onto 0-100', async () => {
  stubFetch(() => json({ answers: answers(0.815) }))

  const scores = await scoreArticle(article('a'))

  assert.equal(Object.keys(scores).length, TAGS.length)
  assert.equal(scores[TAGS[0]!.id], 82)
})

test('scoreArticle sends one question per tag', async () => {
  let body: { questions: Record<string, unknown> } | undefined
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    body = JSON.parse(String(init.body))
    return json({ answers: answers(0) })
  }) as unknown as typeof fetch

  await scoreArticle(article('a'))

  assert.deepEqual(Object.keys(body!.questions).sort(), TAGS.map((t) => t.id).sort())
})

test('scoreArticle refuses a missing answer instead of scoring it 0', async () => {
  const partial = answers(0.9)
  delete partial[TAGS[3]!.id]
  stubFetch(() => json({ answers: partial }))

  await assert.rejects(
    scoreArticle(article('a')),
    new RegExp(`no usable answer for "${TAGS[3]!.id}"`),
  )
})

test('scoreArticle refuses an answer of the wrong type', async () => {
  // The envelope is valid; the answer is not a noul. Scoring it 0 would be worse
  // than failing.
  stubFetch(() => json({ answers: { [TAGS[0]!.id]: { type: 'choice', choice: 'yes' } } }))

  await assert.rejects(scoreArticle(article('a')), /no usable answer/)
})

test('scoreArticle rejects a malformed envelope', async () => {
  stubFetch(() => json({ answers: 'not a map' }))

  await assert.rejects(scoreArticle(article('a')), /Unexpected Jev response/)
})

test('scoreArticle retries a 429 and keeps the later answer', async () => {
  const state = stubFetch((call) =>
    call === 1 ? json({ error: 'slow down' }, 429) : json({ answers: answers(1) }),
  )

  const scores = await scoreArticle(article('a'))

  assert.equal(state.calls, 2)
  assert.equal(scores[TAGS[0]!.id], 100)
})

test('scoreArticle gives up on a status that is not retryable', async () => {
  const state = stubFetch(() => json({ error: 'bad key' }, 401))

  await assert.rejects(scoreArticle(article('a')), /Jev 401/)
  assert.equal(state.calls, 1)
})

test('askMany reports every article exactly once', async () => {
  stubFetch(() => json({ answers: answers(0.9) }))
  const seen: JevResult<Record<string, number>>[] = []

  const summary = await askMany([article('a'), article('b'), article('c')], scoreArticle, (result) => {
    seen.push(result)
  })

  assert.deepEqual(summary, { done: 3, failed: 0 })
  assert.deepEqual(seen.map((r) => r.article.id).sort(), ['a', 'b', 'c'])
  assert.ok(seen.every((r) => r.sample.ok && r.value))
})

test('askMany keeps going past a failure and counts it once', async () => {
  stubFetch((call) => (call === 2 ? json({ error: 'nope' }, 401) : json({ answers: answers(0.9) })))
  const seen: JevResult<Record<string, number>>[] = []

  const summary = await askMany(
    [article('a'), article('b'), article('c'), article('d')],
    scoreArticle,
    (result) => {
      seen.push(result)
    },
  )

  assert.equal(summary.failed, 1)
  assert.equal(summary.done, 3)
  assert.equal(seen.length, 4, 'every article is still reported')

  const failure = seen.find((r) => !r.sample.ok)!
  assert.ok(failure.error instanceof Error)
  assert.equal(failure.value, undefined, 'a failure must not look like a zero score')
})

test('askMany counts a failing onResult as a failure', async () => {
  stubFetch(() => json({ answers: answers(0.9) }))

  const summary = await askMany([article('a'), article('b')], scoreArticle, ({ article: a }) => {
    if (a.id === 'b') throw new Error('PocketBase is down')
  })

  assert.deepEqual(summary, { done: 1, failed: 1 })
})

test('askMany measures each request and never exceeds four in flight', async () => {
  const state = stubFetch(
    async () =>
      await new Promise<Response>((resolve) =>
        setTimeout(() => resolve(json({ answers: answers(0.5) })), 10),
      ),
  )
  const samples: number[] = []

  await askMany(
    Array.from({ length: 9 }, (_, i) => article(String(i))),
    scoreArticle,
    ({ sample }) => {
      samples.push(sample.ms)
    },
  )

  assert.equal(state.peak, 4, 'concurrency cap holds')
  assert.equal(samples.length, 9)
  assert.ok(
    samples.every((ms) => ms >= 10),
    'each sample covers its own request',
  )
})

test('pooled settles every item even when one rejects', async () => {
  const done: number[] = []

  const outcomes = await pooled(
    [1, 2, 3, 4, 5, 6],
    async (n) => {
      if (n === 1) throw new Error('first one fails')
      done.push(n)
    },
    2,
  )

  assert.deepEqual(done.sort(), [2, 3, 4, 5, 6])
  assert.equal(outcomes.length, 6)
  assert.equal(outcomes.filter((o) => o.error).length, 1)
  assert.equal(outcomes.find((o) => o.error)!.item, 1)
})

test('pooled runs nothing, and returns nothing, for an empty list', async () => {
  let ran = false

  const outcomes = await pooled([], async () => {
    ran = true
  })

  assert.equal(ran, false)
  assert.deepEqual(outcomes, [])
})
