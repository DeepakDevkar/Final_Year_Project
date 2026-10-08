import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'

// Free tile sources, no API key needed
const LAYERS = {
  street: {
    label: 'Street',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  satellite: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    options: { maxZoom: 19, attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics' },
  },
  terrain: {
    label: 'Terrain',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    options: { maxZoom: 19, attribution: 'Tiles &copy; Esri, HERE, Garmin, USGS, OpenStreetMap contributors' },
  },
}

const START = { center: [18.5204, 73.8567], zoom: 12 } // Pune, India

export default function App() {
  const mapEl = useRef(null)
  const map = useRef(null)
  const tiles = useRef(null)
  const marker = useRef(null)

  const [style, setStyle] = useState('street')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [coords, setCoords] = useState('Move the cursor over the map')

  // Create the map once
  useEffect(() => {
    const m = L.map(mapEl.current, { zoomControl: false }).setView(START.center, START.zoom)
    L.control.zoom({ position: 'bottomright' }).addTo(m)
    m.on('mousemove', (e) => setCoords(`${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`))
    map.current = m
    return () => m.remove()
  }, [])

  // Swap tile layer when the style changes
  useEffect(() => {
    if (!map.current) return
    if (tiles.current) map.current.removeLayer(tiles.current)
    const cfg = LAYERS[style]
    const layer = L.tileLayer(cfg.url, cfg.options).addTo(map.current)
    layer.on('tileerror', () => setStatus('Some map tiles failed to load. Check your connection.'))
    tiles.current = layer
  }, [style])

  function dropMarker(lat, lng, label) {
    if (marker.current) map.current.removeLayer(marker.current)
    marker.current = L.circleMarker([lat, lng], {
      radius: 9, color: '#fff', weight: 3, fillColor: '#0b6e6e', fillOpacity: 1,
    })
      .addTo(map.current)
      .bindPopup(label)
      .openPopup()
  }

  // Search with Photon (free geocoder built on OpenStreetMap data)
  async function handleSearch(e) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setStatus('Searching…')
    try {
      const res = await fetch(`https://photon.komoot.io/api/?limit=1&q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (!data.features?.length) return setStatus('No place found. Try a different name.')
      const f = data.features[0]
      const [lon, lat] = f.geometry.coordinates
      const p = f.properties
      const name = [p.name, p.city, p.state, p.country]
        .filter((v, i, a) => v && a.indexOf(v) === i)
        .join(', ')
      map.current.flyTo([lat, lon], 13, { duration: 1.5 })
      dropMarker(lat, lon, name)
      setStatus(`Showing: ${name}`)
    } catch {
      setStatus('Search failed. Check your internet connection.')
    }
  }

  function handleLocate() {
    if (!navigator.geolocation) return setStatus('Location is not supported in this browser.')
    setStatus('Finding your location…')
    navigator.geolocation.getCurrentPosition(
      ({ coords: c }) => {
        map.current.flyTo([c.latitude, c.longitude], 15, { duration: 1.5 })
        dropMarker(c.latitude, c.longitude, 'You are here')
        setStatus('Location found.')
      },
      () => setStatus('Location blocked. Allow access in your browser settings.')
    )
  }

  return (
    <>
      {/* Real map as the page background */}
      <div ref={mapEl} className="map" aria-label="Interactive world map" />

      {/* Your website content goes here, above the map */}
      <header className="topbar">
        <span className="brand">Atlas</span>
        <nav aria-label="Map style">
          {Object.entries(LAYERS).map(([key, l]) => (
            <button key={key} aria-pressed={style === key} onClick={() => setStyle(key)}>
              {l.label}
            </button>
          ))}
          <button onClick={handleLocate}>My location</button>
        </nav>
      </header>

      <section className="card">
        <h1>Explore the real world map</h1>
        <p>This page sits on a live, interactive map. Drag to pan, scroll to zoom, or search for any place.</p>
        <form className="search" onSubmit={handleSearch}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a city or address"
            aria-label="Search a place"
          />
          <button type="submit">Search</button>
        </form>
        <div className="status" role="status">{status}</div>
        <div className="coords">{coords}</div>
      </section>
    </>
  )
}
