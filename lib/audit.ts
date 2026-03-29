interface AuditEntry {
  weekId?: string | null
  matchId?: string | null
  playerId?: string | null
  action: string
  field?: string | null
  oldValue?: string | null
  newValue?: string | null
}

interface AuditWriter {
  auditLog: {
    create: (args: {
      data: {
        weekId?: string | null
        matchId?: string | null
        playerId?: string | null
        action: string
        field?: string | null
        oldValue?: string | null
        newValue?: string | null
      }
    }) => Promise<unknown>
  }
}

export async function writeAuditLog(tx: AuditWriter, entry: AuditEntry) {
  await tx.auditLog.create({
    data: {
      weekId: entry.weekId ?? null,
      matchId: entry.matchId ?? null,
      playerId: entry.playerId ?? null,
      action: entry.action,
      field: entry.field ?? null,
      oldValue: entry.oldValue ?? null,
      newValue: entry.newValue ?? null
    }
  })
}
