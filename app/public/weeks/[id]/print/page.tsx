import { notFound } from 'next/navigation'
import { getPublicWeekData } from '@/lib/public-week'
import { getPublicStandingsData } from '@/lib/public-standings'
import { PrintButton } from './print-button'

export const revalidate = 60

export default async function PrintWeekPage({
  params
}: {
  params: { id: string }
}) {
  const data = await getPublicWeekData(params.id)

  if (!data || !data.resultsVisible) {
    notFound()
  }

  const standingsData = await getPublicStandingsData(data.seasonId)

  return (
    <div className="print-page space-y-6">
      <PrintButton />

      {/* Header */}
      <div className="border-b border-surface-border pb-4 print:border-black">
        <p className="font-condensed text-xs font-bold uppercase tracking-widest text-accent-text print:text-black">
          Silicon Desert Golf League
        </p>
        <h1 className="font-condensed mt-1 text-2xl font-bold uppercase tracking-wide">
          Week {data.weekNumber} &mdash; {data.seasonName}
        </h1>
        <p className="mt-1 text-sm text-text-secondary print:text-black">
          {data.courseName} &middot; {data.dateLabel}
        </p>
      </div>

      {/* Side Games */}
      {data.ctpWinnerName || data.longestPuttWinnerName ? (
        <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
          {data.ctpWinnerName ? (
            <p>
              <span className="font-semibold">Closest to Pin:</span>{' '}
              {data.ctpWinnerName}
              {data.ctpHoleNumber ? ` (Hole ${data.ctpHoleNumber})` : ''}
            </p>
          ) : null}
          {data.longestPuttWinnerName ? (
            <p>
              <span className="font-semibold">Longest Putt:</span>{' '}
              {data.longestPuttWinnerName}
              {data.longestPuttHoleNumber ? ` (Hole ${data.longestPuttHoleNumber})` : ''}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Match Results Table */}
      <section>
        <h2 className="font-condensed mb-2 text-sm font-bold uppercase tracking-widest text-text-muted print:text-black">
          Match Results
        </h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-surface-border text-left font-condensed text-xs font-bold uppercase tracking-widest text-text-muted print:border-black print:text-black">
              <th className="py-2 pr-3">#</th>
              <th className="py-2 pr-3">Player 1</th>
              <th className="py-2 pr-3 text-right">Hdcp</th>
              <th className="py-2 pr-3 text-right">Gross</th>
              <th className="py-2 pr-3 text-right">Net</th>
              <th className="py-2 pr-3 text-right">Pts</th>
              <th className="py-2 pr-3">Player 2</th>
              <th className="py-2 pr-3 text-right">Hdcp</th>
              <th className="py-2 pr-3 text-right">Gross</th>
              <th className="py-2 pr-3 text-right">Net</th>
              <th className="py-2 pr-3 text-right">Pts</th>
              <th className="py-2 pr-3">Stroke</th>
              <th className="py-2">Match Play</th>
            </tr>
          </thead>
          <tbody>
            {data.matches.map((match, i) => (
              <tr
                key={match.id}
                className="border-b border-surface-border print:border-gray-300"
              >
                <td className="py-2 pr-3 tabular-nums text-text-secondary">{i + 1}</td>
                <td className="py-2 pr-3 font-medium">{match.player1Name}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-text-secondary">
                  {match.player1CourseHandicap ?? '—'}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-text-secondary">
                  {match.player1Gross ?? '—'}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-text-secondary">
                  {match.player1Net ?? '—'}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums font-semibold">
                  {match.player1Points}
                </td>
                <td className="py-2 pr-3 font-medium">{match.player2Name}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-text-secondary">
                  {match.player2CourseHandicap ?? '—'}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-text-secondary">
                  {match.player2Gross ?? '—'}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-text-secondary">
                  {match.player2Net ?? '—'}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums font-semibold">
                  {match.player2Points}
                </td>
                <td className="py-2 pr-3 text-text-secondary">{match.strokeSummary}</td>
                <td className="py-2 text-text-secondary">{match.matchPlaySummary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Standings */}
      {standingsData.standings.length > 0 ? (
        <section>
          <h2 className="font-condensed mb-2 text-sm font-bold uppercase tracking-widest text-text-muted print:text-black">
            {standingsData.selectedLabel ?? 'Season'} Standings
          </h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-surface-border text-left font-condensed text-xs font-bold uppercase tracking-widest text-text-muted print:border-black print:text-black">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Player</th>
                <th className="py-2 pr-3 text-right">Pts</th>
                <th className="py-2 pr-3 text-right">Stroke</th>
                <th className="py-2 pr-3 text-right">Match</th>
                <th className="py-2 pr-3 text-right">CTP</th>
                <th className="py-2 text-right">LP</th>
              </tr>
            </thead>
            <tbody>
              {standingsData.standings.map((row, i) => (
                <tr
                  key={row.playerId}
                  className="border-b border-surface-border print:border-gray-300"
                >
                  <td className="py-2 pr-3 tabular-nums text-text-secondary">{i + 1}</td>
                  <td className="py-2 pr-3 font-medium">{row.name}</td>
                  <td className="py-2 pr-3 text-right tabular-nums font-semibold">
                    {row.totalPoints}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{row.strokeWins}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{row.matchPlayWins}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{row.ctpWins}</td>
                  <td className="py-2 text-right tabular-nums">{row.lpWins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  )
}
