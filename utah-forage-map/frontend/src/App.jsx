import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import MapView from './components/MapView'
import Sidebar from './components/Sidebar'
import { getSightings, getSpecies } from './api/sightings'

// ── Default filter state ──────────────────────────────────────────────────────

const DEFAULTS = {
  months:      [],     // empty = all
  elevMin:     2000,
  elevMax:     13500,
  speciesIds:  [],     // empty = all; single value is sent to API, multiple filtered client-side
  sources:     [],     // empty = all; filtered client-side
  verifiedOnly: false,
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [filters, setFilters] = useState(DEFAULTS)

  // Build API-side params (server can handle elev range, verified, single species)
  const apiParams = useMemo(() => {
    const p = {}
    if (filters.elevMin > 2000)    p.elev_min     = filters.elevMin
    if (filters.elevMax < 13500)   p.elev_max     = filters.elevMax
    if (filters.verifiedOnly)      p.verified_only = true
    if (filters.speciesIds.length === 1) p.species_id = filters.speciesIds[0]
    return p
  }, [filters])

  // Sightings query — keyed by api params so cache stays fresh per filter combo
  const { data: allSightings = [], isLoading, isFetching } = useQuery({
    queryKey: ['sightings', apiParams],
    queryFn:  () => getSightings(apiParams),
    staleTime: 60_000,
  })

  // Species list — rarely changes; long staleTime
  const { data: species = [] } = useQuery({
    queryKey: ['species'],
    queryFn:  getSpecies,
    staleTime: 300_000,
  })

  // Build id→species lookup for MapView marker colouring
  const speciesMap = useMemo(
    () => Object.fromEntries(species.map(s => [s.id, s])),
    [species],
  )

  // Client-side post-filtering for multi-value filters the API doesn't support
  const sightings = useMemo(() => {
    return allSightings.filter(s => {
      if (filters.months.length > 0 && s.month != null && !filters.months.includes(s.month))
        return false
      if (filters.speciesIds.length > 1 && !filters.speciesIds.includes(s.species_id))
        return false
      if (filters.sources.length > 0 && !filters.sources.includes(s.source))
        return false
      return true
    })
  }, [allSightings, filters])

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>

      {/* Left sidebar */}
      <Sidebar
        species={species}
        filters={filters}
        onChange={setFilters}
      />

      {/* Map area */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapView sightings={sightings} speciesMap={speciesMap} />

        {/* Loading overlay */}
        {(isLoading || isFetching) && (
          <div
            style={{
              position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(4px)',
              borderRadius: 8, padding: '6px 14px',
              display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              fontSize: 13, color: '#374151', zIndex: 10,
            }}
          >
            <Spinner />
            {isLoading ? 'Loading sightings…' : 'Refreshing…'}
          </div>
        )}

        {/* Result count badge */}
        {!isLoading && (
          <div
            style={{
              position: 'absolute', bottom: 32, left: 12,
              background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(4px)',
              borderRadius: 6, padding: '4px 10px',
              fontSize: 12, color: '#6b7280',
              boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
            }}
          >
            {sightings.length.toLocaleString()} sighting{sightings.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
      style={{ animation: 'spin 0.8s linear infinite' }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  )
}
