import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import type { ArticleRecord } from './pb.ts'
import { isTriaged, triageArticle, triageRank, VERDICTS } from './triage.ts'

const article = { id: 'a', title: 'A post', summary: 'About something' } as ArticleRecord

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const ok = {
  verdict: { type: 'choice', choice: 'reference', confidence: 0.62, probabilities: {} },
}

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

const stub = (answers: unknown) => {
  const seen: { body?: { questions: Record<string, { type: string; criteria: unknown }> } } = {}
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    seen.body = JSON.parse(String(init.body))
    return json({ answers })
  }) as unknown as typeof fetch
  return seen
}

test('triageArticle asks exactly one question, and it is a choice', async () => {
  const seen = stub(ok)

  await triageArticle(article)

  const questions = seen.body!.questions
  assert.deepEqual(Object.keys(questions), ['verdict'])
  assert.equal(questions.verdict!.type, 'choice')
})

test('the verdict options on the wire are exactly the ones the UI renders', async () => {
  const seen = stub(ok)

  await triageArticle(article)

  assert.deepEqual(
    Object.keys(seen.body!.questions.verdict!.criteria as object).sort(),
    VERDICTS.map((v) => v.id).sort(),
  )
})

test('choice criteria go out as an option map, not a list', async () => {
  const seen = stub(ok)

  await triageArticle(article)

  assert.ok(!Array.isArray(seen.body!.questions.verdict!.criteria))
})

test('triageArticle scales confidence to 0-100', async () => {
  stub(ok)

  const triage = await triageArticle(article)

  assert.deepEqual(triage, { verdict: 'reference', confidence: 62 })
})

test('triageArticle refuses a missing answer instead of guessing a verdict', async () => {
  stub({})

  await assert.rejects(triageArticle(article), /Unexpected triage answers/)
})

test('triageArticle refuses an answer of the wrong type', async () => {
  stub({ verdict: { type: 'noul', noul: 0.9 } })

  await assert.rejects(triageArticle(article), /Unexpected triage answers/)
})

test('triageArticle refuses a verdict it does not know', async () => {
  stub({ ...ok, verdict: { type: 'choice', choice: 'file_under_later', confidence: 0.9 } })

  await assert.rejects(triageArticle(article), /Unexpected triage answers/)
})

test('triageRank sorts the worst verdict to the bottom and untriaged below that', () => {
  const rank = (verdict: string) => triageRank({ verdict, confidence: 50 } as never)

  assert.ok(rank('read_now') > rank('skim'))
  assert.ok(rank('skim') > rank('reference'))
  assert.ok(rank('reference') > rank('drop'))
  assert.ok(rank('drop') > triageRank(null), 'a verdict of drop still beats no verdict')
})

test('isTriaged only accepts a real verdict', () => {
  assert.equal(isTriaged(null), false)
  assert.equal(isTriaged(undefined), false)
  assert.equal(isTriaged({} as never), false)
  assert.equal(isTriaged({ verdict: 'drop', confidence: 1 }), true)
})

