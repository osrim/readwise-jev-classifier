import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'

import {
  beginRun,
  bucketize,
  clear,
  getInFlight,
  getSamples,
  prune,
  record,
  subscribe,
  summary,
} from './samples.ts'

const at = (t: number, ms: number, ok = true) => ({ t, ms, ok })

beforeEach(() => {
  clear()
})

test('record decrements the in-flight count a run announced', () => {
  beginRun(3)
  assert.equal(getInFlight(), 3)

  record(at(1000, 100))
  record(at(1000, 100))

  assert.equal(getInFlight(), 1)
  assert.equal(getSamples().length, 2)
})

test('in-flight never goes negative', () => {
  record(at(1000, 100))
  assert.equal(getInFlight(), 0)
})

test('the snapshot is stable between changes, so React can subscribe to it', () => {
  record(at(1000, 100))
  const first = getSamples()

  assert.equal(getSamples(), first, 'same reference while nothing changed')
  record(at(1100, 120))
  assert.notEqual(getSamples(), first, 'new reference once it did')
})

test('prune drops what aged out of the window and leaves the rest', () => {
  const now = 100_000
  record(at(now - 90_000, 10))
  record(at(now - 30_000, 20))
  record(at(now - 1_000, 30))

  prune(60_000, now)

  assert.deepEqual(
    getSamples().map((s) => s.ms),
    [20, 30],
  )
})

test('prune notifies only when something actually aged out', () => {
  const now = 100_000
  record(at(now - 1_000, 30))
  let notifications = 0
  subscribe(() => notifications++)

  prune(60_000, now)
  assert.equal(notifications, 0, 'nothing to drop, no re-render')

  record(at(now - 90_000, 10))
  prune(60_000, now)
  assert.equal(notifications, 2, 'one for the record, one for the prune')
})

test('bucketize returns one bucket per interval whether or not traffic arrived', () => {
  const now = 600_000
  const buckets = bucketize([at(now - 2_500, 100)], 60_000, 1_000, now)

  assert.equal(buckets.length, 60)
  assert.equal(buckets.at(-1)!.t, 0, 'last bucket is now')
  assert.equal(buckets[0]!.t, -59)
  assert.equal(
    buckets.filter((b) => b.ok > 0).length,
    1,
    'the other 59 are present but empty',
  )
})

test('an empty interval has no latency point, so the line breaks instead of bridging', () => {
  const now = 600_000
  const buckets = bucketize([at(now - 500, 100)], 60_000, 1_000, now)

  const quiet = buckets[0]!
  assert.equal(quiet.p50, null)
  assert.equal(quiet.p95, null)
  assert.equal(quiet.range, null)
  assert.equal(quiet.ok, 0)
})

test('latency is summarised per bucket, not one point per request', () => {
  const now = 600_600
  const sameSecond = [10, 20, 30, 40, 500].map((ms) => at(now - 500, ms))

  const bucket = bucketize(sameSecond, 60_000, 1_000, now).at(-1)!

  assert.equal(bucket.ok, 5)
  assert.equal(bucket.p50, 30)
  assert.equal(bucket.p95, 500)
  assert.deepEqual(bucket.range, [10, 500])
})

test('failures are counted apart from successes in the same bucket', () => {
  const now = 600_600
  const buckets = bucketize(
    [at(now - 200, 100), at(now - 200, 900, false), at(now - 200, 150)],
    60_000,
    1_000,
    now,
  )

  const bucket = buckets.at(-1)!
  assert.equal(bucket.ok, 2)
  assert.equal(bucket.failed, 1)
  assert.deepEqual(bucket.range, [100, 900], 'a failed request still took time')
})

test('samples outside the window are ignored rather than piled into the edge bucket', () => {
  const now = 600_000
  const buckets = bucketize([at(now - 120_000, 100), at(now - 500, 200)], 60_000, 1_000, now)

  assert.equal(
    buckets.reduce((sum, b) => sum + b.ok, 0),
    1,
  )
})

test('a wider window rolls up into the same number of buckets', () => {
  const now = 600_000
  const buckets = bucketize([at(now - 12_000, 100)], 300_000, 5_000, now)

  assert.equal(buckets.length, 60)
  assert.equal(buckets.filter((b) => b.ok > 0).length, 1)
})

test('summary reports percentiles over the whole window', () => {
  const stats = summary([at(1, 10), at(2, 20), at(3, 30), at(4, 40, false)])

  assert.equal(stats.total, 4)
  assert.equal(stats.failed, 1)
  assert.equal(stats.p50, 20)
  assert.equal(stats.p95, 40)
})

test('summary of nothing is zeroes, not NaN', () => {
  assert.deepEqual(summary([]), { total: 0, failed: 0, p50: 0, p95: 0 })
})

test('the newest bucket is the one still open, so an aligned clock leaves it empty', () => {
  // now sits exactly on a bucket edge: the last bucket has just opened and
  // covers [now, now + 1s), so a request that settled 500ms ago belongs to the
  // bucket before it.
  const aligned = bucketize([at(599_500, 100)], 60_000, 1_000, 600_000)

  assert.equal(aligned.at(-1)!.ok, 0)
  assert.equal(aligned.at(-2)!.ok, 1)

  // 600ms later the same request sits in the newest bucket.
  const running = bucketize([at(600_100, 100)], 60_000, 1_000, 600_600)
  assert.equal(running.at(-1)!.ok, 1)
})
