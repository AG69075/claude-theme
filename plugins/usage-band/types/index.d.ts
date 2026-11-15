export type Window = { kind: string; percentUsed: number; resetsAt?: string }
export type Ctx = { tokens: number; window: number }
/** The pull request of the session's branch, as `gh pr view` reports it. */
export type Pr = {
  number: number
  state: string
  isDraft: boolean
  review: string
  checks: 'none' | 'pending' | 'ok' | 'fail'
  passed: number
  total: number
}

/** The git state of the session's working directory. */
export type Git = {
  branch: string
  ahead: number
  behind: number
  changed: number
  untracked: number
  conflicts: number
  hasUpstream: boolean
  /** With no upstream: the branch the counts compare to (`main`), else empty. */
  base: string
  /** True in a linked worktree (its git dir is not the common one). */
  isWorktree: boolean
}

/** The latest GitHub Actions run of the repository. */
export type Run = {
  name: string
  branch: string
  status: string
  conclusion: string
  updatedAt: string
  /** Steps finished and steps in all, while the run is going. */
  done: number
  total: number
}

declare module 'claude-code' {
  interface PluginState {
    'usage-band': { windows: Window[]; ctx: Ctx | null; pr: Pr | null; git: Git | null; run: Run | null; pushAt: number }
  }
}
