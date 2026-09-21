import * as z from 'zod'

import { askJev, INSPECT } from './jev.ts'
import type { ArticleRecord } from './pb.ts'

/**
 * Criteria here describe the article, never the reader. Jev sees a title and a
 * meta description and cannot know who is asking.
 */

export type Verdict = 'read_now' | 'skim' | 'reference' | 'drop'

export const VERDICTS: { id: Verdict; label: string; hint: string }[] = [
  { id: 'read_now', label: 'Read now', hint: 'substantial, and current enough to lose by waiting' },
  { id: 'skim', label: 'Skim', hint: 'one idea — the title already gives most of it away' },
  { id: 'reference', label: 'Keep as reference', hint: 'look it up when the need comes up' },
  { id: 'drop', label: 'Drop', hint: 'promotional, thin, or something you already know' },
]

const VERDICT_RANK: Record<Verdict, number> = { drop: 0, reference: 1, skim: 2, read_now: 3 }

const VERDICT_CRITERIA: Record<Verdict, string> = {
  read_now:
    'Reports something substantial and current: news, results or an argument that matters within weeks.',
  skim: 'Carries one idea that the title and description already mostly give away.',
  reference:
    'Documentation, a tutorial, a spec or a tool page — worth having when the need comes up, not worth reading front to back.',
  drop: 'Promotional copy, listicle filler, or a restatement of what the audience already knows.',
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
      instructions: { question: 'What should be done with this article?', inspect: INSPECT },
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
