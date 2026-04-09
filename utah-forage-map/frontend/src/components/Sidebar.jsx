const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const SOURCES = [
  { label: 'Community',   value: 'community' },
  { label: 'iNaturalist', value: 'inaturalist' },
  { label: 'GBIF',        value: 'gbif' },
  { label: 'Web crawl',   value: 'web_crawl' },
]

const ELEV_MIN = 2000
const ELEV_MAX = 13500
const ELEV_STEP = 500

function fmt(ft) { return `${ft.toLocaleString()} ft` }

export default function Sidebar({ species = [], filters, onChange }) {
  function set(patch) {
    onChange({ ...filters, ...patch })
  }

  function toggleMonth(m) {
    const next = filters.months.includes(m)
      ? filters.months.filter(x => x !== m)
      : [...filters.months, m]
    set({ months: next })
  }

  function toggleSpecies(id) {
    const next = filters.speciesIds.includes(id)
      ? filters.speciesIds.filter(x => x !== id)
      : [...filters.speciesIds, id]
    set({ speciesIds: next })
  }

  function toggleSource(val) {
    const next = filters.sources.includes(val)
      ? filters.sources.filter(x => x !== val)
      : [...filters.sources, val]
    set({ sources: next })
  }

  function handleElevMin(e) {
    const v = Number(e.target.value)
    set({ elevMin: Math.min(v, filters.elevMax - ELEV_STEP) })
  }

  function handleElevMax(e) {
    const v = Number(e.target.value)
    set({ elevMax: Math.max(v, filters.elevMin + ELEV_STEP) })
  }

  function clearAll() {
    onChange({
      months: [], elevMin: ELEV_MIN, elevMax: ELEV_MAX,
      speciesIds: [], sources: [], verifiedOnly: false,
    })
  }

  const anyActive =
    filters.months.length > 0 ||
    filters.speciesIds.length > 0 ||
    filters.sources.length > 0 ||
    filters.verifiedOnly ||
    filters.elevMin > ELEV_MIN ||
    filters.elevMax < ELEV_MAX

  return (
    <div style={{ width: 240 }} className="flex flex-col h-full bg-white text-sm select-none">

      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-green-800 text-white flex-shrink-0">
        <p className="font-bold text-base leading-tight">Utah Forage Map</p>
        <p className="text-green-200 text-xs mt-0.5">Mushroom sightings</p>
      </div>

      {/* Scrollable filters */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">

        {/* Month filter */}
        <section>
          <Label>Month</Label>
          <div className="grid grid-cols-4 gap-1 mt-1.5">
            {MONTHS.map((name, i) => {
              const m = i + 1
              const on = filters.months.includes(m)
              return (
                <button
                  key={m}
                  onClick={() => toggleMonth(m)}
                  className={`text-xs py-1 rounded font-medium transition-colors
                    ${on
                      ? 'bg-green-700 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  {name}
                </button>
              )
            })}
          </div>
        </section>

        {/* Elevation range */}
        <section>
          <Label>Elevation</Label>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{fmt(filters.elevMin)}</span>
            <span>{fmt(filters.elevMax)}</span>
          </div>
          <div className="space-y-1.5 mt-1">
            <input
              type="range"
              min={ELEV_MIN} max={ELEV_MAX} step={ELEV_STEP}
              value={filters.elevMin}
              onChange={handleElevMin}
              className="w-full accent-green-700"
            />
            <input
              type="range"
              min={ELEV_MIN} max={ELEV_MAX} step={ELEV_STEP}
              value={filters.elevMax}
              onChange={handleElevMax}
              className="w-full accent-green-700"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {fmt(ELEV_MIN)} – {fmt(ELEV_MAX)} range
          </p>
        </section>

        {/* Species */}
        <section>
          <Label>Species</Label>
          <div className="mt-1.5 space-y-1 max-h-48 overflow-y-auto pr-1">
            {species.length === 0 && (
              <p className="text-xs text-gray-400 italic">Loading…</p>
            )}
            {species.map(sp => (
              <label key={sp.id} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={filters.speciesIds.includes(sp.id)}
                  onChange={() => toggleSpecies(sp.id)}
                  className="accent-green-700 rounded"
                />
                <span className="text-xs text-gray-700 leading-tight group-hover:text-gray-900">
                  {sp.common_name}
                </span>
              </label>
            ))}
          </div>
        </section>

        {/* Source */}
        <section>
          <Label>Source</Label>
          <div className="mt-1.5 space-y-1">
            {SOURCES.map(({ label, value }) => (
              <label key={value} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={filters.sources.includes(value)}
                  onChange={() => toggleSource(value)}
                  className="accent-green-700"
                />
                <span className="text-xs text-gray-700 group-hover:text-gray-900">{label}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Verified only */}
        <section>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="font-semibold text-gray-700">Verified only</span>
            <Toggle
              on={filters.verifiedOnly}
              onToggle={() => set({ verifiedOnly: !filters.verifiedOnly })}
            />
          </label>
        </section>
      </div>

      {/* Footer — clear button */}
      {anyActive && (
        <div className="flex-shrink-0 px-4 py-2 border-t border-gray-200">
          <button
            onClick={clearAll}
            className="w-full text-xs py-1.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium transition-colors"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Label({ children }) {
  return <p className="font-semibold text-gray-700 text-xs uppercase tracking-wide">{children}</p>
}

function Toggle({ on, onToggle }) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={on}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors
        ${on ? 'bg-green-700' : 'bg-gray-300'}`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform mt-0.5
          ${on ? 'translate-x-4' : 'translate-x-0.5'}`}
      />
    </button>
  )
}
