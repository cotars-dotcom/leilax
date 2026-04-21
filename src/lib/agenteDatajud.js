/**
 * AXIS — Agente Datajud CNJ
 * 
 * Consulta processos judiciais via API pública do CNJ (Datajud).
 * Gratuito · Requer POST com Elasticsearch DSL
 * 
 * Docs: https://datajud-wiki.cnj.jus.br/api-publica/acesso/
 * Endpoint TJMG: https://api-publica.datajud.cnj.jus.br/api_publica_tjmg/_search
 * 
 * Chave pública (válida abr/2026 — verificar rotação):
 * cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==
 */

const DATAJUD_BASE = 'https://api-publica.datajud.cnj.jus.br'
const DATAJUD_KEY  = import.meta.env.VITE_DATAJUD_KEY || 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw=='

// Mapeamento tribunal → endpoint
const TRIBUNAL_ENDPOINT = {
  TJMG: '/api_publica_tjmg/_search',
  TRT3: '/api_publica_trt3/_search',   // TRT 3ª Região (MG)
  TJSP: '/api_publica_tjsp/_search',
  STJ:  '/api_publica_stj/_search',
}

/**
 * Extrai o tribunal do número CNJ (posição 15-17)
 * Ex: "5067894-90.2023.8.13.0024" → campo [4] = "8" → Justiça Estadual → "13" = MG → TJMG
 */
function detectarTribunal(numeroProcesso) {
  if (!numeroProcesso) return null
  // Formato CNJ: NNNNNNN-DD.AAAA.J.TT.OOOO
  const partes = numeroProcesso.replace(/\D/g, '')
  if (partes.length < 15) return null
  const j = partes[7]   // ramo da justiça (posição 8)
  const tt = partes.slice(8, 10) // tribunal (posições 9-10)
  if (j === '8' && tt === '13') return 'TJMG'
  if (j === '5' && tt === '03') return 'TRT3'
  if (j === '8' && tt === '26') return 'TJSP'
  return 'TJMG' // fallback MG
}

/**
 * Consulta processo por número CNJ
 * @param {string} numeroProcesso - Número no formato CNJ
 * @returns {Promise<Object>} Dados do processo ou null
 */
export async function consultarProcesso(numeroProcesso) {
  if (!numeroProcesso || numeroProcesso.includes('0000000-00')) return null

  const tribunal = detectarTribunal(numeroProcesso)
  const endpoint = TRIBUNAL_ENDPOINT[tribunal] || TRIBUNAL_ENDPOINT.TJMG

  try {
    const res = await fetch(`${DATAJUD_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `APIKey ${DATAJUD_KEY}`,
      },
      body: JSON.stringify({
        size: 1,
        query: {
          match: { numeroProcesso: numeroProcesso.replace(/\D/g, '').replace(/(\d{7})(\d{2})(\d{4})(\d{1})(\d{2})(\d{4})/, '$1-$2.$3.$4.$5.$6') }
        }
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      if (res.status === 401) throw new Error('Chave Datajud expirada — verificar wiki.cnj.jus.br')
      throw new Error(`Datajud HTTP ${res.status}`)
    }

    const data = await res.json()
    const hit = data?.hits?.hits?.[0]?._source
    if (!hit) return { encontrado: false, tribunal, numeroProcesso }

    // Extrair movimentos relevantes: hasta pública, arrematação, penhora, extinção
    const movRelevantes = (hit.movimentos || [])
      .filter(m => {
        const nome = (m.nome || m.codigo || '').toLowerCase()
        return nome.includes('hasta') || nome.includes('arrematação') ||
               nome.includes('penhora') || nome.includes('extinção') ||
               nome.includes('remição') || nome.includes('suspensão')
      })
      .sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora))
      .slice(0, 5)
      .map(m => ({
        data: m.dataHora ? new Date(m.dataHora).toLocaleDateString('pt-BR') : '—',
        nome: m.nome || `Código ${m.codigo}`,
      }))

    return {
      encontrado: true,
      tribunal,
      numeroProcesso: hit.numeroProcesso,
      classe: hit.classe?.nome || '—',
      assuntos: (hit.assuntos || []).map(a => a.nome).join(', ') || '—',
      orgaoJulgador: hit.orgaoJulgador?.nome || '—',
      dataAjuizamento: hit.dataAjuizamento
        ? new Date(hit.dataAjuizamento).toLocaleDateString('pt-BR') : '—',
      ultimaAtualizacao: hit.dataHoraUltimaAtualizacao
        ? new Date(hit.dataHoraUltimaAtualizacao).toLocaleDateString('pt-BR') : '—',
      grau: hit.grau || '—',
      movimentosRelevantes: movRelevantes,
      situacao: movRelevantes[0]?.nome || 'Em andamento',
      url_datajud: `https://www.cnj.jus.br/inteiroTeor/${numeroProcesso.replace(/\D/g, '')}`,
    }
  } catch (e) {
    console.warn('[AXIS Datajud]', e.message)
    return { erro: e.message, tribunal, numeroProcesso }
  }
}

/**
 * Normaliza número de processo para formato CNJ padrão
 * Aceita: "5067894-90.2023.8.13.0024" ou "50678949020238130024"
 */
export function normalizarNumeroCNJ(num) {
  if (!num) return null
  const d = num.replace(/\D/g, '')
  if (d.length !== 20) return num
  return `${d.slice(0,7)}-${d.slice(7,9)}.${d.slice(9,13)}.${d.slice(13,14)}.${d.slice(14,16)}.${d.slice(16,20)}`
}
