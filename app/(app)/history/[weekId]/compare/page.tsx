import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getComparisonStandings, getComparisonValueClass } from '@/lib/public-standings'
import { getPublicWeekData } from '@/lib/public-week'
import { ComparePrintActions } from './compare-print-actions'

export const dynamic = 'force-dynamic'

function formatNumber(value: number | null) {
  return value ?? '\u2014'
}

function getPageTitle(data: { weekNumber: number; seasonName: string; dateLabel: string }) {
  return `Spreadsheet Comparison \u2014 Week ${data.weekNumber} \u2014 ${data.seasonName} \u2014 ${data.dateLabel}`
}

export async function generateMetadata({
  params
}: {
  params: { weekId: string }
}): Promise<Metadata> {
  const data = await getPublicWeekData(params.weekId)

  if (!data) {
    return {
      title: 'Spreadsheet Comparison - Silicon Desert Golf League'
    }
  }

  return {
    title: getPageTitle(data),
    description: `${data.courseName} - ${data.dateLabel}`
  }
}

export default async function SpreadsheetComparisonPage({
  params
}: {
  params: { weekId: string }
}) {
  const data = await getPublicWeekData(params.weekId)

  if (!data || !data.resultsVisible) {
    notFound()
  }

  const standings = await getComparisonStandings(params.weekId)
  const pageTitle = getPageTitle(data)
  const standingsHeading = `${standings.seasonLabel ?? 'Season'} Standings`
  const standingsTableWidth = standings.multiSeason
    ? 'w-[812px] print:w-[7.7in]'
    : 'w-[668px] print:w-[6.4in]'

  return (
    <div className="print-page space-y-6 px-4 py-6 xl:px-6 print:p-0">
      <ComparePrintActions />

      {/* Header */}
      <div className="border-b border-surface-border pb-4 print:border-black">
        <p className="font-condensed text-xs font-bold uppercase tracking-widest text-accent-text print:text-black">
          Silicon Desert Golf League
        </p>
        <h1 className="font-condensed mt-1 text-2xl font-bold uppercase tracking-wide">
          {pageTitle}
        </h1>
        <p className="mt-1 text-sm text-text-secondary print:text-black">
          {data.courseName}
        </p>
        <p className="mt-1 text-xs text-text-secondary print:text-black">
          Commissioner validation &mdash; not for distribution
        </p>
        <p className="mt-1 text-xs text-text-secondary print:text-black">
          Handicap basis: {data.handicapModeLabel}
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
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full border-collapse text-xs print:text-[9px]">
            <thead>
              <tr className="border-b-2 border-surface-border text-left font-condensed text-[10px] font-bold uppercase tracking-widest text-text-muted print:border-black print:text-black print:text-[8px]">
                <th className="py-2 pr-2">#</th>
                <th className="py-2 pr-2">Player 1</th>
                <th className="py-2 pr-2 text-right">Pts</th>
                <th className="py-2 pr-2 text-right">Hdcp</th>
                <th className="py-2 pr-2 text-right">Gross</th>
                <th className="py-2 pr-2 text-right">Adj</th>
                <th className="py-2 pr-2 text-right">Net</th>
                <th className="py-2 pr-2">Player 2</th>
                <th className="py-2 pr-2 text-right">Pts</th>
                <th className="py-2 pr-2 text-right">Hdcp</th>
                <th className="py-2 pr-2 text-right">Gross</th>
                <th className="py-2 pr-2 text-right">Adj</th>
                <th className="py-2 pr-2 text-right">Net</th>
                <th className="py-2 pr-2">Stroke</th>
                <th className="py-2">Match Play</th>
              </tr>
            </thead>
            <tbody>
              {data.matches.map((match, i) => (
                <tr
                  key={match.id}
                  className="border-b border-surface-border print:border-gray-300"
                >
                  <td className="py-2 pr-2 tabular-nums text-text-secondary">{i + 1}</td>
                  <td className="py-2 pr-2 font-medium">{match.player1Name}</td>
                  <td className="py-2 pr-2 text-right tabular-nums font-semibold">
                    {formatNumber(match.player1Points)}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums text-text-secondary">
                    {formatNumber(match.player1PlayingHandicap)}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums text-text-secondary">
                    {formatNumber(match.player1Gross)}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums text-text-secondary">
                    {formatNumber(match.player1Adjusted)}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums text-text-secondary">
                    {formatNumber(match.player1Net)}
                  </td>
                  <td className="py-2 pr-2 font-medium">{match.player2Name}</td>
                  <td className="py-2 pr-2 text-right tabular-nums font-semibold">
                    {formatNumber(match.player2Points)}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums text-text-secondary">
                    {formatNumber(match.player2PlayingHandicap)}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums text-text-secondary">
                    {formatNumber(match.player2Gross)}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums text-text-secondary">
                    {formatNumber(match.player2Adjusted)}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums text-text-secondary">
                    {formatNumber(match.player2Net)}
                  </td>
                  <td className="py-2 pr-2 text-text-secondary">{match.strokeSummary}</td>
                  <td className="py-2 text-text-secondary">{match.matchPlaySummary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Standings */}
      {standings.standings.length > 0 ? (
        <section>
          <h2 className="font-condensed mb-2 text-sm font-bold uppercase tracking-widest text-text-muted print:text-black">
            {standingsHeading}
          </h2>
          <div className="overflow-x-auto print:overflow-visible">
            <table className={`${standingsTableWidth} table-fixed border-collapse text-xs print:text-[9px]`}>
              <colgroup>
                <col className="w-[40px]" />
                <col className="w-[240px]" />
                <col className="w-[52px]" />
                <col className="w-[72px]" />
                {standings.multiSeason ? <col className="w-[64px]" /> : null}
                {standings.multiSeason ? <col className="w-[64px]" /> : null}
                <col className="w-[52px]" />
                <col className="w-[68px]" />
                <col className="w-[68px]" />
                <col className="w-[48px]" />
                <col className="w-[48px]" />
              </colgroup>
              <thead>
                <tr className="border-b-2 border-surface-border text-left font-condensed text-[10px] font-bold uppercase tracking-widest text-text-muted print:border-black print:text-black print:text-[8px]">
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-2">Player</th>
                  <th className="py-2 pr-2 text-right">HCP</th>
                  <th className="py-2 pr-2 text-right">
                    {standings.multiSeason ? 'Overall' : 'Pts'}
                  </th>
                  {standings.multiSeason ? (
                    <>
                      <th className="py-2 pr-2 text-right">Summer</th>
                      <th className="py-2 pr-2 text-right">Spring</th>
                    </>
                  ) : null}
                  <th className="py-2 pr-2 text-right">Att</th>
                  <th className="py-2 pr-2 text-right">Stroke</th>
                  <th className="py-2 pr-2 text-right">Match</th>
                  <th className="py-2 pr-2 text-right">CTP</th>
                  <th className="py-2 text-right">LP</th>
                </tr>
              </thead>
              <tbody>
                {standings.standings.map((row, i) => (
                  <tr
                    key={row.playerId}
                    className="border-b border-surface-border print:border-gray-300"
                  >
                    <td className="py-2 pr-2 tabular-nums text-text-secondary">{i + 1}</td>
                    <td className="py-2 pr-2 font-medium">{row.name}</td>
                    <td className="py-2 pr-2 text-right tabular-nums text-text-secondary">
                      {row.currentIndexDisplay}
                    </td>
                    <td
                      className={`py-2 pr-2 text-right tabular-nums ${getComparisonValueClass(
                        'overallPoints',
                        standings.sortKey
                      )}`}
                    >
                      {row.overallPoints}
                    </td>
                    {standings.multiSeason ? (
                      <>
                        <td
                          className={`py-2 pr-2 text-right tabular-nums ${getComparisonValueClass(
                            'summerPoints',
                            standings.sortKey
                          )}`}
                        >
                          {row.summerPoints}
                        </td>
                        <td
                          className={`py-2 pr-2 text-right tabular-nums ${getComparisonValueClass(
                            'springPoints',
                            standings.sortKey
                          )}`}
                        >
                          {row.springPoints}
                        </td>
                      </>
                    ) : null}
                    <td className="py-2 pr-2 text-right tabular-nums">{row.attendancePoints}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{row.strokePoints}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{row.matchPlayPoints}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{row.ctpWins}</td>
                    <td className="py-2 text-right tabular-nums">{row.lpWins}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  )
}
