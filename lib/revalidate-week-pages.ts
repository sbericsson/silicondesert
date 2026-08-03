import { revalidatePath } from 'next/cache'

export function revalidateWeekPages(_weekId: string) {
  revalidatePath('/history')
  revalidatePath('/public/week')
  revalidatePath('/public/standings')
  revalidatePath('/public/schedule')
  revalidatePath('/public/weeks/[id]', 'page')
  revalidatePath('/public/weeks/[id]/print', 'page')
  revalidatePath('/public/weeks/[id]/matches/[matchId]', 'page')
}
