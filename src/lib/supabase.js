// AXIS v2.0 — Supabase Client
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[AXIS] Supabase nÃ£o configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.')
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
  const { data, error } = await supabase
    .from('profiles').select('*').eq('id', userId).single()
  if (error) throw error
  return data
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
  try {
    const { data, error } = await supabase
      .from('app_settings').select('valor').eq('chave', chave).single()
    if (error) return null
    return data?.valor || null
  } catch { return null }
}

export async function getAppSettings() {
  try {
    const { data, error } = await supabase
      .from('app_settings').select('chave, valor, descricao')
    if (error) return {}
    return Object.fromEntries((data || []).map(r => [r.chave, r]))
  } catch { return {} }
}

export async function setAppSetting(chave, valor, userId) {
  const { error } = await supabase.from('app_settings').upsert({
    chave, valor,
    atualizado_por: userId,
    atualizado_em: new Date().toISOString()
  })
  if (error) throw error
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
