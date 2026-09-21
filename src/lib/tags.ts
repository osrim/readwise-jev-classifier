/**
 * Each tag is one Jev "noul" question: a yes/no proposition scored 0-1. All of
 * them go out in one request per article. `id` is the question key sent to
 * Jev. `label` is the form written back to Readwise.
 *
 * To add a tag, copy an entry and write both sides of its boundary. The README
 * explains why the criteria are contrastive.
 */
export type TagGroup = 'tech' | 'work' | 'broad'

/** One side of a noul boundary: what it covers, and titles that look like it. */
export type NoulCriterion = { what: string; examples: string[] }

export type Tag = {
  id: string
  label: string
  group: TagGroup
  /** A short proposition. Long questions hide several judgments behind one answer. */
  question: string
  /** Narrows attention where a sibling tag overlaps. Omit it when the line is obvious. */
  focus?: string
  criteria: { true: NoulCriterion; false: NoulCriterion }
}

/** A tag is applied when Jev's score reaches this, on a 0-100 scale. */
export const TAG_THRESHOLD = 80

/**
 * Below this, Jev is closer to "cannot tell" than to a confident no. Route
 * unconfident answers for review instead of reading them as negatives.
 */
export const UNCERTAIN_BAND: [number, number] = [40, TAG_THRESHOLD]

export const GROUP_LABELS: Record<TagGroup, string> = {
  tech: 'Tech',
  work: 'Product & work',
  broad: 'Broad interest',
}

export const TAGS: Tag[] = [
  // tech
  {
    id: 'frontend',
    label: 'frontend',
    group: 'tech',
    question: 'Is the article about code that runs in the browser?',
    focus: 'Browser-side application code, separate from the web platform itself.',
    criteria: {
      true: {
        what: 'Components, client state, styling, rendering, or accessibility in a browser application.',
        examples: [
          'Why your React list re-renders on every keystroke',
          'Container queries in production CSS',
        ],
      },
      false: {
        what: 'The browser is where a server, platform, or design topic happens to surface.',
        examples: ['How we cut API latency by 200ms', 'Our design system token migration'],
      },
    },
  },
  {
    id: 'backend',
    label: 'backend',
    group: 'tech',
    question: 'Is the article about code that runs on a server?',
    focus: 'Application code on the server, separate from the infrastructure it is deployed onto.',
    criteria: {
      true: {
        what: 'APIs, services, business logic, queues, jobs, or authentication implemented server-side.',
        examples: [
          'Designing an idempotent payment API',
          'Replacing our cron jobs with a work queue',
        ],
      },
      false: {
        what: 'The server is the counterpart to browser code, or infrastructure to operate.',
        examples: ['Tuning our Kubernetes autoscaler', 'Fetching data from React Server Components'],
      },
    },
  },
  {
    id: 'web_platform',
    label: 'web-platform',
    group: 'tech',
    question: 'Is the article about the web platform itself?',
    focus: 'The standards and engines every site shares, above any single application.',
    criteria: {
      true: {
        what: 'HTTP, browser engines, web standards, URLs, or how the web is built and governed.',
        examples: [
          'What HTTP/3 changes for connection reuse',
          'How the browser actually parses CSS',
        ],
      },
      false: {
        what: 'The article builds on the web platform to make a point about one application.',
        examples: ['Our migration from Webpack to Vite', 'Adding dark mode to our dashboard'],
      },
    },
  },
  {
    id: 'mobile',
    label: 'mobile',
    group: 'tech',
    question: 'Is the article about native mobile development?',
    criteria: {
      true: {
        what: 'iOS or Android development, their SDKs, or their app stores.',
        examples: ['SwiftUI navigation is still broken', 'Shrinking our Android APK by 40%'],
      },
      false: {
        what: 'Mobile is one delivery target among several, or only a screen size.',
        examples: [
          'Responsive tables without media queries',
          'Designing for thumbs: mobile UX patterns',
        ],
      },
    },
  },
  {
    id: 'devops_infra',
    label: 'devops-infra',
    group: 'tech',
    question: 'Is the article about running software in production?',
    focus: 'Operating and deploying systems, separate from the application code being deployed.',
    criteria: {
      true: {
        what: 'Deployment, CI/CD, containers, cloud infrastructure, observability, or on-call.',
        examples: [
          'Our Terraform modules after three rewrites',
          'What we learned from a four-hour outage',
        ],
      },
      false: {
        what: 'Production is the destination of an application or architecture topic.',
        examples: ['Choosing between REST and gRPC', 'Writing an idempotent job handler'],
      },
    },
  },
  {
    id: 'data',
    label: 'data',
    group: 'tech',
    question: 'Is the article about storing, querying, or analysing data?',
    focus: 'The data and its stores, separate from the services that read them.',
    criteria: {
      true: {
        what: 'Databases, query engines, pipelines, warehouses, or statistics.',
        examples: ['Postgres index bloat and how to spot it', 'Why our dbt models got slow'],
      },
      false: {
        what: 'A database is one component inside an application or infrastructure topic.',
        examples: ['Building a REST API in Go', 'Backing up volumes in Kubernetes'],
      },
    },
  },
  {
    id: 'ai',
    label: 'ai',
    group: 'tech',
    question: 'Is the article about artificial intelligence?',
    focus: 'A model or AI system as the subject, separate from AI used incidentally as a tool.',
    criteria: {
      true: {
        what: 'Machine learning, large language models, agents, or model training and evaluation.',
        examples: [
          'Why retrieval quality dominates model choice',
          'Evaluating agents without ground truth',
        ],
      },
      false: {
        what: 'AI is a passing mention, or a tool the author happened to use.',
        examples: [
          'I rewrote my blog using an AI assistant',
          'The GPU shortage and datacenter economics',
        ],
      },
    },
  },
  {
    id: 'security',
    label: 'security',
    group: 'tech',
    question: 'Is the article about security?',
    criteria: {
      true: {
        what: 'Vulnerabilities, attacks, cryptography, authentication design, or privacy engineering.',
        examples: ['How we found an SSRF in our image proxy', 'Passkeys are finally usable'],
      },
      false: {
        what: 'Security is one requirement listed among several.',
        examples: ['Building a multi-tenant SaaS backend', 'Our SOC 2 audit timeline'],
      },
    },
  },
  {
    id: 'architecture',
    label: 'architecture',
    group: 'tech',
    question: 'Is the article about the shape of a system?',
    focus: 'Choosing between designs, separate from implementing inside one.',
    criteria: {
      true: {
        what: 'Service boundaries, distributed systems, scaling, or performance trade-offs.',
        examples: [
          'We moved from microservices back to a monolith',
          'Event sourcing was the wrong call',
        ],
      },
      false: {
        what: 'The article implements inside a design that is already chosen.',
        examples: ['Adding pagination to our GraphQL resolvers', 'Deploying a monolith on Fly.io'],
      },
    },
  },
  {
    id: 'testing',
    label: 'testing',
    group: 'tech',
    question: 'Is the article about establishing that software is correct?',
    criteria: {
      true: {
        what: 'Test design, test automation, type checking, code review, or debugging practice.',
        examples: ['Why our flaky tests were a clock problem', 'Property-based testing in anger'],
      },
      false: {
        what: 'Tests are one step inside a tutorial about something else.',
        examples: ['Build a CLI in Rust, with tests', 'Setting up a CI pipeline'],
      },
    },
  },
  {
    id: 'tooling',
    label: 'tooling',
    group: 'tech',
    question: 'Is the article about the tools a developer runs?',
    focus: 'The tool itself as the subject, separate from a tool used to demonstrate something else.',
    criteria: {
      true: {
        what: 'Editors, command line utilities, build systems, package managers, or local workflow.',
        examples: ['My ripgrep and fzf setup after ten years', 'Why we switched package managers'],
      },
      false: {
        what: 'A tool is the means of demonstrating another topic.',
        examples: ['Deploy a Next.js app with the Vercel CLI', 'Profiling Python with cProfile'],
      },
    },
  },
  {
    id: 'languages',
    label: 'languages',
    group: 'tech',
    question: 'Is the article about a programming language itself?',
    focus: 'The language or its implementation, separate from code written in it.',
    criteria: {
      true: {
        what: 'Syntax, type systems, semantics, compilers, or language design.',
        examples: ['What Rust got right about lifetimes', 'TypeScript variance, explained'],
      },
      false: {
        what: 'The language is the medium for an application, library, or algorithm topic.',
        examples: ['Building a web scraper in Python', 'A Go service that handles 50k rps'],
      },
    },
  },

  {
    id: 'coding_agents',
    label: 'coding-agents',
    group: 'tech',
    question: 'Is the article about AI agents that write or review code?',
    focus: 'Working with coding agents, separate from AI models in general.',
    criteria: {
      true: {
        what: 'Coding agents, agent harnesses, agent skills, or context engineering for them.',
        examples: [
          'Tell agents the why, not just the how',
          'Stuff nobody tells you about Claude skills',
        ],
      },
      false: {
        what: 'The model itself is the subject, or AI is only mentioned in passing.',
        examples: ['How LLMs actually work', 'The maths you need to start understanding LLMs'],
      },
    },
  },
  {
    id: 'code_review',
    label: 'code-review',
    group: 'tech',
    question: 'Is the article about reviewing code?',
    criteria: {
      true: {
        what: 'Review practice, review culture, or tools that review code.',
        examples: ['Code review responses: add context when it counts', 'Agentic code review'],
      },
      false: {
        what: 'Review is one step mentioned inside a wider process.',
        examples: ['A new era for software testing', 'Interviewing engineers in the AI era'],
      },
    },
  },
  {
    id: 'git',
    label: 'git',
    group: 'tech',
    question: 'Is the article about git itself?',
    criteria: {
      true: {
        what: 'Git commands, internals, configuration files, or history archaeology.',
        examples: ['git worktree gotchas', 'The git commands I run before reading any code'],
      },
      false: {
        what: 'Git is where the work happens rather than the subject.',
        examples: ['Disrupting supply chain attacks on npm and GitHub Actions', 'Agentic code review'],
      },
    },
  },
  {
    id: 'self_hosted',
    label: 'self-hosted',
    group: 'tech',
    question: 'Is the article about software you run on your own machines?',
    criteria: {
      true: {
        what: 'Self-hosting, local-only tools, or replacing a hosted service with one you operate.',
        examples: [
          'Self-hosted web mail client on Cloudflare Workers',
          'Self-hosted backup automation for databases and files',
        ],
      },
      false: {
        what: 'The software is a hosted service, or where it runs is not the point.',
        examples: ['How our free plan stays free', 'Disrupting supply chain attacks on npm'],
      },
    },
  },
  {
    id: 'local_first',
    label: 'local-first',
    group: 'tech',
    question: 'Is the article about software that works offline?',
    focus: 'Local data and sync as the design choice, separate from self-hosting a server.',
    criteria: {
      true: {
        what: 'Local-first architecture, offline sync, embedded databases, or on-device models.',
        examples: [
          'Local-first and real-time reactive apps with embedded SQLite',
          'How is Linear so fast? Local-first sync and instant loads',
        ],
      },
      false: {
        what: 'The software runs on a server you own, or connectivity is never discussed.',
        examples: ['Self-hosted email delivery platform', 'The startup Postgres survival guide'],
      },
    },
  },
  {
    id: 'macos',
    label: 'macos',
    group: 'tech',
    question: 'Is the article about macOS or Apple desktop software?',
    criteria: {
      true: {
        what: 'Mac applications, macOS customisation, or Apple desktop workflow.',
        examples: [
          '90+ one-click, reversible macOS power-ups',
          'Type with voice, anywhere on your Mac',
        ],
      },
      false: {
        what: 'The tool merely runs on a Mac, or the platform is iOS or Android.',
        examples: ['Life is too short for a slow terminal', 'Lima launches Linux virtual machines'],
      },
    },
  },
  {
    id: 'tool_launch',
    label: 'tool-launch',
    group: 'tech',
    question: 'Is this a landing page for software rather than an article?',
    focus: 'A page announcing or selling a tool, separate from prose written about one.',
    criteria: {
      true: {
        what: 'A product homepage, app store listing, or code repository README.',
        examples: [
          'GitHub - kepano/defuddle: Get the main content of any page as Markdown',
          'Beautiful terminal UI components. Zero config, one command setup.',
        ],
      },
      false: {
        what: 'A person is writing prose about a tool, a technique, or an experience.',
        examples: ['Life is too short for a slow terminal', 'My favorite keyboards'],
      },
    },
  },

  // work
  {
    id: 'product',
    label: 'product',
    group: 'work',
    question: 'Is the article about deciding what to build?',
    criteria: {
      true: {
        what: 'Product strategy, discovery, roadmaps, prioritisation, or user research.',
        examples: ['We killed our most requested feature', 'Running discovery without a researcher'],
      },
      false: {
        what: 'A product decision is background to an engineering or business topic.',
        examples: ['How we rebuilt search in six weeks', 'Our pricing page A/B test results'],
      },
    },
  },
  {
    id: 'design',
    label: 'design',
    group: 'work',
    question: 'Is the article about how something looks and feels to use?',
    focus: 'The design decision, separate from the frontend code that implements it.',
    criteria: {
      true: {
        what: 'Interaction, visual design, typography, or design systems.',
        examples: ['Stop using placeholder text as labels', 'Our type scale, three years on'],
      },
      false: {
        what: 'Design is one attribute of a product or frontend topic.',
        examples: ['Animating lists with the FLIP technique', 'What users asked for in our survey'],
      },
    },
  },
  {
    id: 'career',
    label: 'career',
    group: 'work',
    question: 'Is the article about working in tech?',
    criteria: {
      true: {
        what: 'Hiring, interviewing, management, team practice, compensation, or professional growth.',
        examples: ['What I look for in a staff engineer', 'Leaving management after two years'],
      },
      false: {
        what: 'A workplace observation sits inside a technical argument.',
        examples: ['Why our code review process is slow', 'Founding a company with three people'],
      },
    },
  },
  {
    id: 'startups',
    label: 'startups',
    group: 'work',
    question: 'Is the article about founding or running a young company?',
    criteria: {
      true: {
        what: 'Fundraising, early growth, founder decisions, or company building.',
        examples: ['What our seed round actually cost us', 'The first ten hires, in order'],
      },
      false: {
        what: 'A startup is the setting for a technical or product story.',
        examples: [
          'How we scaled to 1M users on one Postgres box',
          'Big tech layoffs and the job market',
        ],
      },
    },
  },

  {
    id: 'ai_impact',
    label: 'ai-impact',
    group: 'work',
    question: 'Is the article about what AI is doing to software work?',
    focus: 'The effect on engineers and their craft, separate from how the technology works.',
    criteria: {
      true: {
        what: 'How AI changes engineering practice, skills, hiring, metrics, or team motivation.',
        examples: [
          'AI is removing the middle class of software engineering',
          'Understanding is the new bottleneck',
        ],
      },
      false: {
        what: 'The article explains or builds AI rather than weighing its effect on work.',
        examples: ['How LLMs actually work', 'My agentic coding setup'],
      },
    },
  },
  {
    id: 'management',
    label: 'management',
    group: 'work',
    question: 'Is the article about leading other people?',
    focus: 'Managing a team, separate from your own career progression.',
    criteria: {
      true: {
        what: 'Managing people, leadership practice, delegation, org design, or influence.',
        examples: ['Three bad managers', 'Before you delegate, ask yourself these 6 questions'],
      },
      false: {
        what: 'The article is about your own trajectory rather than other people.',
        examples: ['Nine questions I now ask in interviews', 'Staff archetypes'],
      },
    },
  },
  {
    id: 'communication',
    label: 'communication',
    group: 'work',
    question: 'Is the article about how to write or speak at work?',
    criteria: {
      true: {
        what: 'Writing clearly, giving an opinion, being visible, or framing a message.',
        examples: ['Write for people', 'How to be direct and strategic'],
      },
      false: {
        what: 'The article is about what to decide rather than how to express it.',
        examples: ['The art of simplifying decisions', 'Three bad managers'],
      },
    },
  },
  {
    id: 'note_taking',
    label: 'note-taking',
    group: 'work',
    question: 'Is the article about capturing and organising notes?',
    criteria: {
      true: {
        what: 'Note applications, personal knowledge management, or reading and highlighting workflow.',
        examples: [
          'A second brain for the AI era, local-first and Markdown-based',
          'Ask questions across your Markdown notes with a local Graph RAG engine',
        ],
      },
      false: {
        what: 'The tool stores files or code rather than notes.',
        examples: [
          'A unified storage SDK for object and blob backends',
          'Get the main content of any page as Markdown',
        ],
      },
    },
  },

  // broad
  {
    id: 'business',
    label: 'business',
    group: 'broad',
    question: 'Is the article about commerce or the economy?',
    criteria: {
      true: {
        what: 'Markets, industry analysis, corporate strategy, or economics.',
        examples: ['The unit economics of grocery delivery', 'Why the cloud market consolidated'],
      },
      false: {
        what: 'A company is an example inside a technical or cultural topic.',
        examples: ['Inside Netflix chaos engineering', 'Our Series A story'],
      },
    },
  },
  {
    id: 'science',
    label: 'science',
    group: 'broad',
    question: 'Is the article about scientific research?',
    criteria: {
      true: {
        what: 'Physics, biology, chemistry, mathematics, space, or a research result.',
        examples: [
          'What the new gravitational wave data shows',
          'A proof that stood for forty years',
        ],
      },
      false: {
        what: 'A scientific fact serves as an analogy or supporting detail.',
        examples: ['Entropy, explained for programmers', 'The neuroscience of good management'],
      },
    },
  },
  {
    id: 'culture',
    label: 'culture',
    group: 'broad',
    question: 'Is the article about culture or society?',
    criteria: {
      true: {
        what: 'Art, literature, film, music, history, language, or how people live together.',
        examples: ['The lost typefaces of Soviet cinema', 'How the novel changed in 1922'],
      },
      false: {
        what: 'A cultural reference frames a technical or business argument.',
        examples: [
          'What jazz teaches about pair programming',
          'The attention economy and our roadmap',
        ],
      },
    },
  },
  {
    id: 'health',
    label: 'health',
    group: 'broad',
    question: 'Is the article about the human body or mind?',
    criteria: {
      true: {
        what: 'Medicine, fitness, nutrition, sleep, or mental health.',
        examples: ['What the sleep research actually says', 'Strength training after forty'],
      },
      false: {
        what: 'Health is one benefit listed inside a habit or lifestyle topic.',
        examples: ['My morning routine as a developer', 'Burnout and the on-call rotation'],
      },
    },
  },
  {
    id: 'finance',
    label: 'finance',
    group: 'broad',
    question: 'Is the article about money decisions?',
    criteria: {
      true: {
        what: 'Personal finance, investing, taxes, or financial markets.',
        examples: [
          'Index funds and the case against stock picking',
          'How RSUs are actually taxed',
        ],
      },
      false: {
        what: 'A price or valuation is evidence inside a business topic.',
        examples: ['Why our cloud bill tripled', 'The economics of open source funding'],
      },
    },
  },
  {
    id: 'politics',
    label: 'politics',
    group: 'broad',
    question: 'Is the article about politics or governance?',
    criteria: {
      true: {
        what: 'Elections, policy, law, regulation, or geopolitics.',
        examples: [
          'What the new privacy bill would require',
          'How export controls reshaped chips',
        ],
      },
      false: {
        what: 'A regulation is a constraint inside a technical or business topic.',
        examples: ['Making our app GDPR compliant', 'Content moderation at scale'],
      },
    },
  },
  {
    id: 'self_improvement',
    label: 'self-improvement',
    group: 'broad',
    question: 'Is the article about changing how you work or think?',
    criteria: {
      true: {
        what: 'Productivity systems, habits, learning methods, focus, or decision making.',
        examples: ['How I actually finish side projects', 'Deliberate practice for programmers'],
      },
      false: {
        what: 'A tip sits inside a technical or career narrative.',
        examples: ['My terminal setup for focus', 'What I learned from a failed migration'],
      },
    },
  },
  {
    id: 'outdoors',
    label: 'outdoors',
    group: 'broad',
    question: 'Is the article about outdoor sport or its gear?',
    criteria: {
      true: {
        what: 'Running, hiking, backpacking, racing, or the equipment and nutrition for them.',
        examples: [
          'Roll-top dry bag and pack liner, 43 litres',
          'Energy bars for long outings and races',
        ],
      },
      false: {
        what: 'Exercise appears as one part of a health or routine topic.',
        examples: ['Strength training after forty', 'My morning routine as a developer'],
      },
    },
  },
]

export const TAG_BY_ID = new Map(TAGS.map((t) => [t.id, t]))

/**
 * Any stored answer counts, including one under a tag id that was since
 * renamed. Those still occupy the record, and "Retry" refreshes them.
 */
export const isScored = (scores: Record<string, number> | null | undefined) =>
  Object.keys(scores ?? {}).length > 0

/** Scores at or above the threshold, highest first. */
export function appliedTags(scores: Record<string, number> | null | undefined) {
  return rank(scores, (score) => score >= TAG_THRESHOLD)
}

/** Scores Jev was unsure about: closer to "cannot tell" than to a confident no. */
export function uncertainTags(scores: Record<string, number> | null | undefined) {
  const [low, high] = UNCERTAIN_BAND
  return rank(scores, (score) => score >= low && score < high)
}

function rank(
  scores: Record<string, number> | null | undefined,
  keep: (score: number) => boolean,
) {
  if (!scores) return []
  return Object.entries(scores)
    .filter(([, score]) => keep(score))
    .sort(([, a], [, b]) => b - a)
    .map(([id, score]) => ({ tag: TAG_BY_ID.get(id), score }))
    .filter((t): t is { tag: Tag; score: number } => t.tag !== undefined)
}
