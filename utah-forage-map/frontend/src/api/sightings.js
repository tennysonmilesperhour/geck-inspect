import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
})

/**
 * Fetch sightings. Undefined values are omitted from query string automatically.
 * @param {object} params - API-side filter params (elev_min, elev_max, verified_only, species_id, source)
 */
export const getSightings = (params = {}) =>
  api.get('/api/v1/sightings', { params }).then(r => r.data)

/** Fetch all species (used to populate sidebar checkboxes and build speciesMap). */
export const getSpecies = () =>
  api.get('/api/v1/species').then(r => r.data)

/**
 * Create a new sighting (requires auth token in axios defaults or interceptor).
 * @param {object} data - SightingCreate payload
 */
export const createSighting = (data) =>
  api.post('/api/v1/sightings', data).then(r => r.data)

/**
 * Cast a verification vote on a sighting.
 * @param {string} id - Sighting UUID
 * @param {{ confirmed: boolean, notes?: string }} vote
 */
export const verifySighting = (id, vote) =>
  api.post(`/api/v1/sightings/${id}/verify`, vote).then(r => r.data)
