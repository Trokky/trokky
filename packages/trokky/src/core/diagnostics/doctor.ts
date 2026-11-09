/**
 * `trokky doctor`: the checks behind GET /system/doctor.
 *
 * Each one answers a question that otherwise only shows up in a startup log nobody reads, or
 * at the worst moment: is the signing key real, do the schemas say what their authors meant,
 * will the content survive a redeploy, and can every stored document still be saved under the
 * current rules. The report carries no secrets and no field values, only names, counts and ids.
 */

import type { ValidationResult } from '../types/index.js'
import { MIN_JWT_SECRET_LENGTH, type JwtSecretEnvironment } from '../security/jwt-secret.js'

export type DoctorStatus = 'ok' | 'warn' | 'fail'

export interface DoctorCheck {
  id: 'signing-key' | 'schemas' | 'storage' | 'content'
  title: string
  status: DoctorStatus
  /** One line per finding: names, counts and ids, never values */
  details: string[]
}

export interface DoctorReport {
  environment: JwtSecretEnvironment
  status: DoctorStatus
  /** When the checks ran: a report is reused for up to a minute */
  checkedAt: string
  checks: DoctorCheck[]
}

/** The startup persistence check: what it found, or why it did not run */
export interface StorageCheck {
  checked: boolean
  reason?: string
  warnings: string[]
}

export interface DoctorInput {
  environment: JwtSecretEnvironment
  signingKey: { source: 'configured' | 'generated'; length: number }
  schemaProblems: Record<string, string[]>
  storage: StorageCheck
  collections: string[]
  /** Every stored document of a collection, page by page, in a stable order */
  listDocuments: (collection: string, limit: number, offset: number) => Promise<Array<Record<string, unknown>>>
  /** Stored documents the adapter could not read at all (e.g. a corrupt file), if it can tell */
  listUnreadable?: (collection: string) => Promise<string[]>
  validate: (collection: string, document: Record<string, unknown>) => ValidationResult
}


/** The scan stops here and says so, rather than tie up the database */
export const MAX_SCANNED_DOCUMENTS = 50_000
/** Ids named per collection in a finding; the count covers the rest */
const EXAMPLE_IDS = 5
/** Fields named per collection in a finding */
const EXAMPLE_FIELDS = 10

export async function runDoctor(input: DoctorInput): Promise<DoctorReport> {
  const checks = [
    signingKeyCheck(input),
    schemaCheck(input.schemaProblems),
    storageCheck(input.storage),
    await contentCheck(input),
  ]
  const status: DoctorStatus = checks.some((c) => c.status === 'fail')
    ? 'fail'
    : checks.some((c) => c.status === 'warn')
      ? 'warn'
      : 'ok'
  return { environment: input.environment, status, checkedAt: new Date().toISOString(), checks }
}

function signingKeyCheck({ signingKey }: DoctorInput): DoctorCheck {
  const title = 'Signing key (JWT secret)'
  if (signingKey.source === 'generated') {
    return {
      id: 'signing-key',
      title,
      status: 'warn',
      details: [
        'No JWT secret is set: this process signs with a random key, so every sign-in ends when it restarts ' +
          "and replicas reject each other's tokens. Set TROKKY_JWT_SECRET. (Production refuses to start like this.)",
      ],
    }
  }
  if (signingKey.length < MIN_JWT_SECRET_LENGTH) {
    return {
      id: 'signing-key',
      title,
      status: 'warn',
      details: [`The JWT secret is ${signingKey.length} characters long; use at least ${MIN_JWT_SECRET_LENGTH} random characters.`],
    }
  }
  return { id: 'signing-key', title, status: 'ok', details: [`Set, ${signingKey.length} characters.`] }
}

function schemaCheck(problems: Record<string, string[]>): DoctorCheck {
  const details = Object.entries(problems).flatMap(([schema, list]) => list.map((p) => `${schema}: ${p}`))
  return {
    id: 'schemas',
    title: 'Schemas',
    status: details.length > 0 ? 'warn' : 'ok',
    details: details.length > 0 ? details : ['No unknown keys or field types.'],
  }
}

function storageCheck(storage: StorageCheck): DoctorCheck {
  const title = 'Storage persistence'
  if (!storage.checked) {
    return { id: 'storage', title, status: 'ok', details: [`Not checked: ${storage.reason ?? 'the check did not run'}.`] }
  }
  return {
    id: 'storage',
    title,
    status: storage.warnings.length > 0 ? 'warn' : 'ok',
    details: storage.warnings.length > 0 ? storage.warnings : ['Every filesystem storage directory is on a mounted volume.'],
  }
}

/**
 * Every stored document validated under the current schema rules. A document that fails cannot
 * be edited, published or restored until it is fixed, so these are failures, not warnings. A
 * document with no _status is shown as unpublished, and a singleton in that state reads as null.
 */
async function contentCheck(input: DoctorInput): Promise<DoctorCheck> {
  const details: string[] = []
  let failures = 0
  let warnings = 0
  let scanned = 0
  let truncated = false

  for (const collection of input.collections) {
    if (truncated) break
    const invalidIds: string[] = []
    const fieldCounts = new Map<string, number>()
    const statuslessIds: string[] = []

    try {
      // Ask for everything left in the budget: an adapter that caps its pages (Postgres and D1
      // return at most 1000) is paged until it returns nothing, and one that reads the whole
      // collection on every call (filesystem) is read once instead of once per page
      for (let offset = 0; ; ) {
        const page = await input.listDocuments(collection, MAX_SCANNED_DOCUMENTS - scanned, offset)
        offset += page.length
        for (const document of page) {
          const id = String(document._id ?? document.id ?? '?')
          const result = input.validate(collection, document)
          if (!result.valid) {
            invalidIds.push(id)
            // tags.0, tags.1 ... are one field: count the field, not every item
            for (const field of new Set(result.errors.map((e) => e.field.replace(/\.\d+(?=\.|$)/g, '[]')))) {
              fieldCounts.set(field, (fieldCounts.get(field) ?? 0) + 1)
            }
          }
          if (document._status !== 'draft' && document._status !== 'published') {
            statuslessIds.push(id)
          }
        }
        scanned += page.length
        if (page.length === 0) break
        if (scanned >= MAX_SCANNED_DOCUMENTS) {
          // Out of budget: it was cut short if this collection has more, or collections remain
          const more = (await input.listDocuments(collection, 1, offset)).length > 0
          truncated = more || collection !== input.collections[input.collections.length - 1]
          break
        }
      }
      const unreadable = (await input.listUnreadable?.(collection)) ?? []
      if (unreadable.length > 0) {
        failures += unreadable.length
        details.push(
          `${collection}: ${unreadable.length} stored document(s) cannot be read at all and are left out of every ` +
            `listing. Files: ${examples(unreadable)}`
        )
      }
    } catch {
      warnings++
      details.push(`${collection}: could not be listed, so it was not checked.`)
    }

    if (invalidIds.length > 0) {
      failures += invalidIds.length
      const fields = examples(
        [...fieldCounts].map(([field, count]) => `${field} (${count})`),
        EXAMPLE_FIELDS
      )
      details.push(
        `${collection}: ${invalidIds.length} document(s) fail validation, by field: ${fields}. ` +
          `They cannot be saved until fixed. Ids: ${examples(invalidIds)}`
      )
    }
    if (statuslessIds.length > 0) {
      warnings++
      details.push(
        `${collection}: ${statuslessIds.length} document(s) have no draft/published status and read as unpublished. ` +
          `Ids: ${examples(statuslessIds)}`
      )
    }
  }

  if (truncated) {
    warnings++
    details.push(`The scan stopped after ${MAX_SCANNED_DOCUMENTS} documents; the rest were not checked.`)
  }

  return {
    id: 'content',
    title: 'Stored content',
    status: failures > 0 ? 'fail' : warnings > 0 ? 'warn' : 'ok',
    details: details.length > 0 ? details : [`Every document in ${input.collections.length} collection(s) is valid.`],
  }
}

function examples(items: string[], max = EXAMPLE_IDS): string {
  const shown = items.slice(0, max).join(', ')
  return items.length > max ? `${shown} and ${items.length - max} more` : shown
}
