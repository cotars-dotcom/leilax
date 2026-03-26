// AXIS v2.0 — Supabase Client
import { createClient } from '@supabase/supabase-js'

// Cache simples em memória para reduzir chamadas redundantes
const _cache = {}
const CACHE_TTL = 30000 // 30 segundos
async function cachedQuery(key, queryFn) {
  const now = Date.now()
  if (_cache[key] && (now - _cache[key].ts) < CACHE_TTL) {
    return _cache[key].data
  }
  const data = await queryFn()
  _cache[key] = { data, ts: now }
  return data
}
export function invalidarCache(key) {
  if (key) delete _cache[key]
  else Object.keys(_cache).forEach(k => delete _cache[k])
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[AXIS] Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.')
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
)

// == AUTH ==
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) return null
    return data?.session ?? null
  } catch { return null }
}

// == PROFILES ==
export async function getProfile(userId) {
  return cachedQuery(`profile_${userId}`, async () => {
    const { data, error } = await supabase
      .from('profiles').select('*').eq('id', userId).single()
    if (error) throw error
    return data
  })
}

export async function getAllProfiles() {
  const { data, error } = await supabase
    .from('profiles').select('*').order('criado_em')
  if (error) throw error
  return data || []
}

export async function updateProfile(id, updates) {
  const { error } = await supabase.from('profiles').update(updates).eq('id', id)
  if (error) throw error
  invalidarCache(`profile_${id}`)
}

// == IMOVEIS ==
export async function getImoveis() {
  const { data, error } = await supabase
    .from('imoveis').select('*').order('criado_em', { ascending: false })
  if (error) throw error
  return data || []
}

export async function saveImovel(imovel, userId) {
  const { data, error } = await supabase
    .from('imoveis')
    .upsert({ ...imovel, criado_por: userId, atualizado_em: new Date().toISOString() })
    .select().single()
  if (error) throw error
  return data
}

// Colunas conhecidas da tabela imoveis — tudo fora disso é descartado
const IMOVEIS_COLS = new Set([
  'id','titulo','endereco','cidade','estado','bairro','tipo','tipologia',
  'area_privativa_m2','area_coberta_privativa_m2','area_descoberta_privativa_m2',
  'area_total_m2','area_real_total_m2','area_usada_calculo_m2','area_usada_label',
  'area_m2','quartos','suites','vagas','andar','andares_unidade','elevador',
  'padrao_acabamento','vaga_tipo','condominio_mensal',
  'modalidade_leilao','processo_numero','leiloeiro','data_leilao','num_leilao',
  'valor_avaliacao','valor_minimo','valor_lance_atual',
  'ocupacao','ocupacao_fonte','financiavel','fgts_aceito',
  'debitos_condominio','debitos_iptu','responsabilidade_debitos','responsabilidade_fonte',
  'processos_ativos','matricula_status','obs_juridicas',
  'preco_m2_imovel','preco_m2_mercado','preco_m2_fonte',
  'valor_mercado_estimado','desconto_percentual','desconto_sobre_mercado_pct',
  'gap_preco_asking_closing_pct','preco_m2_asking_bairro','preco_m2_closing_bairro','classe_ipead',
  'itbi_pct','comissao_leiloeiro_pct',
  'custo_reforma_calculado','custo_reforma_previsto','custo_reforma_estimado',
  'custo_total_aquisicao','custo_juridico_estimado','custo_regularizacao',
  'aluguel_mensal_estimado',
  'escopo_reforma','prazo_reforma_meses','valor_pos_reforma_estimado',
  'indice_sobrecapitalizacao','alerta_sobrecap','classe_mercado_reforma',
  'liquidez','prazo_revenda_meses',
  'mercado_tendencia','mercado_tendencia_pct_12m','mercado_demanda',
  'mercado_tempo_venda_meses','mercado_obs','yield_bruto_pct',
  'score_localizacao','score_desconto','score_juridico',
  'score_ocupacao','score_liquidez','score_mercado','score_total',
  'modalidade','riscos_presentes','prazo_liberacao_estimado_meses',
  'reclassificado_por_doc','historico_juridico','score_juridico_manual',
  'recomendacao','justificativa','positivos','negativos','alertas',
  'estrategia_recomendada','estrategia_recomendada_detalhe','estrutura_recomendada',
  'retorno_venda_pct','retorno_locacao_anual_pct',
  'fotos','foto_principal','fonte_url',
  'codigo_axis','criado_em','atualizado_em','criado_por',
  'status','status_operacional',
  'motivo_arquivamento','arquivado_por','arquivado_em',
  'trello_card_id','trello_card_url','trello_list_id','trello_sincronizado_em',
  'analise_dupla_ia','comparaveis','sintese_executiva',
  'edital_dados','rgi_dados','debitos_dados',
  'vara_judicial','tipo_justica',
])

export async function saveImovelCompleto(imovel, userId) {
  // Filtrar apenas colunas que existem na tabela
  const payload = {}
  for (const [k, v] of Object.entries(imovel)) {
    if (IMOVEIS_COLS.has(k)) payload[k] = v
  }
  // Mapear campo legado url → fonte_url
  if (!payload.fonte_url && imovel.url) payload.fonte_url = imovel.url
  // Garantir campos obrigatórios
  if (!payload.id) payload.id = crypto.randomUUID()
  if (userId) payload.criado_por = userId
  payload.atualizado_em = new Date().toISOString()
  if (!payload.status_operacional) payload.status_operacional = 'ativo'

  console.log('[AXIS Supabase] Salvando imóvel:', payload.id, payload.titulo || '(sem título)')
  const { data, error } = await supabase
    .from('imoveis')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single()
  if (error) {
    console.error('[AXIS Supabase] ERRO ao salvar:', error.code, error.message, error.details)
    throw error
  }
  console.log('[AXIS Supabase] Salvo com sucesso:', data.id, data.codigo_axis)
  return data
}

export async function deleteImovel(id) {
  const { error } = await supabase.from('imoveis').delete().eq('id', id)
  if (error) throw error
}

export async function updateImovelStatus(id, status) {
  const { error } = await supabase
    .from('imoveis')
    .update({ status, atualizado_em: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// == PARAMETROS DE SCORE ==
export async function getParametros() {
  const { data, error } = await supabase
    .from('parametros_score').select('*').eq('ativo', true).order('ordem')
  if (error) throw error
  return data || []
}
export const getParametrosScore = getParametros

export async function saveParametro(param) {
  const { data, error } = await supabase
    .from('parametros_score').upsert(param).select().single()
  if (error) throw error
  return data
}
export const updateParametroScore = saveParametro

// == CRITERIOS ==
export async function getCriterios() {
  const { data, error } = await supabase
    .from('criterios_avaliacao').select('*').eq('ativo', true).order('categoria')
  if (error) throw error
  return data || []
}
export const getCriteriosAvaliacao = getCriterios

export async function saveCriterio(criterio) {
  const { data, error } = await supabase
    .from('criterios_avaliacao').upsert(criterio).select().single()
  if (error) throw error
  return data
}
export const saveCriterioAvaliacao = saveCriterio

// == AVALIACOES ==
export async function getAvaliacoes(imovelId) {
  const { data, error } = await supabase
    .from('avaliacoes_imovel')
    .select('*, criterio:criterios_avaliacao(*), avaliador:profiles(nome)')
    .eq('imovel_id', imovelId)
  if (error) throw error
  return data || []
}
export const getAvaliacoesImovel = getAvaliacoes

export async function saveAvaliacao(av) {
  const { data, error } = await supabase
    .from('avaliacoes_imovel').upsert(av).select().single()
  if (error) throw error
  return data
}
export const saveAvaliacaoImovel = saveAvaliacao

// == TAREFAS ==
export async function getTarefas(userId, role) {
  let q = supabase
    .from('tarefas')
    .select('*, atribuido:profiles!tarefas_atribuido_para_fkey(nome), criador:profiles!tarefas_criado_por_fkey(nome)')
    .order('criado_em', { ascending: false })
  if (role && role !== 'admin' && userId) {
    q = q.or(`atribuido_para.eq.${userId},criado_por.eq.${userId}`)
  }
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function saveTarefa(t) {
  const { data, error } = await supabase
    .from('tarefas')
    .upsert({ ...t, atualizado_em: new Date().toISOString() })
    .select().single()
  if (error) throw error
  return data
}

export async function updateTarefaStatus(id, status) {
  const { error } = await supabase
    .from('tarefas')
    .update({ status, atualizado_em: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
export const updateTarefa = updateTarefaStatus

export async function deleteTarefa(id) {
  const { error } = await supabase.from('tarefas').delete().eq('id', id)
  if (error) throw error
}

// == OBSERVACOES ==
export async function getObservacoes(imovelId) {
  const { data, error } = await supabase
    .from('observacoes')
    .select('*, autor:profiles(nome)')
    .eq('imovel_id', imovelId)
    .order('criado_em', { ascending: false })
  if (error) throw error
  return data || []
}

export async function saveObservacao(obs) {
  const { data, error } = await supabase
    .from('observacoes').insert(obs).select().single()
  if (error) throw error
  return data
}

// == APP SETTINGS (API KEYS) ==
export async function getAppSetting(chave) {
  return cachedQuery(`app_setting_${chave}`, async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings').select('valor').eq('chave', chave).single()
      if (error) return null
      return data?.valor || null
    } catch { return null }
  })
}

export async function getAppSettings() {
  return cachedQuery('app_settings', async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings').select('chave, valor, descricao')
      if (error) return {}
      return Object.fromEntries((data || []).map(r => [r.chave, r]))
    } catch { return {} }
  })
}

export async function setAppSetting(chave, valor, userId) {
  const { error } = await supabase.from('app_settings').upsert({
    chave, valor,
    atualizado_por: userId,
    atualizado_em: new Date().toISOString()
  })
  if (error) throw error
  invalidarCache(`app_setting_${chave}`)
  invalidarCache('app_settings')
}

// == API KEYS POR USUÁRIO (cross-device sync) ==
export async function loadApiKeys(userId) {
  try {
    const { data } = await supabase
      .from('app_settings')
      .select('valor')
      .eq('chave', `api_keys_${userId}`)
      .single()
    if (data?.valor) {
      const keys = JSON.parse(data.valor)
      return { claudeKey: keys.claude || '', openaiKey: keys.openai || '' }
    }
  } catch {}
  return { claudeKey: '', openaiKey: '' }
}

export async function persistApiKeys(userId, { claudeKey, openaiKey }) {
  try {
    await supabase.from('app_settings').upsert({
      chave: `api_keys_${userId}`,
      valor: JSON.stringify({ claude: claudeKey, openai: openaiKey }),
      atualizado_em: new Date().toISOString()
    }, { onConflict: 'chave' })
  } catch(e) { console.warn('[AXIS] persistApiKeys:', e.message) }
}


// == CONVITES ==
export async function criarConvite(email, nome, role, adminId) {
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36)
  const { error } = await supabase.from('convites').insert({
    email: email.trim().toLowerCase(),
    nome: nome.trim(),
    role,
    token,
    criado_por: adminId,
    expira_em: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  })
  if (error) throw error
  return token
}

export async function getConvites() {
  const { data, error } = await supabase
    .from('convites').select('*').order('criado_em', { ascending: false })
  if (error) throw error
  return data || []
}

export async function validarConvite(token) {
  try {
    const { data } = await supabase
      .from('convites').select('*').eq('token', token).eq('usado', false).single()
    if (!data || new Date(data.expira_em) < new Date()) return null
    return data
  } catch { return null }
}

export async function usarConvite(token) {
  await supabase.from('convites')
    .update({ usado: true, usado_em: new Date().toISOString() })
    .eq('token', token)
}

export async function revogarConvite(id) {
  const { error } = await supabase
    .from('convites')
    .update({ expira_em: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function getUsuarios() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('criado_em', { ascending: false })
  if (error) throw error
  return data || []
}

export async function atualizarRoleUsuario(userId, novoRole) {
  const { error } = await supabase
    .from('profiles')
    .update({ role: novoRole, atualizado_em: new Date().toISOString() })
    .eq('id', userId)
  if (error) throw error
}

export async function toggleAtivoUsuario(userId, ativo) {
  const { error } = await supabase
    .from('profiles')
    .update({ ativo, atualizado_em: new Date().toISOString() })
    .eq('id', userId)
  if (error) throw error
}

// == ATIVIDADES ==
export async function getAtividades() {
  const { data, error } = await supabase
    .from('atividades')
    .select('*, usuario:profiles(nome)')
    .order('criado_em', { ascending: false })
    .limit(200)
  if (error) throw error
  return data || []
}

export async function logAtividade(userId, acao, entidade, entidadeId, detalhes) {
  try {
    await supabase.from('atividades').insert({
      usuario_id: userId, acao, entidade,
      entidade_id: entidadeId, detalhes
    })
  } catch {}
}

// == MERCADO REGIONAL ==
export async function getMercadoRegional() {
  const { data, error } = await supabase
    .from('mercado_regional')
    .select('*')
    .order('cidade')
  if (error) throw error
  return data || []
}

export async function getMercadoPorRegiao(regiaoKey) {
  const { data, error } = await supabase
    .from('mercado_regional')
    .select('*')
    .eq('regiao_key', regiaoKey)
    .single()
  if (error) return null
  return data
}

export async function updateMercadoRegional(regiaoKey, updates) {
  const { error } = await supabase
    .from('mercado_regional')
    .update({ ...updates, atualizado_em: new Date().toISOString() })
    .eq('regiao_key', regiaoKey)
  if (error) throw error
}

// == RISCOS JURÍDICOS ==
export async function getRiscosJuridicos() {
  const { data, error } = await supabase
    .from('riscos_juridicos').select('*').order('risco_nota', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getRiscosImovel(imovelId) {
  const { data, error } = await supabase
    .from('riscos_imovel')
    .select('*, risco:riscos_juridicos(*)')
    .eq('imovel_id', imovelId)
  if (error) throw error
  return data || []
}

export async function addRiscoImovel(imovelId, riscoId, dados) {
  const { data, error } = await supabase
    .from('riscos_imovel')
    .upsert({ imovel_id: imovelId, risco_id: riscoId, ...dados })
    .select().single()
  if (error) throw error
  return data
}

// == REFORMA ==
export async function getParametrosReforma() {
  const { data, error } = await supabase
    .from('parametros_reforma').select('*').order('faixa_venda_m2_min', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getPacotesReforma() {
  const { data, error } = await supabase
    .from('pacotes_reforma').select('*').order('custo_min')
  if (error) throw error
  return data || []
}

// == DOCUMENTOS JURÍDICOS ==
export async function getDocumentosJuridicos(imovelId) {
  const { data, error } = await supabase
    .from('documentos_juridicos')
    .select('*')
    .eq('imovel_id', imovelId)
    .order('criado_em', { ascending: false })
  if (error) throw error
  return data || []
}

export async function salvarDocumentoJuridico(doc) {
  const { data, error } = await supabase
    .from('documentos_juridicos')
    .insert(doc)
    .select().single()
  if (error) throw error
  return data
}

export async function reclassificarImovel(imovelId, novaAnalise, documentoId) {
  const { data: imovel } = await supabase
    .from('imoveis').select('historico_juridico, score_juridico, recomendacao')
    .eq('id', imovelId).single()

  const historico = imovel?.historico_juridico || []
  historico.push({
    data: new Date().toISOString(),
    doc_id: documentoId,
    score_anterior: imovel?.score_juridico,
    score_novo: novaAnalise.novo_score_juridico,
    recomendacao_anterior: imovel?.recomendacao,
    recomendacao_nova: novaAnalise.nova_recomendacao,
    parecer: novaAnalise.parecer_final
  })

  const updates = {
    historico_juridico: historico,
    reclassificado_por_doc: true,
    atualizado_em: new Date().toISOString()
  }
  if (novaAnalise.novo_score_juridico !== undefined)
    updates.score_juridico = novaAnalise.novo_score_juridico
  if (novaAnalise.nova_recomendacao)
    updates.recomendacao = novaAnalise.nova_recomendacao
  if (novaAnalise.processos_totais?.length)
    updates.processos_ativos = novaAnalise.processos_totais.join(', ')

  const { error } = await supabase
    .from('imoveis').update(updates).eq('id', imovelId)
  if (error) throw error
  return updates
}

// ── Arquivamento ───────────────────────────────────────────────
export async function arquivarImovel(imovelId, motivo, userId) {
  const { error } = await supabase
    .from('imoveis')
    .update({
      status_operacional: 'arquivado',
      motivo_arquivamento: motivo || 'Arquivado pelo usuário',
      arquivado_por: userId,
      arquivado_em: new Date().toISOString(),
      status: 'arquivado',
      atualizado_em: new Date().toISOString()
    })
    .eq('id', imovelId)
  if (error) throw error
}

export async function desarquivarImovel(imovelId) {
  const { error } = await supabase
    .from('imoveis')
    .update({
      status_operacional: 'ativo',
      motivo_arquivamento: null,
      arquivado_por: null,
      arquivado_em: null,
      status: 'analisado',
      atualizado_em: new Date().toISOString()
    })
    .eq('id', imovelId)
  if (error) throw error
}

export async function getImoveisAtivos() {
  const { data, error } = await supabase
    .from('imoveis')
    .select('*')
    .or('status_operacional.eq.ativo,status_operacional.is.null')
    .order('criado_em', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getBancoArquivados() {
  const { data, error } = await supabase
    .from('imoveis')
    .select('*')
    .eq('status_operacional', 'arquivado')
    .order('arquivado_em', { ascending: false })
  if (error) throw error
  return data || []
}

// ── Códigos e sincronização Trello ────────────────────────────────
export async function registrarTrelloCard(imovelId, cardId, cardUrl, listId, userId) {
  const { error } = await supabase
    .from('imoveis')
    .update({
      trello_card_id: cardId,
      trello_card_url: cardUrl,
      trello_list_id: listId,
      trello_sincronizado_em: new Date().toISOString(),
    })
    .eq('id', imovelId)
  if (error) throw error
  await supabase.from('trello_sync_log').insert({
    imovel_id: imovelId,
    trello_card_id: cardId,
    trello_list_id: listId,
    acao: 'criado',
    sincronizado_por: userId,
  }).catch(() => {})
}

export async function getImoveisComTrello() {
  const { data } = await supabase
    .from('imoveis')
    .select('id, codigo_axis, trello_card_id, trello_card_url, trello_list_id')
    .not('trello_card_id', 'is', null)
  return data || []
}

export async function updateTrelloCardId(imovelId, cardId, cardUrl, listId) {
  const { error } = await supabase
    .from('imoveis')
    .update({
      trello_card_id: cardId,
      trello_card_url: cardUrl,
      trello_list_id: listId,
      trello_sincronizado_em: new Date().toISOString(),
    })
    .eq('id', imovelId)
  if (error) throw error
}

export async function getImovelByCodigo(codigoAxis) {
  const { data } = await supabase
    .from('imoveis')
    .select('*')
    .eq('codigo_axis', codigoAxis)
    .single()
  return data
}

// ── Gerar código AXIS único por imóvel ────────────────────────────
export async function gerarAxisId(cidade) {
  const PREFIXOS = {
    'belo horizonte': 'BH', 'bh': 'BH',
    'contagem': 'CT', 'betim': 'BT',
    'juiz de fora': 'JF', 'nova lima': 'NL',
    'ribeirao das neves': 'RN',
    'santa luzia': 'SL', 'sabara': 'SB',
  }
  const norm = (cidade || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  const prefixo = Object.entries(PREFIXOS)
    .find(([k]) => norm.includes(k))?.[1] || 'MG'
  const ano = new Date().getFullYear()

  const { data } = await supabase
    .from('imoveis')
    .select('codigo_axis')
    .like('codigo_axis', `${prefixo}-${ano}-%`)
    .order('codigo_axis', { ascending: false })
    .limit(1)

  let seq = 1
  if (data?.[0]?.codigo_axis) {
    const n = parseInt(data[0].codigo_axis.split('-').pop(), 10)
    if (!isNaN(n)) seq = n + 1
  }
  return `${prefixo}-${ano}-${String(seq).padStart(4, '0')}`
}

// ── Verificar imóvel duplicado por URL ────────────────────────────
export async function verificarImovelDuplicado(url) {
  if (!url) return null
  const urlNorm = url.trim()
  const slug = urlNorm.split('/').filter(Boolean).pop() || ''
  const { data } = await supabase
    .from('imoveis')
    .select('id, codigo_axis, titulo, score_total, recomendacao, criado_em, fonte_url')
    .or(`fonte_url.eq.${urlNorm},fonte_url.ilike.%${slug}%`)
    .limit(3)
  return data?.length > 0 ? data : null
}

// ── Log de uso de chamadas de API ────────────────────────────────
export async function logUsoChamadaAPI({
  tipo, modelo, tokensInput = 0, tokensOutput = 0,
  imovelId = null, imovelTitulo = null, modoTeste = false, sucesso = true
}) {
  try {
    const PRECOS = {
      'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
      'claude-haiku-4-5-20251001': { input: 1.00, output: 5.00 },
      'gpt-4o': { input: 2.50, output: 10.00 },
    }
    const preco = PRECOS[modelo] || { input: 3.00, output: 15.00 }
    const custoUSD = (tokensInput / 1_000_000) * preco.input +
                     (tokensOutput / 1_000_000) * preco.output
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('api_usage_log').insert({
      user_id: user.id, tipo, modelo,
      tokens_input: tokensInput, tokens_output: tokensOutput,
      custo_usd: parseFloat(custoUSD.toFixed(6)),
      imovel_id: imovelId, imovel_titulo: imovelTitulo,
      modo_teste: modoTeste, sucesso,
    })
  } catch (e) {
    console.warn('[AXIS Log]', e.message)
  }
}

export async function getUsoChamadas({ dias = 30 } = {}) {
  try {
    const desde = new Date()
    desde.setDate(desde.getDate() - dias)
    const { data } = await supabase
      .from('api_usage_log')
      .select('*')
      .gte('criado_em', desde.toISOString())
      .order('criado_em', { ascending: false })
      .limit(500)
    return data || []
  } catch { return [] }
}
