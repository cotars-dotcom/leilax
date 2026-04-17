/**
 * MapaLocaisProximos — Leaflet + Overpass API
 * 11 categorias, raio selecionável 500m/1km/2km
 * Leaflet carregado via CDN (sem npm) para manter bundle pequeno
 */
import { useState, useEffect, useRef } from 'react'

const CATEGORIAS = [
  { id: 'transport',    label: 'Transporte',   cor: '#3B82F6', icon: '🚌', query: '["highway"~"bus_stop|tram_stop"]["public_transport"~"stop_position|platform"]' },
  { id: 'supermarket',  label: 'Supermercado', cor: '#10B981', icon: '🛒', query: '["shop"~"supermarket|convenience|grocery"]' },
  { id: 'pharmacy',     label: 'Farmácia',     cor: '#EF4444', icon: '💊', query: '["amenity"="pharmacy"]' },
  { id: 'hospital',     label: 'Hospital',     cor: '#DC2626', icon: '🏥', query: '["amenity"~"hospital|clinic|health_centre"]' },
  { id: 'school',       label: 'Escola',       cor: '#F59E0B', icon: '🏫', query: '["amenity"~"school|kindergarten"]' },
  { id: 'university',   label: 'Universidade', cor: '#8B5CF6', icon: '🎓', query: '["amenity"="university"]' },
  { id: 'shopping',     label: 'Shopping',     cor: '#EC4899', icon: '🛍️', query: '["shop"~"mall|department_store"]' },
  { id: 'park',         label: 'Parque',       cor: '#059669', icon: '🌳', query: '["leisure"~"park|garden|recreation_ground"]' },
  { id: 'bank',         label: 'Banco',        cor: '#0EA5E9', icon: '🏦', query: '["amenity"~"bank|atm"]' },
  { id: 'gym',          label: 'Academia',     cor: '#F97316', icon: '💪', query: '["leisure"~"fitness_centre|sports_centre"]' },
  { id: 'restaurant',   label: 'Restaurante',  cor: '#84CC16', icon: '🍽️', query: '["amenity"~"restaurant|food_court|fast_food"]' },
]

const RAIOS = [500, 1000, 2000]

function buildOverpassQuery(lat, lng, raioM) {
  const parts = CATEGORIAS.map(c =>
    `node${c.query}(around:${raioM},${lat},${lng});\nway${c.query}(around:${raioM},${lat},${lng});`
  ).join('\n')
  return `[out:json][timeout:25];(\n${parts}\n);out center 200;`
}

function catFromEl(el) {
  const t = el.tags || {}
  if (t.amenity === 'pharmacy') return 'pharmacy'
  if (t.amenity === 'bank' || t.amenity === 'atm') return 'bank'
  if (t.amenity === 'hospital' || t.amenity === 'clinic' || t.amenity === 'health_centre') return 'hospital'
  if (t.amenity === 'university') return 'university'
  if (t.amenity === 'school' || t.amenity === 'kindergarten') return 'school'
  if (t.amenity === 'restaurant' || t.amenity === 'food_court' || t.amenity === 'fast_food') return 'restaurant'
  if (t.highway === 'bus_stop' || t.public_transport) return 'transport'
  if (t.shop === 'supermarket' || t.shop === 'convenience' || t.shop === 'grocery') return 'supermarket'
  if (t.shop === 'mall' || t.shop === 'department_store') return 'shopping'
  if (t.leisure === 'park' || t.leisure === 'garden' || t.leisure === 'recreation_ground') return 'park'
  if (t.leisure === 'fitness_centre' || t.leisure === 'sports_centre') return 'gym'
  return null
}

// Injetar CSS e JS do Leaflet via CDN uma vez
let leafletLoaded = false
function ensureLeaflet() {
  if (leafletLoaded || window.L) { leafletLoaded = true; return Promise.resolve() }
  return new Promise((resolve, reject) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => { leafletLoaded = true; resolve() }
    script.onerror = reject
    document.head.appendChild(script)
  })
}

export default function MapaLocaisProximos({ lat, lng, titulo }) {
  const mapRef = useRef(null)
  const mapInstRef = useRef(null)
  const markersRef = useRef([])
  const [raio, setRaio] = useState(1000)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState(null)
  const [contadores, setContadores] = useState({})
  const [catAtivas, setCatAtivas] = useState(new Set(CATEGORIAS.map(c => c.id)))

  // Inicializar mapa
  useEffect(() => {
    let isMounted = true
    ensureLeaflet().then(() => {
      if (!isMounted || !mapRef.current || mapInstRef.current) return
      const L = window.L
      const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false, scrollWheelZoom: false }).setView([lat, lng], 15)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)
      // Marcador do imóvel
      L.marker([lat, lng], {
        icon: L.divIcon({
          html: '<div style="background:#002B80;color:#fff;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid #05A86D;box-shadow:0 2px 8px rgba(0,0,0,0.3)">🏠</div>',
          className: '', iconSize: [36, 36], iconAnchor: [18, 18],
        })
      }).addTo(map).bindPopup(`<b>${titulo || 'Imóvel'}</b><br>Lat: ${lat}, Lng: ${lng}`)
      mapInstRef.current = map
    }).catch(() => {})
    return () => { isMounted = false }
  }, [lat, lng, titulo])

  // Buscar dados Overpass ao mudar raio
  useEffect(() => {
    if (!mapInstRef.current) return
    const L = window.L
    if (!L) return
    // Limpar marcadores anteriores
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
    setContadores({})
    setErro(null)
    setLoading(true)

    const query = buildOverpassQuery(lat, lng, raio)
    const url = 'https://overpass-api.de/api/interpreter'
    fetch(url, { method: 'POST', body: query })
      .then(r => r.json())
      .then(data => {
        const counts = {}
        const map = mapInstRef.current
        ;(data.elements || []).forEach(el => {
          const cat = catFromEl(el)
          if (!cat) return
          counts[cat] = (counts[cat] || 0) + 1
          const elLat = el.lat ?? el.center?.lat
          const elLng = el.lon ?? el.center?.lon
          if (!elLat || !elLng) return
          const info = CATEGORIAS.find(c => c.id === cat)
          if (!info) return
          const name = el.tags?.name || info.label
          const marker = L.marker([elLat, elLng], {
            icon: L.divIcon({
              html: `<div style="background:${info.cor};color:#fff;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 1px 4px rgba(0,0,0,0.25)">${info.icon}</div>`,
              className: '', iconSize: [26, 26], iconAnchor: [13, 13],
            })
          }).bindPopup(`<b>${info.icon} ${name}</b>`)
          marker._catId = cat
          marker.addTo(map)
          markersRef.current.push(marker)
        })
        setContadores(counts)
        setLoading(false)
      })
      .catch(() => { setErro('Falha ao consultar Overpass API.'); setLoading(false) })
  }, [raio, lat, lng])

  // Filtrar marcadores por categoria ativa
  useEffect(() => {
    const L = window.L
    if (!L || !mapInstRef.current) return
    markersRef.current.forEach(m => {
      if (catAtivas.has(m._catId)) m.addTo(mapInstRef.current)
      else m.remove()
    })
  }, [catAtivas])

  const toggleCat = (id) => setCatAtivas(prev => {
    const n = new Set(prev)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })

  const totalLocais = Object.values(contadores).reduce((a, b) => a + b, 0)

  return (
    <div style={{ border: '1px solid #E8E6DF', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
      {/* Header */}
      <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid #E8E6DF', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#002B80' }}>📍 Locais próximos</div>
          {!loading && totalLocais > 0 && <div style={{ fontSize: 11, color: '#8E8EA0', marginTop: 2 }}>{totalLocais} locais encontrados num raio de {raio >= 1000 ? `${raio/1000}km` : `${raio}m`}</div>}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {RAIOS.map(r => (
            <button key={r} onClick={() => setRaio(r)}
              style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #E8E6DF', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: raio === r ? '#002B80' : '#F4F3EF', color: raio === r ? '#fff' : '#555' }}>
              {r >= 1000 ? `${r/1000}km` : `${r}m`}
            </button>
          ))}
        </div>
      </div>

      {/* Mapa */}
      <div ref={mapRef} style={{ height: 340, width: '100%', position: 'relative' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, fontSize: 13, color: '#002B80', fontWeight: 600 }}>
            Buscando locais próximos...
          </div>
        )}
        {erro && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, fontSize: 12, color: '#E5484D' }}>
            {erro}
          </div>
        )}
      </div>

      {/* Legenda / filtros por categoria */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid #E8E6DF', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {CATEGORIAS.map(c => {
          const ativa = catAtivas.has(c.id)
          const count = contadores[c.id] || 0
          return (
            <button key={c.id} onClick={() => toggleCat(c.id)}
              title={c.label}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 6, border: `1px solid ${ativa ? c.cor : '#D1D5DB'}`, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                background: ativa ? `${c.cor}15` : '#F9FAFB', color: ativa ? c.cor : '#9CA3AF', transition: 'all 0.15s' }}>
              <span>{c.icon}</span>
              <span>{c.label}</span>
              {count > 0 && <span style={{ background: ativa ? c.cor : '#E5E7EB', color: ativa ? '#fff' : '#9CA3AF', borderRadius: 4, padding: '0 5px', fontSize: 10 }}>{count}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
