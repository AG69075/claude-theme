import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'
import type { Ctx, Git, Pr, Run, Window } from '../types'

// Bande lecture seule : lit les chiffres du moteur et dessine. Seule exception : `gh pr view` (lecture) pour le segment PR.
const TICK_MS = 30_000
const PR_TICK_MS = 60_000 // la PR de la branche est relue chaque minute, et après un git push / gh pr
const CELLS = 10
// Palette aurora-noir : surface #090c15, vert #3affc0, violet #9f7bff, ambre #ffc46b.
const BG = '#090c15', MUTED = '#8996b0', EMPTY = '#1c2336'
const VIOLET = '#9f7bff', AMBER = '#ffc46b', GREEN = '#3affc0', RED = '#ff6b81'

const windows = atom({ plugin: 'usage-band', key: 'windows' } as const, [] as Window[])
const ctx = atom({ plugin: 'usage-band', key: 'ctx' } as const, null as Ctx | null)
const pr = atom({ plugin: 'usage-band', key: 'pr' } as const, null as Pr | null)
const git = atom({ plugin: 'usage-band', key: 'git' } as const, null as Git | null)
const run = atom({ plugin: 'usage-band', key: 'run' } as const, null as Run | null)
const pushAt = atom({ plugin: 'usage-band', key: 'pushAt' } as const, 0) // dernier git push lancé dans cette session

const RUN_SHOWN_MS = 30 * 60 * 1000 // un run terminé reste affiché 30 min
const RUN_FAST_MS = 20_000 // relu toutes les 20 s tant qu'un run tourne
let runActive = false
let runTick = 0

const ghRun = async ($: EngineInterface, args: string[]) => {
  for (const bin of ['gh', '/opt/homebrew/bin/gh', '/usr/local/bin/gh']) {
    try {
      return await $.process.run([bin, ...args], { timeoutMs: 15_000 })
    } catch {
      // gh not found under this name: try the next one
    }
  }
  return null
}

/** The latest GitHub Actions run of the repository, with the step count while it runs. */
const fetchRun = async ($: EngineInterface): Promise<void> => {
  let next: Run | null = null
  const l = await ghRun($, ['run', 'list', '--limit', '1', '--json', 'databaseId,name,status,conclusion,headBranch,updatedAt'])
  if (l && l.exitCode === 0) {
    try {
      const [r] = JSON.parse(l.stdout) as { databaseId: number; name: string; status: string; conclusion: string; headBranch: string; updatedAt: string }[]
      if (r) {
        let done = 0, total = 0
        if (r.status !== 'completed') {
          const v = await ghRun($, ['run', 'view', String(r.databaseId), '--json', 'jobs'])
          if (v && v.exitCode === 0) {
            const jobs = (JSON.parse(v.stdout) as { jobs: { steps?: { status: string }[] }[] }).jobs
            for (const j of jobs) for (const st of j.steps ?? []) { total++; if (st.status === 'completed') done++ }
          }
        }
        next = { name: r.name, branch: r.headBranch, status: r.status, conclusion: r.conclusion, updatedAt: r.updatedAt, done, total }
      }
    } catch {
      // unreadable answer: no segment
    }
  }
  runActive = next !== null && next.status !== 'completed'
  await update($, run, () => next)
}

/** Branch, ahead/behind and the count of changed and untracked files, from `git status --porcelain=v2 --branch`. */
const fetchGit = async ($: EngineInterface): Promise<void> => {
  let next: Git | null = null
  try {
    const r = await $.process.run(['git', 'status', '--porcelain=v2', '--branch'], { timeoutMs: 10_000 })
    if (r.exitCode === 0) {
      let branch = '', ahead = 0, behind = 0, changed = 0, untracked = 0, conflicts = 0, hasUpstream = false
      for (const line of r.stdout.split('\n')) {
        if (line.startsWith('# branch.head ')) branch = line.slice(14).trim()
        else if (line.startsWith('# branch.upstream ')) hasUpstream = true
        else if (line.startsWith('# branch.ab ')) {
          const m = /\+(\d+) -(\d+)/.exec(line)
          if (m) { ahead = Number(m[1]); behind = Number(m[2]) }
        } else if (line.startsWith('u ')) conflicts++
        else if (line.startsWith('1 ') || line.startsWith('2 ')) changed++
        else if (line.startsWith('? ')) untracked++
      }
      // Sans branche distante du même nom (branche de worktree, poussée vers main) : on compare à origin/main.
      let base = ''
      if (!hasUpstream) {
        for (const ref of ['origin/main', 'origin/master']) {
          const c = await $.process.run(['git', 'rev-list', '--left-right', '--count', `${ref}...HEAD`], { timeoutMs: 10_000 })
          const m = c.exitCode === 0 ? /(\d+)\s+(\d+)/.exec(c.stdout) : null
          if (m) { base = ref.slice(7); behind = Number(m[1]); ahead = Number(m[2]); break }
        }
      }
      // Un worktree lié : le dossier .git propre à l'arbre diffère du dossier git commun.
      let isWorktree = false
      const d = await $.process.run(['git', 'rev-parse', '--path-format=absolute', '--git-dir', '--git-common-dir'], { timeoutMs: 10_000 })
      if (d.exitCode === 0) {
        const [a, b] = d.stdout.trim().split('\n')
        isWorktree = a !== undefined && b !== undefined && a !== b
      }
      if (branch) next = { branch: branch === '(detached)' ? 'HEAD détachée' : branch, ahead, behind, changed, untracked, conflicts, hasUpstream, base, isWorktree }
    }
  } catch {
    // git missing or not a repository: no segment
  }
  await update($, git, () => next)
}

type Check = { status?: string; conclusion?: string; state?: string }

/** Folds gh's statusCheckRollup (check runs and commit statuses) into one verdict. */
const foldChecks = (list: readonly Check[]): Pick<Pr, 'checks' | 'passed' | 'total'> => {
  let passed = 0, pending = 0, failed = 0
  for (const c of list) {
    const v = (c.conclusion || c.state || '').toUpperCase()
    const running = c.status !== undefined && c.status !== '' && c.status.toUpperCase() !== 'COMPLETED'
    if (running || v === 'PENDING' || v === 'EXPECTED' || v === '') pending++
    else if (v === 'SUCCESS' || v === 'NEUTRAL' || v === 'SKIPPED') passed++
    else failed++
  }
  const total = list.length
  return { passed, total, checks: total === 0 ? 'none' : failed > 0 ? 'fail' : pending > 0 ? 'pending' : 'ok' }
}

const GH_FIELDS = 'number,state,isDraft,reviewDecision,statusCheckRollup'

/** The PR of the session's branch, or null when there is none, gh is missing or the call fails. */
const fetchPr = async ($: EngineInterface): Promise<void> => {
  let next: Pr | null = null
  for (const bin of ['gh', '/opt/homebrew/bin/gh', '/usr/local/bin/gh']) {
    try {
      const r = await $.process.run([bin, 'pr', 'view', '--json', GH_FIELDS], { timeoutMs: 15_000 })
      if (r.exitCode === 0) {
        const j = JSON.parse(r.stdout) as {
          number: number; state: string; isDraft: boolean; reviewDecision?: string; statusCheckRollup?: Check[]
        }
        next = { number: j.number, state: j.state, isDraft: j.isDraft, review: j.reviewDecision ?? '', ...foldChecks(j.statusCheckRollup ?? []) }
      }
      break // gh ran: an exit code other than 0 means "no PR here", not "no gh"
    } catch {
      // gh not found under this name: try the next one
    }
  }
  await update($, pr, () => next)
}

const clean = (l: readonly Window[]): Window[] =>
  l.map(w => ({ kind: w.kind, percentUsed: w.percentUsed, resetsAt: w.resetsAt }))

const dots = (pct: number) => {
  const n = Math.max(0, Math.min(CELLS, Math.round((pct / 100) * CELLS)))
  return { on: '●'.repeat(n), off: '·'.repeat(CELLS - n) }
}

const dur = (ms: number): string => {
  if (ms <= 0) return '0m'
  const m = Math.round(ms / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h${String(m % 60).padStart(2, '0')}` : `${Math.floor(h / 24)}j ${h % 24}h`
}

const resetIn = (iso: string | undefined, now: number): string => {
  if (!iso) return ''
  const ms = Date.parse(iso) - now
  return Number.isNaN(ms) ? '' : ms <= 0 ? 'reset…' : `reset ${dur(ms)}`
}

const pull = async ($: EngineInterface): Promise<void> => {
  const u = await $.session.usage()
  await update($, windows, () => clean(u.rateLimits))
  if (u.context.tokens && u.context.tokens > 0) {
    await update($, ctx, () => ({ tokens: u.context.tokens as number, window: u.context.window || 0 }))
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await pull($)
    $.clock.every(TICK_MS, () => $.ui.invalidate('ui.render'))
    void fetchPr($)
    void fetchGit($)
    void fetchRun($)
    $.clock.every(PR_TICK_MS, () => { void fetchPr($); void fetchGit($) })
    // Le run Actions se relit toutes les 20 s quand il tourne, sinon une fois par minute.
    $.clock.every(RUN_FAST_MS, () => {
      runTick++
      if (runActive || runTick % 3 === 0) void fetchRun($)
    })
    return next(e)
  })

  // Après chaque commande Bash l'état git peut avoir changé ; un push ou gh pr change aussi la PR.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const r = await next(e)
    void fetchGit($)
    if (/\bgit\s+push\b|\bgh\s+pr\b|\bgh\s+run\b/.test(e.command)) {
      if (/\bgit\s+push\b/.test(e.command)) await update($, pushAt, () => Date.now())
      void fetchPr($)
      void fetchRun($)
      runActive = true // un push lance un run : relecture rapide jusqu'à ce qu'il apparaisse et finisse
    }
    return r
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) await update($, windows, () => clean(e.rateLimits))
    if (e.changed.includes('context') && e.context.tokens && e.context.tokens > 0) {
      const tokens = e.context.tokens
      await update($, ctx, c => ({ tokens, window: e.context.window || c?.window || 0 }))
    }
    return next(e)
  })

  // Un sous-agent démarre : le segment AGENTS se redessine tout de suite (il se met aussi à jour à chaque tour).
  on('agent.spawn', async ($, e, next) => {
    const r = await next(e)
    void $.ui.invalidate('ui.render')
    return r
  }).catch(($, e, next) => next(e)) // la bande ne bloque jamais le démarrage d'un sous-agent

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (!e.agentId) {
      await pull($)
      void fetchGit($)
    } else {
      void $.ui.invalidate('ui.render') // un sous-agent a fini
    }
    return r
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const now = await $.clock.now()
    const list = await read($, windows)
    const c = await read($, ctx)
    const g = await read($, git)
    const pushed = await read($, pushAt)
    const running = (await $.agent.list()).filter(a => a.status === 'running' || a.status === 'pending')

    const gauge = (name: string, color: string, used: number, extra: string, k: string) => {
      const left = Math.max(0, Math.round((100 - used) * 10) / 10)
      const d = dots(used)
      return (
        <Box key={k} flexDirection="row" flexShrink={0} marginRight={3}>
          <Text color={MUTED} bold>{name} </Text>
          <Text color={color}>{d.on}</Text>
          <Text color={EMPTY}>{d.off}</Text>
          <Text color={color} bold> {extra}</Text>
          {left < 15 ? <Text color={RED} bold> LOW</Text> : null}
        </Box>
      )
    }

    const items = []
    if (c && c.window > 0) {
      const used = Math.min(100, (c.tokens / c.window) * 100)
      const k = Math.round(c.tokens / 1000)
      items.push(gauge('CONTEXTE', VIOLET, used, `${Math.round(used)}% · ${k}k/${Math.round(c.window / 1000)}k`, 'ctx'))
    }
    const five = list.find(w => w.kind === 'five_hour')
    const seven = list.find(w => w.kind === 'seven_day')
    if (five) items.push(gauge('SESSION 5H', AMBER, five.percentUsed, `${Math.round(five.percentUsed)}% · ${resetIn(five.resetsAt, now)}`, '5h'))
    if (seven) items.push(gauge('SEMAINE', GREEN, seven.percentUsed, `${Math.round(seven.percentUsed)}% · ${resetIn(seven.resetsAt, now)}`, '7d'))

    if (g) {
      const dirty = g.changed + g.untracked
      items.push(
        <Box key="git" flexDirection="row" flexShrink={0} marginRight={3}>
          <Text color={MUTED} bold>GIT </Text>
          <Text color={VIOLET} bold>{g.branch}</Text>
          {g.conflicts > 0 ? <Text color={RED} bold> ⚠{g.conflicts} conflit{g.conflicts > 1 ? 's' : ''}</Text> : null}
          {dirty > 0 ? <Text color={AMBER}> ●{g.changed}{g.untracked > 0 ? ` ?${g.untracked}` : ''}</Text> : <Text color={GREEN}> ✓ propre</Text>}
          {g.ahead > 0 ? <Text color={GREEN} bold> ↑{g.ahead}</Text> : null}
          {g.behind > 0 ? <Text color={RED} bold> ↓{g.behind}</Text> : null}
          {g.base && g.ahead === 0 && g.behind === 0 ? <Text color={GREEN}> = {g.base}</Text> : null}
          {g.base && (g.ahead > 0 || g.behind > 0) ? <Text color={MUTED}> vs {g.base}</Text> : null}
          {!g.hasUpstream && !g.base ? <Text color={MUTED}> (non publiée)</Text> : null}
        </Box>,
      )
    }

    // Worktree supprimable : poussé pendant cette session, propre, rien hors de main, et le run Actions lancé depuis a réussi.
    {
      const rn2 = await read($, run)
      const validated = rn2 !== null && rn2.status === 'completed' && rn2.conclusion === 'success' && Date.parse(rn2.updatedAt) >= pushed
      if (g && g.isWorktree && g.base && pushed > 0 && g.changed + g.untracked + g.conflicts === 0 && g.ahead === 0 && validated) {
        items.push(
          <Box key="rm" flexDirection="row" flexShrink={0} marginRight={3}>
            <Text color={GREEN} bold>✓ WORKTREE SUPPRIMABLE </Text>
            <Text color={MUTED}>poussé dans {g.base}, CI réussie</Text>
          </Box>,
        )
      }
    }
    const rn = await read($, run)
    if (rn && (rn.status !== 'completed' || now - Date.parse(rn.updatedAt) < RUN_SHOWN_MS)) {
      const ok = rn.conclusion === 'success'
      const bad = rn.status === 'completed' && !ok && rn.conclusion !== 'skipped' && rn.conclusion !== 'cancelled'
      const state =
        rn.status !== 'completed' ? { t: rn.total > 0 ? `en cours ${rn.done}/${rn.total}` : rn.status === 'queued' ? 'en file' : 'en cours', c: AMBER }
        : ok ? { t: 'réussi', c: GREEN }
        : bad ? { t: 'échec', c: RED }
        : { t: rn.conclusion === 'cancelled' ? 'annulé' : 'ignoré', c: MUTED }
      items.push(
        <Box key="run" flexDirection="row" flexShrink={0} marginRight={3}>
          <Text color={MUTED} bold>ACTIONS </Text>
          <Text color={VIOLET} bold>{rn.name}</Text>
          <Text color={MUTED}> · {rn.branch}</Text>
          <Text color={state.c} bold> · {state.t}</Text>
        </Box>,
      )
    }

    const p = await read($, pr)
    if (p) {
      const merged = p.state === 'MERGED'
      const closed = p.state === 'CLOSED'
      const ci =
        p.checks === 'ok' ? { t: `CI ✓ ${p.passed}/${p.total}`, c: GREEN }
        : p.checks === 'fail' ? { t: `CI ✗ ${p.passed}/${p.total}`, c: RED }
        : p.checks === 'pending' ? { t: `CI … ${p.passed}/${p.total}`, c: AMBER }
        : { t: 'CI —', c: MUTED }
      const rev =
        p.review === 'APPROVED' ? { t: 'approuvée', c: GREEN }
        : p.review === 'CHANGES_REQUESTED' ? { t: 'changements demandés', c: RED }
        : p.review === 'REVIEW_REQUIRED' ? { t: 'review en attente', c: AMBER }
        : null
      items.push(
        <Box key="pr" flexDirection="row" flexShrink={0} marginRight={3}>
          <Text color={MUTED} bold>PR </Text>
          <Text color={VIOLET} bold>#{p.number}</Text>
          {merged ? <Text color={VIOLET} bold> · fusionnée</Text>
            : closed ? <Text color={RED} bold> · fermée</Text>
            : <Text color={ci.c} bold> · {ci.t}</Text>}
          {!merged && !closed && p.isDraft ? <Text color={MUTED}> · brouillon</Text> : null}
          {!merged && !closed && rev ? <Text color={rev.c}> · {rev.t}</Text> : null}
        </Box>,
      )
    }

    if (running.length > 0) {
      const names = running.slice(0, 2).map(a => a.description || a.type).join(', ')
      items.push(
        <Box key="agents" flexDirection="row" flexShrink={0} marginRight={3}>
          <Text color={MUTED} bold>AGENTS </Text>
          <Text color={AMBER} bold>{running.length} en cours</Text>
          <Text color={MUTED}> · {names}{running.length > 2 ? '…' : ''}</Text>
        </Box>,
      )
    }
    if (items.length === 0) {
      return <Box backgroundColor={BG} paddingX={1}><Text color={MUTED}>en attente de la première réponse</Text></Box>
    }
    return <Box flexDirection="row" flexWrap="wrap" backgroundColor={BG} paddingX={1}>{items}</Box>
  })
}
