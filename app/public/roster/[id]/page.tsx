import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPublicPlayerDetail } from '@/lib/public-player'
import { PublicPageHeader } from '@/components/public-page-header'
import { formatUsPhoneNumber, normalizeUsPhoneNumber } from '@/lib/phone'

export const revalidate = 60

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  }
}

function ContactItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface-elevated p-4 shadow-sm">
      <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
        {label}
      </p>
      <div className="mt-1 text-sm text-text-primary">{children}</div>
    </div>
  )
}

export default async function PublicPlayerDetailPage({
  params
}: {
  params: { id: string }
}) {
  const detail = await getPublicPlayerDetail(params.id)

  if (!detail) {
    notFound()
  }

  const phone = formatUsPhoneNumber(detail.cellPhone)
  const normalizedPhone = normalizeUsPhoneNumber(detail.cellPhone)
  const phoneHref = normalizedPhone ? `tel:${normalizedPhone}` : null
  const handicapLabel =
    detail.handicap.kind === 'HCP' ? detail.handicap.value : detail.handicap.kind

  return (
    <section className="space-y-4">
      <PublicPageHeader eyebrow="Roster" title={detail.name}>
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-surface-border bg-surface-base px-4 py-3">
          <p className="text-sm text-text-secondary">Handicap index</p>
          <p className="rounded-full bg-surface-sunken px-3 py-1 text-sm font-semibold text-text-primary">
            {handicapLabel}
          </p>
        </div>
        <Link
          href="/public/roster"
          className="mt-3 inline-block text-sm font-medium text-accent-text hover:underline"
        >
          ← Back to roster
        </Link>
      </PublicPageHeader>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <ContactItem label="Email">
          {detail.email ? (
            <a href={`mailto:${detail.email}`} className="text-accent-text hover:underline">
              {detail.email}
            </a>
          ) : (
            <span className="text-text-muted">Not provided</span>
          )}
        </ContactItem>

        <ContactItem label="Cell">
          {phone && phoneHref ? (
            <a href={phoneHref} className="text-accent-text hover:underline">
              {phone}
            </a>
          ) : (
            <span className="text-text-muted">Not provided</span>
          )}
        </ContactItem>

        <ContactItem label="Tees">
          {detail.teeColorLabel ?? <span className="text-text-muted">—</span>}
        </ContactItem>

        <ContactItem label="Season points">
          {detail.seasonPoints.multiSeason ? (
            <span>
              {detail.seasonPoints.overall}{' '}
              <span className="text-text-muted">
                (Spring {detail.seasonPoints.spring} · Summer {detail.seasonPoints.summer})
              </span>
            </span>
          ) : (
            detail.seasonPoints.overall
          )}
        </ContactItem>
      </div>

      <div className="rounded-2xl border border-surface-border bg-surface-elevated p-5 shadow-sm">
        <h3 className="font-condensed text-lg font-bold uppercase tracking-wide text-text-primary">
          Handicap rounds
        </h3>
        <p className="mt-1 text-sm text-text-secondary">
          These are the most recent 20 scoring rounds. Each round&apos;s differential
          measures how that score compared to the difficulty of the tees played. Under
          the World Handicap System, the handicap index is the average of the lowest 8
          differentials from the last 20 rounds (fewer are used until 20 rounds are
          posted). The highlighted rows are the differentials currently counted toward
          this player&apos;s index.{' '}
          <a
            href="https://www.usga.org/content/usga/home-page/handicapping/world-handicap-system/topics/handicap-index-calculation.html"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-accent-text hover:underline"
          >
            Click here for the full USGA calculation details.
          </a>
        </p>

        {detail.rounds.length === 0 ? (
          <p className="mt-4 text-sm text-text-muted">No handicap rounds yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-text-muted">
                  <th className="py-2 pr-3 font-semibold">Date</th>
                  <th className="py-2 pr-3 font-semibold">Course</th>
                  <th className="py-2 pr-3 text-right font-semibold">Gross</th>
                  <th className="py-2 pr-3 text-right font-semibold">Adj</th>
                  <th className="py-2 pr-3 text-right font-semibold">Rating/Slope</th>
                  <th className="py-2 pr-0 text-right font-semibold">Diff</th>
                </tr>
              </thead>
              <tbody>
                {detail.rounds.map((round, index) => (
                  <tr
                    key={index}
                    className={`border-t border-surface-border ${
                      round.usedInIndex ? 'bg-surface-sunken' : ''
                    }`}
                  >
                    <td className="py-2 pr-3 text-text-secondary">{round.date}</td>
                    <td className="py-2 pr-3 text-text-primary">
                      {round.isImported ? (
                        <span className="text-text-muted">Imported</span>
                      ) : (
                        round.courseName ?? '—'
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-text-secondary">
                      {round.grossScore > 0 ? round.grossScore : '—'}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-text-secondary">
                      {round.adjustedGrossScore > 0 ? round.adjustedGrossScore : '—'}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-text-secondary">
                      {round.isImported ? '—' : `${round.courseRating}/${round.slopeRating}`}
                    </td>
                    <td className="py-2 pr-0 text-right font-medium tabular-nums text-text-primary">
                      {round.courseDifferential.toFixed(1)}
                      {round.usedInIndex ? (
                        <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
                          counts
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
