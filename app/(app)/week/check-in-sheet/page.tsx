import type { Metadata } from 'next'
import { getCheckInSheetData } from '@/lib/checkin-sheet'
import { CheckInSheet } from '@/components/checkin-sheet/check-in-sheet'
import { MembershipEditor } from './membership-editor'
import { SheetActions } from './sheet-actions'

export const dynamic = 'force-dynamic'

// The browser names a printed PDF after document.title, so the title is the
// filename the commissioner ends up with: "Check-In Sheet - Summer 2026 Week 8".
export async function generateMetadata({
  searchParams
}: {
  searchParams: { week?: string }
}): Promise<Metadata> {
  const data = await getCheckInSheetData(searchParams.week)
  const parts = [data.seasonName, data.weekNumber ? `Week ${data.weekNumber}` : null].filter(
    Boolean
  )

  return {
    title: parts.length > 0 ? `Check-In Sheet - ${parts.join(' ')}` : 'Check-In Sheet'
  }
}

export default async function CheckInSheetPage({
  searchParams
}: {
  searchParams: { week?: string }
}) {
  const data = await getCheckInSheetData(searchParams.week)

  if (!data.hasWeek) {
    return (
      <div className="px-4 py-6 xl:px-6">
        <p className="text-sm text-text-secondary">
          No current or upcoming week to print a check-in sheet for.
        </p>
      </div>
    )
  }

  return (
    <>
      <SheetActions />
      <MembershipEditor rows={data.rows} />
      <div className="cis-wrap mt-4 overflow-x-auto px-4 pb-8 xl:px-6">
        <CheckInSheet data={data} />
      </div>
    </>
  )
}
