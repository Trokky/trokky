/**
 * A change made by an application for a person reads "by <person> via <application>", so an
 * AI agent's edits can be told from the person's own.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AuditLogEntry } from '../components/document/AuditLogEntry'

vi.mock('@trokky/trokky/i18n', () => ({
  useT: () => ({ t: (key: string, options?: { name?: string }) => (key === 'auditEntry.via' ? `via ${options?.name}` : key) }),
}))

const base = {
  id: 'a1',
  documentId: 'd1',
  collection: 'posts',
  operation: 'update' as const,
  actorId: 'user-1',
  actorType: 'user' as const,
  actorUsername: 'editor',
  timestamp: new Date().toISOString(),
  revision: 2,
}

describe('AuditLogEntry', () => {
  it('names the application that made the change for the person', () => {
    render(<AuditLogEntry auditLog={{ ...base, metadata: { via: { clientId: 'trokky-mcp', clientName: 'Trokky MCP (AI agent)' } } }} isExpanded={false} onToggleExpansion={() => {}} />)
    expect(screen.getByText('editor')).toBeTruthy()
    expect(screen.getByTestId('audit-via').textContent).toContain('via Trokky MCP (AI agent)')
  })

  it('says nothing more for a change the person made themselves', () => {
    render(<AuditLogEntry auditLog={base} isExpanded={false} onToggleExpansion={() => {}} />)
    expect(screen.queryByTestId('audit-via')).toBeNull()
  })
})
