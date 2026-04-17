import { revalidatePath } from 'next/cache'

export function revalidateWeekPages(weekId: string) {
  revalidatePath('/history')
  revalidatePath('/public/week')
  revalidatePath('/public/standings')
  revalidatePath('/public/schedule')
  revalidatePath(`/public/weeks/${weekId}`)
  revalidatePath(`/public/weeks/${weekId}/print`)
}
