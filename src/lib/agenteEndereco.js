/**
 * AXIS — Agente de Endereço
 * 
 * Geocoding e normalização de endereço via:
 * 1. ViaCEP (normalização CEP)
 * 2. BrasilAPI CEP v2 (coordenadas)
 * 3. Nominatim OSM (geocoding completo — fallback)
 */

const VIACEP_BASE   = 'https://viacep.com.br/ws'
const BRASILAPI_CEP = 'https://brasilapi.com.br/api/cep/v2'
const NOMINATIM     = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT    = 'AxisIP/1.0 (contato@axisip.com.br)'

/**
 * Busca dados do CEP com fallback automático
 */
export async function consultarCEP(cep) {
  const c = cep.replace(/\D/g, '')
  if (c.length !== 8) return null

  // Tenta BrasilAPI primeiro (tem lat/lng)
  try {
    const res = await fetch(`${BRASILAPI_CEP}/${c}`, {
      signal: AbortSignal.timeout(5000)
    })
    if (res.ok) {
      const data = await res.json()
      return {
        cep: data.cep,
        logradouro: data.street,
        bairro: data.neighborhood,
        cidade: data.city,
        estado: data.state,
        lat: data.location?.coordinates?.latitude || null,
        lng: data.location?.coordinates?.longitude || null,
        fonte: 'brasilapi',
      }
    }
  } catch (e) { /* fallback */ }

  // ViaCEP fallback (sem coords)
  try {
    const res = await fetch(`${VIACEP_BASE}/${c}/json/`, {
      signal: AbortSignal.timeout(5000)
    })
    if (res.ok) {
      const data = await res.json()
      if (data.erro) return null
      return {
        cep: data.cep,
        logradouro: data.logradouro,
        bairro: data.bairro,
        cidade: data.localidade,
        estado: data.uf,
        lat: null,
        lng: null,
        fonte: 'viacep',
      }
    }
  } catch (e) { /* sem dados */ }

  return null
}

/**
 * Geocoding de endereço livre via Nominatim OSM
 * IMPORTANTE: máx. 1 req/s na instância pública. Usar com cache.
 */
export async function geocodificarEndereco(endereco, cidade = 'Belo Horizonte', estado = 'MG') {
  const query = encodeURIComponent(`${endereco}, ${cidade}, ${estado}, Brasil`)
  try {
    const res = await fetch(
      `${NOMINATIM}?format=jsonv2&q=${query}&limit=1&countrycodes=br`,
      {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(8000),
      }
    )
    if (!res.ok) return null
    const data = await res.json()
    const hit = data?.[0]
    if (!hit) return null
    return {
      lat: parseFloat(hit.lat),
      lng: parseFloat(hit.lon),
      display_name: hit.display_name,
      tipo: hit.type,
      confianca: parseFloat(hit.importance || 0),
      fonte: 'nominatim_osm',
    }
  } catch (e) {
    console.warn('[AXIS Endereço] Nominatim falhou:', e.message)
    return null
  }
}

/**
 * Verifica se endereço do banco bate com CEP fornecido
 */
export async function validarEndereco(enderecoBanco, cep) {
  if (!cep) return { valido: null, motivo: 'CEP não fornecido' }
  const dadosCEP = await consultarCEP(cep)
  if (!dadosCEP) return { valido: null, motivo: 'CEP não encontrado' }
  
  const endNorm = (enderecoBanco || '').toLowerCase()
  const bairroNorm = (dadosCEP.bairro || '').toLowerCase()
  
  const bairroOk = endNorm.includes(bairroNorm.split(' ')[0]) ||
                   bairroNorm.includes(endNorm.split(',')[0].toLowerCase().trim())
  
  return {
    valido: bairroOk,
    bairro_cep: dadosCEP.bairro,
    cidade_cep: dadosCEP.cidade,
    lat: dadosCEP.lat,
    lng: dadosCEP.lng,
    motivo: bairroOk ? 'Bairro confirmado pelo CEP' : `Bairro no banco vs CEP: "${dadosCEP.bairro}"`,
  }
}
