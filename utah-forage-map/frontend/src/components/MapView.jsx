import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || ''

// ── Species colour palette ────────────────────────────────────────────────────

const COLOUR_MAP = {
  chanterelle: '#EF9F27',
  morel:       '#639922',
  porcini:     '#D85A30',
  bolete:      '#D85A30',
  oyster:      '#378ADD',
  lion:        '#7F77DD',
  default:     '#888780',
}

function speciesColour(commonName = '') {
  const n = commonName.toLowerCase()
  if (n.includes('chanterelle'))           return COLOUR_MAP.chanterelle
  if (n.includes('morel'))                 return COLOUR_MAP.morel
  if (n.includes('porcini') || n.includes('bolete')) return COLOUR_MAP.bolete
  if (n.includes('oyster'))                return COLOUR_MAP.oyster
  if (n.includes("lion"))                  return COLOUR_MAP.lion
  return COLOUR_MAP.default
}

// ── GeoJSON helpers ───────────────────────────────────────────────────────────

function toGeoJSON(sightings, speciesMap) {
  return {
    type: 'FeatureCollection',
    features: sightings.map(s => {
      const sp = speciesMap[s.species_id]
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.longitude, s.latitude] },
        properties: {
          id:          s.id,
          speciesName: sp?.common_name ?? 'Unknown species',
          foundOn:     s.found_on     ?? '—',
          elevationFt: s.elevation_ft != null ? `${s.elevation_ft.toLocaleString()} ft` : '—',
          habitatType: s.habitat_type ?? '—',
          source:      s.source,
          verified:    s.verified,
          colour:      speciesColour(sp?.common_name),
        },
      }
    }),
  }
}

// ── Layer / source ids ────────────────────────────────────────────────────────

const SRC           = 'sightings'
const CLUSTER_LAYER = 'clusters'
const COUNT_LAYER   = 'cluster-count'
const POINT_LAYER   = 'unclustered-point'

// ── Component ─────────────────────────────────────────────────────────────────

export default function MapView({ sightings = [], speciesMap = {} }) {
  const containerRef  = useRef(null)
  const mapRef        = useRef(null)
  const popupRef      = useRef(null)

  // Keep data refs current so the 'load' handler always gets fresh values
  const sightingsRef  = useRef(sightings)
  const speciesMapRef = useRef(speciesMap)

  // Update source data whenever sightings or speciesMap changes
  useEffect(() => {
    sightingsRef.current  = sightings
    speciesMapRef.current = speciesMap

    const src = mapRef.current?.getSource(SRC)
    if (src) src.setData(toGeoJSON(sightings, speciesMap))
  }, [sightings, speciesMap])

  // Initialise map once
  useEffect(() => {
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style:     'mapbox://styles/mapbox/outdoors-v12',
      center:    [-111.5, 39.5],
      zoom:      7,
    })
    mapRef.current = map
    popupRef.current = new mapboxgl.Popup({ closeButton: true, maxWidth: '280px' })

    map.addControl(new mapboxgl.NavigationControl(), 'top-right')
    map.addControl(new mapboxgl.ScaleControl(), 'bottom-right')

    map.on('load', () => {
      // ── GeoJSON source with built-in clustering ──
      map.addSource(SRC, {
        type:           'geojson',
        data:           toGeoJSON(sightingsRef.current, speciesMapRef.current),
        cluster:        true,
        clusterMaxZoom: 12,
        clusterRadius:  50,
      })

      // Cluster circles — size/colour steps by count
      map.addLayer({
        id:     CLUSTER_LAYER,
        type:   'circle',
        source: SRC,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step', ['get', 'point_count'],
            '#6db35a',  // < 10
            10, '#e8a838',  // 10–29
            30, '#d85a30',  // ≥ 30
          ],
          'circle-radius': [
            'step', ['get', 'point_count'],
            18, 10, 26, 30, 36,
          ],
          'circle-opacity':       0.85,
          'circle-stroke-width':  2,
          'circle-stroke-color':  '#fff',
        },
      })

      // Cluster count labels
      map.addLayer({
        id:     COUNT_LAYER,
        type:   'symbol',
        source: SRC,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-size':  13,
        },
        paint: { 'text-color': '#fff' },
      })

      // Individual sighting dots
      map.addLayer({
        id:     POINT_LAYER,
        type:   'circle',
        source: SRC,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color':        ['get', 'colour'],
          'circle-radius':       7,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
          'circle-opacity':      0.9,
        },
      })

      // ── Interactions ──────────────────────────────

      // Zoom into cluster on click
      map.on('click', CLUSTER_LAYER, async (e) => {
        const [feature] = e.features
        const clusterId = feature.properties.cluster_id
        try {
          const zoom = await map.getSource(SRC).getClusterExpansionZoom(clusterId)
          map.easeTo({ center: feature.geometry.coordinates, zoom })
        } catch (_) { /* ignore */ }
      })

      // Popup on individual sighting click
      map.on('click', POINT_LAYER, (e) => {
        const [f]  = e.features
        const p    = f.properties
        const html = `
          <div style="font-family:system-ui,sans-serif;font-size:13px;line-height:1.7">
            <p style="font-size:15px;font-weight:600;margin:0 0 4px">${p.speciesName}</p>
            <p style="margin:0">📅 ${p.foundOn}</p>
            <p style="margin:0">⛰ ${p.elevationFt}</p>
            <p style="margin:0">🌲 ${p.habitatType}</p>
            <p style="margin:0;color:#666">Source: ${p.source}</p>
            <p style="margin:4px 0 0;font-weight:500">${p.verified ? '✅ Verified' : '⬜ Unverified'}</p>
          </div>`

        popupRef.current
          .setLngLat(f.geometry.coordinates.slice())
          .setHTML(html)
          .addTo(map)
      })

      // Cursor styles
      for (const layer of [CLUSTER_LAYER, POINT_LAYER]) {
        map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = '' })
      }
    })

    return () => {
      popupRef.current?.remove()
      map.remove()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
