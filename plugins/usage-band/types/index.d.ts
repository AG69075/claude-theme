export type Window = { kind: string; percentUsed: number; resetsAt?: string }
export type Ctx = { tokens: number; window: number }
export type Sub = { type: string; model: string; at: number }

declare module 'claude-code' {
  interface PluginState {
    'usage-band': { windows: Window[]; ctx: Ctx | null; lastAt: number; subs: Sub[] }
  }
}
