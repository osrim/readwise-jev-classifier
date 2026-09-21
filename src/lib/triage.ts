import * as z from 'zod'

import { askJev, INSPECT } from './jev.ts'
import type { ArticleRecord } from './pb.ts'

/**
 * Criteria here describe the article, never the reader. Jev sees a title and a
 * meta description and cannot know who is asking.
 */

export type Verdict = 'read_now' | 'skim' | 'reference' | 'drop'

export const VERDICTS: { id: Verdict; label: string; hint: string }[] = [
  { id: 'read_now', label: 'Read now', hint: 'substantial, and loses value by waiting' },
  { id: 'skim', label: 'Skim', hint: 'one point, and the title already makes it' },
  { id: 'reference', label: 'Keep as reference', hint: 'look it up when the need comes up' },
  { id: 'drop', label: 'Drop', hint: 'promotional, filler, or no real claim' },
]

const VERDICT_RANK: Record<Verdict, number> = { drop: 0, reference: 1, skim: 2, read_now: 3 }

/** One option of a choice boundary: what it covers, and what belongs elsewhere. */
export type ChoiceCriterion = { what: string; not_for: string; examples: string[] }

/**
 * Every option states `not_for` against the sibling most likely to take the
 * article instead, so the model can compare the boundaries directly.
 */
export const VERDICT_CRITERIA: Record<Verdict, ChoiceCriterion> = {
  read_now: {
    what: 'A substantial argument, result, or news item that loses value by waiting.',
    not_for: 'Material that keeps indefinitely, or a single point the title already makes.',
    examples: [
      'What the EU AI Act text actually requires from model providers',
      'Postmortem: the four-hour outage that took checkout down',
    ],
  },
  skim: {
    what: 'One point that the title and description already mostly state. The body adds detail rather than a further idea.',
    not_for: 'An argument that needs its full text, or a page kept for looking things up.',
    examples: [
      'Why you should stop using barrel files',
      'We switched to pnpm and our CI got faster',
    ],
  },
  reference: {
    what: 'Documentation, a tutorial, a spec, or a tool page, consulted when a need comes up rather than read front to back.',
    not_for: 'A piece with a shelf life, or an argument meant to be read once.',
    examples: [
      'The Rust std::collections cheat sheet',
      'OpenTelemetry semantic conventions for HTTP spans',
    ],
  },
  drop: {
    what: 'Promotional copy, listicle filler, or a page that makes no substantive claim of its own.',
    not_for: 'A thin but genuine point, which is a skim.',
    examples: [
      'Transform your workflow with our AI-powered platform',
      'Top 10 programming languages to learn in 2026',
    ],
  },
}

export type Triage = {
  verdict: Verdict
  /** How firmly Jev picked that verdict over the others, 0-100. */
  confidence: number
}

const ChoiceAnswer = z.object({
  type: z.literal('choice'),
  choice: z.enum(['read_now', 'skim', 'reference', 'drop']),
  confidence: z.number().min(0).max(1),
})

export async function triageArticle(article: ArticleRecord): Promise<Triage> {
  const answers = await askJev(article, {
    verdict: {
      type: 'choice',
      instructions: {
        question: 'What should be done with this article?',
        inspect: INSPECT,
        focus: 'Judge the article itself, not whether any particular reader wants it.',
      },
      criteria: VERDICT_CRITERIA,
    },
  })

  const verdict = ChoiceAnswer.safeParse(answers.verdict)

  // An unusable answer must not read as a confident "drop". Fail instead.
  if (!verdict.success) {
    throw new Error(`Unexpected triage answers:\n${JSON.stringify(answers).slice(0, 300)}`)
  }

  return {
    verdict: verdict.data.choice,
    confidence: Math.round(verdict.data.confidence * 100),
  }
}

export const isTriaged = (triage: Triage | null | undefined): triage is Triage =>
  Boolean(triage?.verdict)

/** Worst verdict first, so the rows worth acting on sort to the top. */
export const triageRank = (triage: Triage | null | undefined) =>
  isTriaged(triage) ? VERDICT_RANK[triage.verdict] : -1
