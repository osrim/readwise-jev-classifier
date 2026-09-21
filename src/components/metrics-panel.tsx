import { useEffect, useState, useSyncExternalStore } from 'react'
import { Area, Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import { ChevronDown, RotateCcw } from 'lucide-react'

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Button } from '@/components/ui/button'
import {
  bucketize,
  clear,
  getInFlight,
  getSamples,
  prune,
  subscribe,
  summary,
  type Bucket,
} from '@/lib/samples'

/** Each window rolls up into about 60 buckets. */
const WINDOWS = [
  { label: '1m', ms: 60_000, bucketMs: 1_000 },
  { label: '5m', ms: 300_000, bucketMs: 5_000 },
  { label: '15m', ms: 900_000, bucketMs: 15_000 },
]

/**
 * The `--chart-*` ramp is greyscale and identical in both modes, so each mode
 * picks its own step. Percentiles are ordered, so they read as one sequential
 * ramp rather than as unrelated categories.
 */
const config = {
  ok: { label: 'OK', theme: { light: 'var(--chart-3)', dark: 'var(--chart-2)' } },
  failed: { label: 'Failed', color: 'var(--destructive)' },
  p50: { label: 'p50', theme: { light: 'var(--chart-5)', dark: 'var(--chart-1)' } },
  p95: { label: 'p95', theme: { light: 'var(--chart-3)', dark: 'var(--chart-2)' } },
  range: { label: 'min–max', theme: { light: 'var(--chart-1)', dark: 'var(--chart-4)' } },
} satisfies ChartConfig

const intervalName = (bucketMs: number) =>
  bucketMs === 1000 ? 'second' : `${bucketMs / 1000} seconds`

const ago = (value: unknown) => {
  const seconds = Math.round(Number(value))
  return seconds === 0 ? 'now' : `${seconds}s`
}

export function MetricsPanel() {
  const samples = useSyncExternalStore(subscribe, getSamples)
  const inFlight = useSyncExternalStore(subscribe, getInFlight)

  const [open, setOpen] = useState(true)
  const [window, setWindow] = useState(WINDOWS[0]!)
  // The window must keep moving when no requests arrive, so the panel drives
  // its own clock instead of waiting for the next sample.
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => {
      prune(window.ms)
      setNow(Date.now())
    }, 1000)
    return () => clearInterval(id)
  }, [window])

  const buckets = bucketize(samples, window.ms, window.bucketMs, now)
  const stats = summary(samples, now)

  const tiles = [
    { label: 'In flight', value: inFlight },
    { label: 'Throughput', value: `${stats.perSecond.toFixed(2)}/s` },
    { label: 'Failed', value: stats.failed },
    { label: 'p50', value: `${stats.p50} ms` },
    { label: 'p95', value: `${stats.p95} ms` },
  ]

  return (
    <Card
      className="sticky top-0 z-10 gap-0 border-emerald-300 bg-emerald-50 py-4 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-50"
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="px-4">
          <CardTitle className="text-base">Throughput &amp; response time</CardTitle>
          <CardAction className="flex items-center gap-1">
            <div className="mr-1 flex items-center rounded-md border border-emerald-300 p-0.5 dark:border-emerald-800">
              {WINDOWS.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setWindow(option)}
                  className={`rounded px-2 py-0.5 text-xs ${
                    option.label === window.label
                      ? 'bg-emerald-200 font-medium dark:bg-emerald-800'
                      : 'text-emerald-800/70 hover:text-emerald-950 dark:text-emerald-200/70 dark:hover:text-emerald-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clear}
              className="hover:bg-emerald-100 dark:hover:bg-emerald-900"
              disabled={samples.length === 0}
              title="Drop every recorded timing and start the charts over"
            >
              <RotateCcw />
              Clear stats
            </Button>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="hover:bg-emerald-100 dark:hover:bg-emerald-900"
                aria-label={open ? 'Hide charts' : 'Show charts'}
              >
                {open ? 'Hide charts' : 'Show charts'}
                <ChevronDown
                  className={open ? 'rotate-180 transition-transform' : 'transition-transform'}
                />
              </Button>
            </CollapsibleTrigger>
          </CardAction>
        </CardHeader>

        {/* Outside the collapsible: collapsing leaves a compact stats bar stuck
            to the top, which is the point of keeping the panel there. */}
        <CardContent className="px-4 pt-4">
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-emerald-300 bg-emerald-300 sm:grid-cols-5 dark:border-emerald-800 dark:bg-emerald-800">
            {tiles.map((tile) => (
              <div key={tile.label} className="bg-emerald-100 px-3 py-2 dark:bg-emerald-900">
                <dt className="text-xs text-emerald-800/80 dark:text-emerald-200/70">
                  {tile.label}
                </dt>
                <dd className="font-mono text-xl tabular-nums">{tile.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>

        <CollapsibleContent>
          <CardContent className="grid gap-4 px-4 pt-4 lg:grid-cols-2">
            <Throughput buckets={buckets} bucketMs={window.bucketMs} />
            <Latency buckets={buckets} />
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

/** Axis ticks and grid default to the neutral tokens. Keep them green. */
const CHART_INK =
  'aspect-auto h-44 w-full [&_.recharts-cartesian-axis-tick_text]:fill-emerald-800/70 [&_.recharts-cartesian-grid_line[stroke=\'#ccc\']]:stroke-emerald-300/70 dark:[&_.recharts-cartesian-axis-tick_text]:fill-emerald-200/60'

const axis = {
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
} as const

function Throughput({ buckets, bucketMs }: { buckets: Bucket[]; bucketMs: number }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-emerald-800/80 dark:text-emerald-200/70">
        Requests per {intervalName(bucketMs)}
      </p>
      <ChartContainer config={config} className={CHART_INK}>
        <ComposedChart data={buckets} margin={{ left: 4, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} {...axis} tickFormatter={ago} />
          <YAxis width={36} allowDecimals={false} {...axis} tickMargin={4} />
          <ChartTooltip
            content={<ChartTooltipContent labelFormatter={(_l, items) => bucketLabel(items)} />}
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="ok" stackId="n" fill="var(--color-ok)" isAnimationActive={false} />
          <Bar
            dataKey="failed"
            stackId="n"
            fill="var(--color-failed)"
            radius={[2, 2, 0, 0]}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ChartContainer>
    </div>
  )
}

function Latency({ buckets }: { buckets: Bucket[] }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-emerald-800/80 dark:text-emerald-200/70">
        Response time
      </p>
      <ChartContainer config={config} className={CHART_INK}>
        <ComposedChart data={buckets} margin={{ left: 4, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} {...axis} tickFormatter={ago} />
          <YAxis width={44} {...axis} tickMargin={4} domain={[0, 'auto']} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_l, items) => bucketLabel(items)}
                formatter={(value, name) => (
                  <div className="flex flex-1 items-center justify-between gap-3">
                    <span className="text-muted-foreground">
                      {config[name as keyof typeof config]?.label ?? name}
                    </span>
                    <span className="font-mono tabular-nums">
                      {Array.isArray(value) ? `${value[0]}–${value[1]}` : String(value)} ms
                    </span>
                  </div>
                )}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Area
            dataKey="range"
            stroke="none"
            fill="var(--color-range)"
            fillOpacity={0.45}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            dataKey="p95"
            stroke="var(--color-p95)"
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={{ r: 2, strokeWidth: 0, fill: 'var(--color-p95)' }}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            dataKey="p50"
            stroke="var(--color-p50)"
            strokeWidth={2}
            dot={{ r: 2, strokeWidth: 0, fill: 'var(--color-p50)' }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ChartContainer>
    </div>
  )
}

function bucketLabel(items: readonly { payload?: unknown }[] | undefined) {
  const point = items?.[0]?.payload as Bucket | undefined
  return point ? (point.t === 0 ? 'this interval' : `${ago(point.t)} ago`) : ''
}
