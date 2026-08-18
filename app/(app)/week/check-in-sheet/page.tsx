import type { Metadata } from 'next'
import { getCheckInSheetData } from '@/lib/checkin-sheet'
import { CheckInSheet } from '@/components/checkin-sheet/check-in-sheet'
import { MembershipEditor } from './membership-editor'
import { SheetActions } from './sheet-actions'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Check-In Sheet - Silicon Desert Golf League'
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
      <MembershipEditor venue={data.venue} rows={data.rows} />
      <div className="mt-4 overflow-x-auto px-4 pb-8 xl:px-6">
        <CheckInSheet data={data} />
      </div>
    </>
  )
}
