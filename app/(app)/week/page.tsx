import { getCurrentWeekPageData } from '@/lib/week'
import { WeekClient } from '@/app/(app)/week/week-client'

export default async function WeekPage() {
  const data = await getCurrentWeekPageData()

  return <WeekClient initialData={data} />
}
