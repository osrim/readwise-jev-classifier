import type { JevSample } from './jev.ts'

/**
 * Jev request timings for the whole session, shared by every page. Lossy on
 * purpose: `prune` drops samples older than the displayed window, so this
 * never grows with the length of the session.
 */
let samples: JevSample[] = []
let inFlight = 0

const listeners = new Set<() => void>()
const emit = () => {
  for (const listener of listeners) listener()
}

export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// useSyncExternalStore needs a stable snapshot between changes. A new array
// on every read would re-render forever.
export const getSamples = () => samples
export const getInFlight = () => inFlight

export function beginRun(count: number) {
  inFlight += count
  emit()
}

export function record(sample: JevSample) {
  inFlight = Math.max(0, inFlight - 1)
  samples = [...samples, sample]
  emit()
}

export function clear() {
  samples = []
  inFlight = 0
  emit()
}

export function prune(windowMs: number, now = Date.now()) {
  const cutoff = now - windowMs
  // Scan instead of checking the head: the window holds a few hundred samples
  // at most, and they need not be in order.
  if (!samples.some((sample) => sample.t < cutoff)) return
  samples = samples.filter((sample) => sample.t >= cutoff)
  emit()
}

export type Bucket = {
  /** Seconds relative to now. -59 is the oldest bucket of a one-minute window. */
  t: number
  ok: number
  failed: number
  /** Null where no request finished in the bucket, so the line breaks. */
  p50: number | null
  p95: number | null
  range: [number, number] | null
}

const quantile = (sorted: number[], q: number) =>
  sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)]!

/**
 * One point per interval whether or not traffic arrived, with latency
 * summarised per bucket rather than per request.
 */
export function bucketize(
  all: JevSample[],
  windowMs: number,
  bucketMs: number,
  now = Date.now(),
): Bucket[] {
  const count = Math.max(1, Math.round(windowMs / bucketMs))
  const end = Math.floor(now / bucketMs) * bucketMs
  const start = end - (count - 1) * bucketMs

  const latencies: number[][] = Array.from({ length: count }, () => [])
  const buckets: Bucket[] = Array.from({ length: count }, (_, i) => ({
    t: ((start + i * bucketMs - end) / 1000),
    ok: 0,
    failed: 0,
    p50: null,
    p95: null,
    range: null,
  }))

  for (const sample of all) {
    const index = Math.floor((sample.t - start) / bucketMs)
    if (index < 0 || index >= count) continue
    const bucket = buckets[index]!
    if (sample.ok) bucket.ok++
    else bucket.failed++
    latencies[index]!.push(sample.ms)
  }

  for (const [index, bucket] of buckets.entries()) {
    const sorted = latencies[index]!.sort((a, b) => a - b)
    if (sorted.length === 0) continue
    bucket.p50 = Math.round(quantile(sorted, 0.5))
    bucket.p95 = Math.round(quantile(sorted, 0.95))
    bucket.range = [Math.round(sorted[0]!), Math.round(sorted[sorted.length - 1]!)]
  }

  return buckets
}

/** The tile answers "how fast right now", so the rate reads a short span. */
const RATE_SPAN_MS = 10_000

export function summary(all: JevSample[], now = Date.now()) {
  const sorted = all.map((sample) => sample.ms).sort((a, b) => a - b)
  return {
    total: all.length,
    failed: all.filter((sample) => !sample.ok).length,
    perSecond: rate(all, now),
    p50: sorted.length ? Math.round(quantile(sorted, 0.5)) : 0,
    p95: sorted.length ? Math.round(quantile(sorted, 0.95)) : 0,
  }
}

/**
 * Requests per second over the last few seconds. Two denominators look
 * plausible here and both climb instead of reporting a rate: the nominal
 * window counts time that has not elapsed yet, and the span back to the oldest
 * retained sample counts an idle gap left by an earlier run. This counts only
 * the time observed inside the recent span, floored at a second so a burst
 * landing in one tick does not extrapolate.
 */
function rate(all: JevSample[], now: number) {
  const recent = all.filter((sample) => sample.t >= now - RATE_SPAN_MS)
  if (recent.length === 0) return 0
  const oldest = recent.reduce((min, sample) => Math.min(min, sample.t), now)
  return recent.length / (Math.max(1_000, now - oldest) / 1000)
}
