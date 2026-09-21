import assert from 'node:assert/strict'
import { test } from 'node:test'

import { appliedTags, isScored, TAGS, TAG_THRESHOLD, uncertainTags, UNCERTAIN_BAND } from './tags.ts'

test('ids are safe to use as Jev question keys', () => {
  for (const tag of TAGS) {
    assert.match(tag.id, /^[a-z][a-z0-9_]*$/, `${tag.id} is not a plain identifier`)
  }
})

test('ids and labels are unique', () => {
  assert.equal(new Set(TAGS.map((t) => t.id)).size, TAGS.length)
  assert.equal(new Set(TAGS.map((t) => t.label)).size, TAGS.length)
})

// "Ask the most explicit, narrow, specific, atomic questions you can. Keep
// questions short." Scope belongs in criteria.true.what, not in the question.
const MAX_QUESTION_CHARS = 70

test('questions stay short and atomic', () => {
  for (const tag of TAGS) {
    assert.ok(tag.question.endsWith('?'), `${tag.id} question is not a question`)
    assert.ok(
      tag.question.length <= MAX_QUESTION_CHARS,
      `${tag.id} question is ${tag.question.length} chars, over ${MAX_QUESTION_CHARS}`,
    )
    assert.ok(
      !tag.question.includes(':'),
      `${tag.id} question enumerates scope; move it to criteria.true.what`,
    )
  }
})

test('every tag gives both sides of the boundary, with examples', () => {
  for (const side of ['true', 'false'] as const) {
    for (const tag of TAGS) {
      const criterion = tag.criteria[side]
      assert.ok(criterion.what.length > 0, `${tag.id} ${side} has no "what"`)
      assert.ok(criterion.examples.length >= 2, `${tag.id} ${side} needs 2+ examples`)
      for (const example of criterion.examples) {
        assert.ok(example.length > 0, `${tag.id} ${side} has an empty example`)
      }
    }
  }
})

test('uncertainTags picks up the band below the threshold', () => {
  const [low] = UNCERTAIN_BAND
  const [a, b, c] = TAGS
  const scores = { [a.id]: low - 1, [b.id]: low + 5, [c.id]: TAG_THRESHOLD }
  assert.deepEqual(
    uncertainTags(scores).map((t) => t.tag.id),
    [b.id],
    'expected only the mid-band score',
  )
  assert.deepEqual(
    appliedTags(scores).map((t) => t.tag.id),
    [c.id],
    'applied and uncertain must not overlap',
  )
})

test('appliedTags keeps scores at the threshold and drops those below', () => {
  const [a, b, c] = TAGS
  const applied = appliedTags({
    [a.id]: TAG_THRESHOLD - 1,
    [b.id]: TAG_THRESHOLD,
    [c.id]: 100,
  })
  assert.deepEqual(
    applied.map((t) => t.tag.id),
    [c.id, b.id],
    'expected highest first, and the sub-threshold score dropped',
  )
})

test('appliedTags ignores scores for tags that no longer exist', () => {
  assert.deepEqual(appliedTags({ retired_tag: 100 }), [])
  assert.deepEqual(appliedTags(null), [])
})

test('isScored counts any stored answer, including an orphaned tag id', () => {
  assert.equal(isScored(null), false)
  assert.equal(isScored(undefined), false)
  assert.equal(isScored({}), false)
  assert.equal(isScored({ [TAGS[0]!.id]: 0 }), true, 'a confident no is still an answer')
  assert.equal(isScored({ tag_that_was_renamed: 91 }), true, 'orphaned scores still occupy the row')
})
