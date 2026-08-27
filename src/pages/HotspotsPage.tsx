import { MOCK_HOTSPOTS, MOCK_OBSERVATIONS } from '../mock/data'

function getTrendIcon(trend: string): string {
  switch (trend) {
    case 'increasing': return '↑'
    case 'decreasing': return '↓'
    default: return '→'
  }
}

function getTrendColor(trend: string): string {
  switch (trend) {
    case 'increasing': return 'text-red-500 bg-red-50'
    case 'decreasing': return 'text-brand-500 bg-brand-50'
    default: return 'text-surface-500 bg-surface-100'
  }
}

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    straws: '🥤',
    'cups-lids': '☕',
    utensils: '🍴',
    bottles: '🧴',
    'food-packaging': '📦',
    bags: '🛍️',
    containers: '🥡',
    other: '♻️',
  }
  return icons[category] ?? '♻️'
}

export default function HotspotsPage() {
  // Sort hotspots by observation count (highest first)
  const sortedHotspots = [...MOCK_HOTSPOTS].sort(
    (a, b) => b.observationCount - a.observationCount
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-surface-800">Hotspots</h2>
        <p className="text-sm text-surface-500 mt-1">
          Patterns identified from community-reported observations
        </p>
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
        ℹ These insights are based on community-reported data, not exhaustive measurements.
        Hotspot rankings reflect the frequency and consistency of student observations.
      </div>

      {/* Hotspot Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sortedHotspots.map((hotspot) => {
          const reports = MOCK_OBSERVATIONS.filter((o) =>
            hotspot.reportIds.includes(o.id)
          )
          const uniqueReporters = new Set(reports.map((r) => r.reporterId)).size

          return (
            <div
              key={hotspot.id}
              className="bg-white rounded-xl border border-surface-200 p-5"
            >
              {/* Top Row */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-surface-100 flex items-center justify-center text-2xl">
                    {getCategoryIcon(hotspot.category)}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-surface-800">
                      {hotspot.location}
                    </h3>
                    <p className="text-xs text-surface-400">
                      {hotspot.category.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </p>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${getTrendColor(hotspot.trend)}`}
                >
                  {getTrendIcon(hotspot.trend)} {hotspot.trend}
                </span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="text-center p-2 bg-surface-50 rounded-lg">
                  <p className="text-lg font-bold text-surface-800">
                    {hotspot.observationCount}
                  </p>
                  <p className="text-xs text-surface-400">Reports</p>
                </div>
                <div className="text-center p-2 bg-surface-50 rounded-lg">
                  <p className="text-lg font-bold text-surface-800">
                    {uniqueReporters}
                  </p>
                  <p className="text-xs text-surface-400">Reporters</p>
                </div>
                <div className="text-center p-2 bg-surface-50 rounded-lg">
                  <p className="text-lg font-bold text-surface-800">
                    {hotspot.firstReported.slice(5)}
                  </p>
                  <p className="text-xs text-surface-400">First Seen</p>
                </div>
              </div>

              {/* Recent reports */}
              <div className="mt-4 border-t border-surface-100 pt-3">
                <p className="text-xs font-medium text-surface-500 mb-2">
                  Recent Reports
                </p>
                <div className="space-y-2">
                  {reports.slice(0, 3).map((report) => (
                    <div key={report.id} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0" />
                      <p className="text-xs text-surface-600 truncate">
                        {report.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Empty state */}
      {sortedHotspots.length === 0 && (
        <div className="text-center py-12">
          <p className="text-4xl text-surface-300">🔍</p>
          <p className="text-sm text-surface-500 mt-3">No hotspots identified yet</p>
          <p className="text-xs text-surface-400 mt-1">
            Submit more observations to help identify patterns
          </p>
        </div>
      )}
    </div>
  )
}
