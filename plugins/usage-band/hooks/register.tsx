import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'
import type { Ctx, Sub, Window } from '../types'

// Bande lecture seule : lit les chiffres du moteur et dessine. Aucun réseau, aucun fichier, aucun processus.
const TICK_MS = 30_000
const TTL_MS = 60 * 60 * 1000 // cache de prompt : 1 h après la dernière requête
const CELLS = 10
const SUB_TTL_MS = 15 * 60 * 1000 // un sous-agent reste affiché 15 min
const short = (m: string): string => m.replace(/^claude-/, '')
// Palette aurora-noir : surface #090c15, vert #3affc0, violet #9f7bff, ambre #ffc46b.
const BG = '#090c15', MUTED = '#8996b0', EMPTY = '#1c2336'
const VIOLET = '#9f7bff', AMBER = '#ffc46b', GREEN = '#3affc0', MINT = '#5dffb5', ICE = '#6da7ec', RED = '#ff6b81'

const windows = atom({ plugin: 'usage-band', key: 'windows' } as const, [] as Window[])
const ctx = atom({ plugin: 'usage-band', key: 'ctx' } as const, null as Ctx | null)
const subs = atom({ plugin: 'usage-band', key: 'subs' } as const, [] as Sub[])
const lastAt = atom({ plugin: 'usage-band', key: 'lastAt' } as const, 0)

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
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) await update($, windows, () => clean(e.rateLimits))
    if (e.changed.includes('context') && e.context.tokens && e.context.tokens > 0) {
      const tokens = e.context.tokens
      await update($, ctx, c => ({ tokens, window: e.context.window || c?.window || 0 }))
    }
    return next(e)
  })

  // Modèle réellement utilisé par chaque sous-agent (Explore, checker, ...) au moment où il démarre.
  on('agent.spawn', async ($, e, next) => {
    const r = await next(e)
    const at = await $.clock.now()
    const entry: Sub = { type: e.subagentType ?? 'agent', model: r.model ?? e.model ?? '?', at }
    await update($, subs, l => [...l.filter(x => at - x.at < SUB_TTL_MS).slice(-2), entry])
    return r
  }).catch(($, e, next) => next(e)) // la bande ne bloque jamais le démarrage d'un sous-agent

  // Chaque requête du fil principal relit/écrit le cache : son début relance l'heure.
  on('turn.step', async function* ($, e, next) {
    if (!e.agentId) {
      const now = await $.clock.now()
      await update($, lastAt, () => now)
    }
    yield* next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (!e.agentId) await pull($)
    return r
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const now = await $.clock.now()
    const list = await read($, windows)
    const c = await read($, ctx)
    const at = await read($, lastAt)
    const model = await $.session.model()
    const recent = (await read($, subs)).filter(x => now - x.at < SUB_TTL_MS)

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
    if (at > 0) {
      const left = TTL_MS - (now - at)
      items.push(
        <Box key="cache" flexDirection="row" flexShrink={0} marginRight={3}>
          <Text color={MUTED} bold>CACHE </Text>
          {left > 0
            ? <Text color={MINT} bold>chaud · froid dans {dur(left)}</Text>
            : <Text color={ICE} bold>froid</Text>}
        </Box>,
      )
    }
    const five = list.find(w => w.kind === 'five_hour')
    const seven = list.find(w => w.kind === 'seven_day')
    if (five) items.push(gauge('SESSION 5H', AMBER, five.percentUsed, `${Math.round(five.percentUsed)}% · ${resetIn(five.resetsAt, now)}`, '5h'))
    if (seven) items.push(gauge('SEMAINE', GREEN, seven.percentUsed, `${Math.round(seven.percentUsed)}% · ${resetIn(seven.resetsAt, now)}`, '7d'))

    if (model) {
      items.push(
        <Box key="model" flexDirection="row" flexShrink={0} marginRight={3}>
          <Text color={MUTED} bold>MODÈLE </Text>
          <Text color={VIOLET} bold>{short(model)}</Text>
          {recent.map((x, i) => (
            <Text key={`s${i}`} color={MUTED}> · {x.type} <Text color={ICE} bold>{short(x.model)}</Text></Text>
          ))}
        </Box>,
      )
    }
    if (items.length === 0) {
      return <Box backgroundColor={BG} paddingX={1}><Text color={MUTED}>en attente de la première réponse</Text></Box>
    }
    return <Box flexDirection="row" flexWrap="wrap" backgroundColor={BG} paddingX={1}>{items}</Box>
  })
}
