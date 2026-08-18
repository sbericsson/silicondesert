import type { CheckInSheetData } from '@/lib/checkin-sheet'
import { fitOpponents } from '@/lib/checkin-sheet'

/**
 * Print stylesheet for the Friday check-in sheet.
 *
 * Landscape is declared with explicit page dimensions rather than
 * `size: letter landscape`: the keyword form does not reliably force landscape
 * in real browser print dialogs, while explicit dimensions do. This rule also
 * has to beat the portrait `@page` in globals.css, which it does by being later
 * in document order.
 */
export const CHECK_IN_SHEET_CSS = `
@media print {
  @page { size: 11in 8.5in; margin: 0.34in 0.4in 0.3in 0.4in; }

  /* strip the commissioner workspace chrome so the sheet prints full bleed */
  body .min-h-screen > .mx-auto > header { display: none !important; }
  body .min-h-screen > .mx-auto {
    margin: 0 !important;
    max-width: none !important;
    padding: 0 !important;
  }
  body .min-h-screen > .mx-auto > main { padding: 0 !important; }
  body .min-h-screen { background: #fff !important; }
  .cis-screen-only { display: none !important; }
  .cis { padding: 0 !important; }
}

.cis {
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  color: #000;
  background: #fff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.cis * { box-sizing: border-box; }

.cis-masthead { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; padding-bottom: 5px; border-bottom: 2.5px solid #000; margin-bottom: 6px; }
.cis-masthead h1 { font-size: 15pt; letter-spacing: 0.06em; margin: 0; text-transform: uppercase; font-weight: 700; }
.cis-sub { font-size: 8.5pt; margin-top: 2px; letter-spacing: 0.02em; white-space: nowrap; }
.cis-sub b { font-size: 9.5pt; }
.cis-mast-r { display: flex; gap: 14px; font-size: 7pt; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; }
.cis-fill { border-bottom: 1px solid #000; display: inline-block; min-width: 52px; height: 12px; margin-left: 4px; vertical-align: -2px; }

.cis table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.cis thead { display: table-header-group; }
.cis tr { page-break-inside: avoid; }
.cis th, .cis td { border: 0.5pt solid #b6b6b6; padding: 0; text-align: center; vertical-align: middle; }
.cis thead th { background: #e9e9e9; font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; line-height: 1.05; padding: 2.5px 1px; border-color: #000; }
.cis thead tr.cis-grouprow th { background: #000; color: #fff; font-size: 6.8pt; letter-spacing: 0.11em; padding: 2px 1px; }
.cis thead tr.cis-grouprow th.cis-spacer { background: #fff; border-left-color: #fff; border-right-color: #fff; border-top-color: #fff; }
.cis thead tr.cis-grouprow th.cis-venue { letter-spacing: 0.02em; font-size: 6pt; }

.cis tbody td { height: 22.6px; font-size: 8.8pt; }
.cis tbody tr:nth-child(even) td { background: #f4f4f4; }
.cis tbody tr:nth-child(even) td.cis-grp, .cis tbody tr:nth-child(even) td.cis-box { background: #fff; }

.cis col.c-num { width: 0.22in; }
.cis col.c-name { width: 1.42in; }
.cis col.c-mem { width: 0.40in; }
.cis col.c-box { width: 0.34in; }
.cis col.c-here { width: 0.44in; }
.cis col.c-idx { width: 0.47in; }
.cis col.c-ch { width: 0.46in; }
.cis col.c-hist { width: 3.02in; }
.cis col.c-grp { width: 1.26in; }

.cis td.cis-num { font-size: 7pt; color: #666; }
.cis td.cis-name { white-space: nowrap; overflow: hidden; text-align: left; padding-left: 5px; font-size: 9.4pt; font-weight: 600; }
.cis tr.cis-guestrow td.cis-name { font-weight: 800; }

.cis td.cis-box { background: #fff; }
.cis .cis-cb { display: inline-block; width: 15.2px; height: 15.2px; line-height: 14px; text-align: center; border: 1.1pt solid #000; background: #fff; vertical-align: middle; }
.cis .cis-cb.cis-big { width: 17.2px; height: 17.2px; border-width: 1.4pt; }
.cis .cis-cb.cis-guestbox { border-width: 2pt; }
.cis .cis-memx { font-size: 8.6pt; font-weight: 600; color: #5a5a5a; }
.cis th.cis-mem-h, .cis td.cis-mem { border-right: 1.4pt solid #000; }
.cis tr.cis-guestrow td.cis-mem, .cis tbody tr:nth-child(even).cis-guestrow td.cis-mem { background: #dcdcdc; }
.cis th.cis-here-h, .cis td.cis-here { border-left: 1.4pt solid #000; border-right: 1.4pt solid #000; }

.cis td.cis-idx { font-size: 8.8pt; font-weight: 700; border-left: 1.4pt solid #000; }
.cis td.cis-idx sup { font-size: 6pt; font-weight: 400; color: #666; margin-left: 0.5px; }
.cis th.cis-ch { font-size: 6pt; letter-spacing: 0; line-height: 1.15; white-space: nowrap; overflow: hidden; }
.cis th.cis-ch .cis-venue-line { display: block; font-size: 4.8pt; letter-spacing: 0; font-weight: 600; }
.cis td.cis-ch { font-size: 8.4pt; color: #222; }
.cis th.cis-ch.cis-today { background: #000; color: #fff; }
.cis td.cis-ch.cis-today { background: #d9d9d9; font-weight: 700; font-size: 9.2pt; color: #000; }
.cis tbody tr:nth-child(even) td.cis-ch.cis-today { background: #d0d0d0; }
.cis th.cis-grpstart, .cis td.cis-grpstart { border-left: 1.4pt solid #000; }

.cis td.cis-hist { text-align: left; padding: 0 4px; font-size: 7.6pt; white-space: nowrap; overflow: hidden; border-left: 1.4pt solid #000; letter-spacing: -0.01em; }
.cis td.cis-hist .cis-p { color: #444; }
.cis td.cis-hist .cis-p::after { content: "  \\00b7  "; color: #bbb; }
.cis td.cis-hist span:last-child::after { content: ""; }
.cis td.cis-hist .cis-rep { background: #000; color: #fff; font-weight: 700; padding: 1px 3px; }
.cis td.cis-hist .cis-rep + .cis-p::before, .cis td.cis-hist .cis-rep + .cis-rep::before { content: "  \\00b7  "; color: #bbb; }
.cis td.cis-hist .cis-more { color: #888; font-style: italic; margin-left: 3px; }
.cis td.cis-hist .cis-none { color: #bbb; }
.cis .cis-nh { font-size: 7.2pt; color: #777; font-weight: 400; }
.cis td.cis-ch .cis-none { color: #ccc; }

.cis td.cis-grp { background: #fff; border-left: 1.4pt solid #000; }
.cis .cis-gnum { display: block; width: 0.28in; height: 100%; border-right: 0.5pt dashed #999; }

.cis-footer { margin-top: 7px; display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; page-break-inside: avoid; }
.cis-legend { font-size: 7.2pt; line-height: 1.5; color: #333; }
.cis-legend b { color: #000; }
.cis-legend .cis-rep { background: #000; color: #fff; font-weight: 700; padding: 1px 3px; }
.cis-tally { border: 1.4pt solid #000; padding: 6px 10px; font-size: 7.6pt; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; }
.cis-tally .cis-row { margin-bottom: 3px; }
.cis-tally .cis-row:last-child { margin-bottom: 0; }
.cis-tally .cis-fill { min-width: 40px; }
`

export function CheckInSheet({ data }: { data: CheckInSheetData }) {
  const venueCode = data.venue ? data.venue.toUpperCase() : 'MEM'

  return (
    <div className="cis">
      <style dangerouslySetInnerHTML={{ __html: CHECK_IN_SHEET_CSS }} />

      <div className="cis-masthead">
        <div>
          <h1>SDGL &middot; Friday Check-In &amp; Pairings</h1>
          <div className="cis-sub">
            <b>{data.dateLabel}</b>
            {data.courseName ? (
              <>
                {' '}&middot; Playing <b>{data.courseName}</b>
              </>
            ) : (
              <> &middot; <b>No course set for this week</b></>
            )}{' '}
            &middot; {data.playerCount} on roster &middot; {data.guestCount} guests
          </div>
        </div>
        <div className="cis-mast-r">
          <span>CTP hole <span className="cis-fill" /></span>
          <span>LP hole <span className="cis-fill" /></span>
          <span>1st tee <span className="cis-fill" /></span>
          <span>Commissioner <span className="cis-fill" /></span>
        </div>
      </div>

      <table>
        <colgroup>
          <col className="c-num" />
          <col className="c-name" />
          <col className="c-mem" />
          <col className="c-box" />
          <col className="c-box" />
          <col className="c-here" />
          <col className="c-idx" />
          {data.courses.map((course) => (
            <col key={course.id} className="c-ch" />
          ))}
          <col className="c-hist" />
          <col className="c-grp" />
        </colgroup>
        <thead>
          <tr className="cis-grouprow">
            <th className="cis-spacer" colSpan={2} />
            <th className="cis-venue">{venueCode}</th>
            <th colSpan={2}>Proxy pool</th>
            <th>In</th>
            <th colSpan={data.courses.length + 1}>Handicap &mdash; by rotation course</th>
            <th>Paired with this season</th>
            <th>Today&apos;s group</th>
          </tr>
          <tr>
            <th />
            <th style={{ textAlign: 'left', paddingLeft: '4px' }}>Player</th>
            <th className="cis-mem-h">Mem?</th>
            <th>CTP</th>
            <th>LPM</th>
            <th className="cis-here-h">Here?</th>
            <th>Index</th>
            {data.courses.map((course, courseIndex) => (
              <th
                key={course.id}
                className={[
                  'cis-ch',
                  course.isToday ? 'cis-today' : '',
                  courseIndex === 0 ? 'cis-grpstart' : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className="cis-venue-line">{course.venue.toUpperCase()}</span>
                {course.nineLabel.toUpperCase()}
              </th>
            ))}
            <th>Repeats flagged &mdash; don&apos;t pair again</th>
            <th>Write in</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, rowIndex) => {
            const { shown, hidden } = fitOpponents(row.opponents)

            return (
              <tr key={row.playerId} className={row.isMember ? undefined : 'cis-guestrow'}>
                <td className="cis-num">{rowIndex + 1}</td>
                <td className="cis-name">{row.name}</td>
                <td className="cis-box cis-mem">
                  {row.isMember ? (
                    <span className="cis-memx">X</span>
                  ) : (
                    <span className="cis-cb cis-guestbox" />
                  )}
                </td>
                <td className="cis-box">
                  <span className="cis-cb" />
                </td>
                <td className="cis-box">
                  <span className="cis-cb" />
                </td>
                <td className="cis-box cis-here">
                  <span className="cis-cb cis-big" />
                </td>
                <td className="cis-idx">
                  {row.index === null ? (
                    <span className="cis-nh">NH</span>
                  ) : (
                    row.indexLabel
                  )}
                  <sup>{row.isEstimated ? `${row.teeLetter}*` : row.teeLetter}</sup>
                </td>
                {row.courseHandicaps.map((value, courseIndex) => (
                  <td
                    key={data.courses[courseIndex]?.id ?? courseIndex}
                    className={[
                      'cis-ch',
                      data.courses[courseIndex]?.isToday ? 'cis-today' : '',
                      courseIndex === 0 ? 'cis-grpstart' : ''
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {value === null ? <span className="cis-none">&middot;</span> : value}
                  </td>
                ))}
                <td className="cis-hist">
                  {shown.length === 0 ? (
                    <span className="cis-none">&mdash;</span>
                  ) : (
                    <>
                      {shown.map((opponent, opponentIndex) => (
                        <span
                          // Index, not name: two players sharing a surname AND a
                          // first initial would collide on a name-based key.
                          key={`${opponent.name}-${opponentIndex}`}
                          className={opponent.count >= 2 ? 'cis-rep' : 'cis-p'}
                        >
                          {opponent.count >= 2
                            ? `${opponent.name}×${opponent.count}`
                            : opponent.name}
                        </span>
                      ))}
                      {hidden > 0 ? <span className="cis-more">+{hidden}</span> : null}
                    </>
                  )}
                </td>
                <td className="cis-grp">
                  <span className="cis-gnum" />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="cis-footer">
        <div className="cis-legend">
          <b>Mem?</b> is pre-printed from the app: <b>X</b> = {data.venue ?? 'course'} member,
          nothing to do. An <b>open box = guest</b> &mdash; collect the guest fee (feeds the
          year-end prize pool) and tick the box.
          <br />
          <b>Index</b> superscript = tee played (B blue / W white / Y yellow / S silver);
          course handicaps are computed from that tee. <b>NH</b> = no established index yet;
          <b> *</b> = estimated from a seed handicap. Paired-with lists this season&apos;s
          opponents; <span className="cis-rep">Name&times;2</span> means they&apos;ve already
          played together that many times &mdash; <b>do not pair them again</b>. <i>+n</i> =
          additional one-time opponents not shown.
        </div>
        <div className="cis-tally">
          <div className="cis-row">
            Here today <span className="cis-fill" /> &nbsp; Groups <span className="cis-fill" />
          </div>
          <div className="cis-row">
            CTP buy-ins <span className="cis-fill" /> &nbsp; LPM buy-ins{' '}
            <span className="cis-fill" />
          </div>
          <div className="cis-row">
            Guest fees collected <span className="cis-fill" /> of {data.guestCount} &nbsp; ${' '}
            <span className="cis-fill" />
          </div>
        </div>
      </div>
    </div>
  )
}
