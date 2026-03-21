import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')

// âââ AUTH ââââââââââââââââââââââââââââââââââââââââââââââ
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
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function createUserAdmin(email, password, nome, role = 'membro') {
  // Chama edge function ou signUp padrÃ£o (admin cria via Supabase Dashboard)
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  // Atualiza o perfil
  if (data.user) {
    await supabase.from('profiles').update({ nome, role }).eq('id', data.user.id)
  }
  return data
}

// âââ PROFILES ââââââââââââââââââââââââââââââââââââââââââ
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

export async function getAllProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('nome')
  if (error) throw error
  return data
}

export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

// âââ IMÃVEIS ââââââââââââââââââââââââââââââââââââââââââ
export async function getImoveis() {
  const { data, error } = await supabase
    .from('imoveis')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getImovel(id) {
  const { data, error } = await supabase
    .from('imoveis')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function saveImovel(imovel) {
  const { data, error } = await supabase
    .from('imoveis')
    .upsert(imovel)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteImovel(id) {
  const { error } = await supabase.from('imoveis').delete().eq('id', id)
  if (error) throw error
}

// âââ PARÃMETROS DE SCORE ââââââââââââââââââââââââââââââ
export async function getParametrosScore() {
  const { data, error } = await supabase
    .from('parametros_score')
    .select('*')
    .order('dimensao')
  if (error) throw error
  return data
}

export async function updateParametroScore(id, updates) {
  const { data, error } = await supabase
    .from('parametros_score')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// âââ CRITÃRIOS DE AVALIAÃÃO ââââââââââââââââââââââââââ
export async function getCriteriosAvaliacao() {
  const { data, error } = await supabase
    .from('criterios_avaliacao')
    .select('*')
    .eq('ativo', true)
    .order('nome')
  if (error) throw error
  return data
}

export async function saveCriterioAvaliacao(criterio) {
  const { data, error } = await supabase
    .from('criterios_avaliacao')
    .upsert(criterio)
    .select()
    .single()
  if (error) throw error
  return data
}

// âââ AVALIAÃÃES POR IMÃVEL ââââââââââââââââââââââââââ
export async function getAvaliacoesImovel(imovelId) {
  const { data, error } = await supabase
    .from('avaliacoes_imovel')
    .select('*, profiles(nome), criterios_avaliacao(nome)')
    .eq('imovel_id', imovelId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function saveAvaliacaoImovel(avaliacao) {
  const { data, error } = await supabase
    .from('avaliacoes_imovel')
    .upsert(avaliacao)
    .select()
    .single()
  if (error) throw error
  return data
}

// âââ TAREFAS ââââââââââââââââââââââââââââââââââââââââââ
export async function getTarefas() {
  const { data, error } = await supabase
    .from('tarefas')
    .select('*, profiles(nome)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function saveTarefa(tarefa) {
  const { data, error } = await supabase
    .from('tarefas')
    .upsert(tarefa)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateTarefa(id, updates) {
  const { data, error } = await supabase
    .from('tarefas')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteTarefa(id) {
  const { error } = await supabase.from('tarefas').delete().eq('id', id)
  if (error) throw error
}

// âââ OBSERVAÃÃES ââââââââââââââââââââââââââââââââââââââ
export async function getObservacoes(imovelId) {
  const { data, error } = await supabase
    .from('observacoes')
    .select('*, profiles(nome)')
    .eq('imovel_id', imovelId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function saveObservacao(obs) {
  const { data, error } = await supabase
    .from('observacoes')
    .insert(obs)
    .select()
    .single()
  if (error) throw error
  return data
}

// âââ APP SETTINGS (API Keys) ââââââââââââââââââââââââââ
export async function getAppSettings() {
  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .order('key')
  if (error) throw error
  return data
}

export async function getAppSetting(key) {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .single()
  if (error) return null
  return data?.value || null
}

export async function setAppSetting(key, value) {
  const { data, error } = await supabase
    .from('app_settings')
    .upsert({ key, value }, { onConflict: 'key' })
    .select()
    .single()
  if (error) throw error
  return data
}

// âââ LOG DE ATIVIDADES ââââââââââââââââââââââââââââââ
export async function getAtividades(limit = 50) {
  const { data, error } = await supabase
    .from('atividades')
    .select('*, profiles(nome)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export async function logAtividade(userId, acao, detalhes = '') {
  const { error } = await supabase
    .from('atividades')
    .insert({ user_id: userId, acao, detalhes })
  if (error) console.error('Erro ao logar atividade:', error)
}
