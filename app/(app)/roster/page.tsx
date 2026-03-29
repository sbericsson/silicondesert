import { getRosterPageData } from '@/lib/roster'
import { RosterClient } from '@/app/(app)/roster/roster-client'

export default async function RosterPage() {
  const data = await getRosterPageData()

  return <RosterClient initialData={data} />
}
