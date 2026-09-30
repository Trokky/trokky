/**
 * Sign-ins in progress, polled in the background from the moment add_site has a device code.
 *
 * The agent never has to ask the user "have you approved?": the approval is picked up as it
 * happens and the site saved, and finish_add_site only waits for the outcome. Each sign-in is
 * also written to a private file next to the site list (the device code, never a token; then
 * the outcome), so finish_add_site still works after the MCP server restarts, or from another
 * MCP process sharing the same site list.
 */

import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pollUntilDone, type LoginOutcome, type PendingLogin, type PollOptions } from './device.js'
import { acquireFileLock, type FetchLike, type SiteStore } from './sites.js'

export type SignInResult =
  | { status: 'added'; name: string; url: string; granted: string[]; lastingSession: boolean }
  | { status: 'denied'; name: string }
  | { status: 'expired'; name: string }
  | { status: 'failed'; name: string; reason: string }

export type WaitResult = SignInResult | { status: 'waiting'; name: string; secondsLeft: number; login?: PendingLogin }

export type SignInLogin = PendingLogin & {
  replace: boolean
  /** When add_site started it; a site saved after this came from this sign-in */
  startedAt: number
}

interface StoredSignIn {
  login: SignInLogin
  result?: SignInResult
}

interface Running {
  login: SignInLogin
  controller: AbortController
  done: Promise<SignInResult | null>
}

/** How long a poll told "code already used" looks for the other poll's outcome */
const FINISHED_ELSEWHERE_WAIT_MS = 10_000

/** A finished or abandoned sign-in is forgotten this long after its code expired */
const KEEP_AFTER_EXPIRY_MS = 60 * 60_000

export class SignIns {
  private readonly running = new Map<string, Running>()
  private writes: Promise<void> = Promise.resolve()

  constructor(
    private readonly store: SiteStore,
    private readonly fetchImpl: FetchLike,
    readonly filePath: string,
    private readonly pollOptions: Pick<PollOptions, 'sleep'> = {}
  ) {}

  /**
   * Start polling for a sign-in add_site just began. One already running under that name stops
   * polling first; as this happens before anything is awaited, two add_site calls can never leave
   * two pollers. A fresh sign-in to the same site replaces what the previous one may still save.
   */
  async start(name: string, login: SignInLogin): Promise<void> {
    const previous = this.running.get(name)
    if (previous) {
      previous.controller.abort()
      if (previous.login.apiUrl === login.apiUrl) login.replace = true
    }
    this.run(name, login)
    await this.persist(name, { login })
  }

  /**
   * Wait until `ms` from now for the sign-in's outcome; the whole call, file access included,
   * fits in that. Resumes polling from the saved device code when this process is not polling
   * it (after a restart). Null when there is no such sign-in.
   */
  async wait(name: string, ms: number): Promise<WaitResult | null> {
    const deadline = Date.now() + ms
    let entry = this.running.get(name)
    if (!entry) {
      const loaded = await beforeDeadline(this.load(), deadline)
      if (loaded === TIMEOUT) return { status: 'waiting', name, secondsLeft: 0 }
      // A concurrent call may have resumed it while this one read the file
      entry = this.running.get(name)
      if (!entry) {
        const saved = loaded[name]
        if (!saved) return null
        if (saved.result) {
          void this.forget(name, saved.login.deviceCode)
          return saved.result
        }
        entry = this.run(name, saved.login)
      }
    }
    const outcome = await beforeDeadline(entry.done, deadline)
    if (outcome === TIMEOUT || outcome === null) {
      return { status: 'waiting', name, secondsLeft: Math.max(0, Math.round((entry.login.expiresAt - Date.now()) / 1000)), login: entry.login }
    }
    // Reported: nothing left to remember. Forgetting does not hold up the answer.
    if (this.running.get(name) === entry) this.running.delete(name)
    void this.forget(name, entry.login.deviceCode)
    return outcome
  }

  /** Stop every poll (the server is closing); saved sign-ins resume in the next process */
  close(): void {
    for (const entry of this.running.values()) entry.controller.abort()
    this.running.clear()
  }

  private run(name: string, login: SignInLogin): Running {
    const controller = new AbortController()
    const done = (async (): Promise<SignInResult | null> => {
      const outcome = await pollUntilDone(login, this.fetchImpl, {
        ...this.pollOptions,
        signal: controller.signal,
        // Remembered, so a restart does not poll faster than the site asked
        onSlowDown: () => { void this.persist(name, { login }, login.deviceCode).catch(() => undefined) }
      })
      if (!outcome) return null
      // Once the site has answered, the answer counts even if this poll was stopped meanwhile:
      // an approval is consumed on the site's side and would otherwise be lost
      const result = await this.settle(name, login, outcome)
      await this.persist(name, { login, result }, login.deviceCode).catch(() => undefined)
      return result
    })().catch((error: unknown): SignInResult => ({
      status: 'failed',
      name,
      reason: error instanceof Error ? error.message : String(error)
    }))
    const entry = { login, controller, done }
    this.running.set(name, entry)
    return entry
  }

  /** Save the site as soon as it is approved, the way finish_add_site always has */
  private async settle(name: string, login: SignInLogin, outcome: LoginOutcome): Promise<SignInResult> {
    if (outcome.status === 'failed') {
      if (outcome.outcome === 'denied') return { status: 'denied', name }
      // The code may have been redeemed by another poll of this same sign-in (another MCP
      // process, or this one before a restart): the site then says the code is used or unknown
      // A code past its own expiry just expired; one rejected earlier was likely used elsewhere
      const finished = await this.finishedElsewhere(name, login, outcome.outcome === 'error' || Date.now() < login.expiresAt)
      if (finished) return finished
      return outcome.outcome === 'expired' ? { status: 'expired', name } : { status: 'failed', name, reason: outcome.reason }
    }
    await this.store.add(name, {
      url: login.apiUrl,
      token: outcome.token,
      refreshToken: outcome.refreshToken,
      authType: 'oauth2',
      tokenExpiresAt: outcome.expiresIn ? new Date(Date.now() + outcome.expiresIn * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z') : undefined,
      clientId: outcome.clientId,
      description: 'Added by the Trokky MCP server'
    }, false, login.replace)
    return {
      status: 'added',
      name,
      url: login.apiUrl,
      granted: outcome.scope?.split(' ').filter(Boolean) ?? [],
      lastingSession: Boolean(outcome.refreshToken)
    }
  }

  /**
   * The outcome another poll of this sign-in recorded, or the site it saved since the sign-in
   * began. The other poll may still be saving when this one is told the code is used, so this
   * looks for a few seconds; it runs in the background poll, never inside a tool call's wait.
   */
  private async finishedElsewhere(name: string, login: SignInLogin, patient: boolean): Promise<SignInResult | undefined> {
    const giveUpAt = Date.now() + (patient ? FINISHED_ELSEWHERE_WAIT_MS : 0)
    for (;;) {
      const saved = (await this.load())[name]
      if (saved?.login.deviceCode === login.deviceCode && saved.result?.status === 'added') return saved.result
      const site = await this.store.get(name)
      if (site?.url === login.apiUrl && site.clientId === login.clientId && Date.parse(site.updatedAt ?? '') >= login.startedAt) {
        return { status: 'added', name, url: login.apiUrl, granted: [], lastingSession: Boolean(site.refreshToken) }
      }
      if (Date.now() >= giveUpAt) return undefined
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  private forget(name: string, deviceCode: string): Promise<void> {
    return this.persist(name, undefined, deviceCode).catch(() => undefined)
  }

  private async load(): Promise<Record<string, StoredSignIn>> {
    const text = await readFile(this.filePath, 'utf8').catch(() => '')
    try {
      const parsed = JSON.parse(text || '{}') as unknown
      return parsed && typeof parsed === 'object' ? parsed as Record<string, StoredSignIn> : {}
    } catch {
      return {}
    }
  }

  /**
   * Write one sign-in (or forget it), under the lock other MCP processes take too, privately and
   * atomically, dropping long-expired ones. With `deviceCode`, only the sign-in with that code is
   * touched: a newer sign-in under the same name is never overwritten or forgotten by an older one.
   */
  private persist(name: string, value: StoredSignIn | undefined, deviceCode?: string): Promise<void> {
    const write = this.writes.then(async () => {
      const release = await acquireFileLock(`${this.filePath}.lock`, 'The Trokky sign-ins file')
      try {
        const all = await this.load()
        const current = all[name]
        if (deviceCode !== undefined && current && current.login?.deviceCode !== deviceCode) return
        if (value) all[name] = value
        else if (deviceCode === undefined || current) delete all[name]
        for (const [key, entry] of Object.entries(all)) {
          if (!(entry?.login?.expiresAt + KEEP_AFTER_EXPIRY_MS > Date.now())) delete all[key]
        }
        if (Object.keys(all).length === 0) {
          await rm(this.filePath, { force: true })
          return
        }
        await mkdir(path.dirname(this.filePath), { recursive: true, mode: 0o700 })
        const aside = `${this.filePath}.${randomUUID()}.tmp`
        try {
          await writeFile(aside, JSON.stringify(all, null, 2), { mode: 0o600 })
          await rename(aside, this.filePath)
        } catch (error) {
          await rm(aside, { force: true })
          throw error
        }
      } finally {
        await release()
      }
    })
    this.writes = write.catch(() => undefined)
    return write
  }
}

const TIMEOUT = Symbol('timeout')

/** `work`, or TIMEOUT once `deadline` passes, whichever comes first */
async function beforeDeadline<T>(work: Promise<T>, deadline: number): Promise<T | typeof TIMEOUT> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<typeof TIMEOUT>(resolve => { timer = setTimeout(() => resolve(TIMEOUT), Math.max(0, deadline - Date.now())) })
  try {
    return await Promise.race([work, timeout])
  } finally {
    clearTimeout(timer)
  }
}

/** The sign-ins file for a site list: beside it, so both follow TROKKY_CONFIG */
export function signInsPath(configPath: string): string {
  return path.join(path.dirname(configPath), 'mcp-sign-ins.json')
}
