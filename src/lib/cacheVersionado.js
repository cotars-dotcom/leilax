/**
 * AXIS — Cache Versionado para Dados de Mercado e IA
 *
 * O cache existente (`cache_mercado`, `arremates_busca_cache` etc) tem TTL mas
 * NÃO tem proteção contra mismatch de schema entre deploys. Se o formato do
 * objeto `dados` mudar (ex: campo `liquidez` virar `liquidez_score`), entradas
 * antigas são servidas como válidas e quebram o consumidor.
 *
 * Este módulo adiciona:
 *   1. NAMESPACE por versão de schema — cada chave inclui `v{N}_` no prefixo.
 *      Ao bumpar SCHEMA_VERSION, todas as entradas antigas são automaticamente
 *      ignoradas (mas ainda lidas para limpeza assíncrona).
 *   2. TTL OBRIGATÓRIO por TIPO de dado — definido em CACHE_TTL.
 *   3. VALIDADOR pós-leitura — função opcional que confirma que o objeto
 *      cacheado tem os campos esperados; se faltar campo, descarta o cache.
 */

import { supabase } from './supabase.js'

// ─── VERSIONAMENTO DE SCHEMA ─────────────────────────────────────────────

/**
 * Bumpe este número sempre que o formato do objeto cacheado mudar incompativelmente.
 * Sprints recentes fizeram mudanças que justificariam bump:
 *   v1: schema original
 *   v2: sprint 41c — adicionou _dados_bairro_axis
 *   v3: sprint 41d — adicionou yield_liquido_pct + fatores reais do banco
 */
export const SCHEMA_VERSION = 3

// ─── TTL POR TIPO DE DADO ────────────────────────────────────────────────

/**
 * TTL em milissegundos por categoria de cache. Tipos com dados que mudam
 * rapidamente (mercado, ofertas) têm TTL curto; tipos estáveis (matrícula,
 * dados cadastrais) podem viver mais.
 */
export const CACHE_TTL = {
  mercado_geral:        72 * 3600_000,   // 3 dias — preço de mercado por bairro
  mercado_premium:     168 * 3600_000,   // 7 dias — bairros estáveis (Savassi, Lourdes...)
  arremates_busca:     168 * 3600_000,   // 7 dias — leilões similares já encerrados não mudam
  avaliacao_judicial:  720 * 3600_000,   // 30 dias — laudo judicial é estável
  matricula:            24 * 3600_000,   // 1 dia — averbações novas podem aparecer
  ocr_documento:       720 * 3600_000,   // 30 dias — texto extraído não muda enquanto for o mesmo arquivo
  bairro_metricas:     168 * 3600_000,   // 7 dias — métricas de bairro são reagregadas semanalmente
}

// ─── HELPERS PRINCIPAIS ──────────────────────────────────────────────────

/**
 * Constrói chave de cache versionada.
 * @param {string} tipo — categoria do cache (deve existir em CACHE_TTL)
 * @param {string} sufixo — identificador único (ex: URL hashed, código AXIS)
 */
export function buildCacheKey(tipo, sufixo) {
  return `v${SCHEMA_VERSION}_${tipo}_${sufixo}`
}

/**
 * Lê do cache aplicando TTL e validação de schema.
 *
 * @param {string} chave — chave completa (use buildCacheKey)
 * @param {string} tipo — categoria (define TTL)
 * @param {Function} validador — opcional. Recebe `dados`, retorna true se OK.
 * @returns {Promise<Object|null>} dados se válidos, null caso contrário
 */
export async function lerCache(chave, tipo, validador = null) {
  if (!CACHE_TTL[tipo]) {
    console.warn(`[AXIS Cache] Tipo desconhecido: ${tipo}`)
    return null
  }
  // Garantir que a chave contém a versão correta
  if (!chave.startsWith(`v${SCHEMA_VERSION}_`)) {
    return null  // chave de versão antiga, força miss
  }
  try {
    const { data: cached } = await supabase
      .from('cache_mercado')
      .select('dados, atualizado_em, schema_version')
      .eq('chave', chave)
      .maybeSingle()

    if (!cached) return null
    // Schema check explícito (pode haver chave 'v3_' mas linha gravada na v2)
    if (cached.schema_version != null && cached.schema_version !== SCHEMA_VERSION) return null
    // TTL check
    const idadeMs = Date.now() - new Date(cached.atualizado_em).getTime()
    if (idadeMs > CACHE_TTL[tipo]) return null
    // Validação de schema customizada
    if (validador && !validador(cached.dados)) {
      console.debug('[AXIS Cache] Validador rejeitou:', chave)
      return null
    }
    return cached.dados
  } catch (e) {
    console.warn('[AXIS Cache] Leitura falhou:', e.message)
    return null
  }
}

/**
 * Grava no cache com versão de schema explícita.
 *
 * @param {string} chave — use buildCacheKey
 * @param {Object} dados — objeto a cachear
 * @param {Object} opts — { ttlMs?: number } para sobrescrever TTL padrão
 */
export async function gravarCache(chave, dados, opts = {}) {
  const expiraEm = new Date(Date.now() + (opts.ttlMs ?? 72 * 3600_000)).toISOString()
  try {
    await supabase.from('cache_mercado').upsert({
      chave,
      dados,
      schema_version: SCHEMA_VERSION,
      atualizado_em: new Date().toISOString(),
      expira_em: expiraEm,
    }, { onConflict: 'chave' })
  } catch (e) {
    console.warn('[AXIS Cache] Gravação falhou:', e.message)
  }
}

/**
 * Limpeza assíncrona de entries antigas (versão != atual ou expiradas).
 * Roda em background, não bloqueia. Pode ser chamado periodicamente
 * (ex: 1x por dia em ação admin).
 */
export async function limparCacheObsoleto() {
  try {
    const agora = new Date().toISOString()
    // Apaga: schema_version diferente OU expira_em < agora
    const { count, error } = await supabase
      .from('cache_mercado')
      .delete({ count: 'exact' })
      .or(`schema_version.neq.${SCHEMA_VERSION},expira_em.lt.${agora}`)
    if (error) throw error
    console.info(`[AXIS Cache] Limpeza removeu ${count || 0} entradas`)
    return count || 0
  } catch (e) {
    console.warn('[AXIS Cache] Limpeza falhou:', e.message)
    return 0
  }
}

// ─── VALIDADORES PRÉ-DEFINIDOS ───────────────────────────────────────────

/**
 * Valida que um cache de mercado tem os campos mínimos do schema atual.
 */
export function validarMercado(dados) {
  if (!dados || typeof dados !== 'object') return false
  // Campos mínimos esperados na v3
  return (
    typeof dados.bairro === 'string' &&
    (typeof dados.preco_m2_mercado === 'number' || typeof dados.preco_contrato_m2 === 'number')
  )
}

/**
 * Valida cache de arremates similares.
 */
export function validarArremates(dados) {
  if (!dados || typeof dados !== 'object') return false
  return Array.isArray(dados.arremates) && dados.arremates.length >= 0
}

/**
 * Valida cache de OCR.
 */
export function validarOCR(dados) {
  if (!dados || typeof dados !== 'object') return false
  // OCR deve sempre ter pelo menos `texto` extraído ou `tipo_documento`
  return (typeof dados.texto === 'string' && dados.texto.length > 50) ||
         typeof dados.tipo_documento === 'string'
}
