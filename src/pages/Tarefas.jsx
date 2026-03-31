import { useState, useEffect } from 'react'
import { getTarefas, saveTarefa, updateTarefaStatus, getAllProfiles, getImoveis } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { C, K, btn, inp, card } from '../appConstants.js'

const COLS = [
  { id: 'pendente', label: 'Pendente', emoji: '⏳', color: C.mustard },
  { id: 'em_andamento', label: 'Em Andamento', emoji: '▶', color: C.emerald },
  { id: 'concluido', label: 'Concluído', emoji: '✅', color: '#16A34A' },
  { id: 'cancelado', label: 'Cancelado', emoji: '❌', color: '#E5484D' },
]

const PRIOS = [
  { id: 'baixa', label: 'Baixa', color: C.hint },
  { id: 'normal', label: 'Normal', color: C.emerald },
  { id: 'alta', label: 'Alta', color: C.mustard },
  { id: 'urgente', label: 'Urgente', color: '#E5484D' },
]

export default function Tarefas() {
  const isPhone = useIsMobile(480)
  const { profile, isAdmin } = useAuth()
  const [tarefas, setTarefas] = useState([])
  const [profiles, setProfiles] = useState([])
  const [imoveis, setImoveis] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [filtroMembro, setFiltroMembro] = useState('todos')
  const [form, setForm] = useState({ titulo: '', descricao: '', atribuido_para: '', prioridade: 'normal', prazo: '', status: 'pendente', imovel_id: '' })
  const [saving, setSaving] = useState(false)
  const [dragOverCol, setDragOverCol] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [t, p, im] = await Promise.all([
        getTarefas(profile?.id, profile?.role),
        getAllProfiles(),
        getImoveis(),
      ])
      setTarefas(t)
      setProfiles(p)
      setImoveis(im || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  function abrirModal(tarefa = null) {
    if (tarefa) {
      setEditando(tarefa.id)
      setForm({
        titulo: tarefa.titulo || '',
        descricao: tarefa.descricao || '',
        atribuido_para: tarefa.atribuido_para || '',
        prioridade: tarefa.prioridade || 'normal',
        prazo: tarefa.prazo ? tarefa.prazo.substring(0, 10) : '',
        status: tarefa.status || 'pendente',
        imovel_id: tarefa.imovel_id || '',
      })
    } else {
      setEditando(null)
      setForm({ titulo: '', descricao: '', atribuido_para: '', prioridade: 'normal', prazo: '', status: 'pendente', imovel_id: '' })
    }
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.titulo) return
    setSaving(true)
    try {
      const payload = { ...form, criado_por: profile?.id }
      if (!payload.imovel_id) delete payload.imovel_id
      if (editando) payload.id = editando
      await saveTarefa(payload)
      setShowModal(false)
      await load()
    } catch (er) { console.error(er) }
    setSaving(false)
  }

  async function moverTarefa(id, novoStatus) {
    try {
      await updateTarefaStatus(id, novoStatus)
      setTarefas(prev => prev.map(t => t.id === id ? { ...t, status: novoStatus } : t))
    } catch (e) { console.error(e) }
  }

  // Drag & drop handlers
  function handleDragStart(e, tarefaId) {
    e.dataTransfer.setData('text/plain', tarefaId)
    e.dataTransfer.effectAllowed = 'move'
  }
  function handleDragOver(e, colId) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverCol(colId)
  }
  function handleDragLeave() { setDragOverCol(null) }
  function handleDrop(e, colId) {
    e.preventDefault()
    setDragOverCol(null)
    const tarefaId = e.dataTransfer.getData('text/plain')
    if (tarefaId) moverTarefa(tarefaId, colId)
  }

  const tarefasFiltradas = filtroMembro === 'todos' ? tarefas : tarefas.filter(t => t.atribuido_para === filtroMembro || t.criado_por === filtroMembro)

  if (loading) return <div style={{ color: C.emerald, padding: 40, textAlign: 'center' }}>⏳ Carregando tarefas...</div>

  return (
    <div style={{ minHeight: '100%', background: C.bg }}>
      {/* Header */}
      <div style={{ padding: isPhone ? '16px' : '22px 28px 16px', borderBottom: `1px solid ${C.borderW}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 19, color: C.navy }}>✅ Tarefas</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {isAdmin && (
            <select value={filtroMembro} onChange={e => setFiltroMembro(e.target.value)} style={{ ...inp(), width: 'auto', padding: '7px 10px' }}>
              <option value="todos">Todos os membros</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.nome || p.email}</option>)}
            </select>
          )}
          <button onClick={() => abrirModal()} style={{ background: C.emerald, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Nova Tarefa</button>
        </div>
      </div>

      {/* Kanban board */}
      <div style={{ padding: isPhone ? 16 : '20px 28px', display: 'grid', gridTemplateColumns: isPhone ? 'repeat(4,minmax(240px,1fr))' : 'repeat(4,1fr)', gap: isPhone ? 12 : 16, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {COLS.map(col => {
          const items = tarefasFiltradas.filter(t => t.status === col.id)
          const isDragOver = dragOverCol === col.id
          return (
            <div key={col.id}
              onDragOver={e => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, col.id)}
              style={{
                background: isDragOver ? `${col.color}10` : C.white,
                border: `1px solid ${isDragOver ? col.color : C.borderW}`,
                borderRadius: 12, padding: 14, minHeight: 400,
                transition: 'all .2s',
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: col.color }}>{col.emoji} {col.label}</span>
                <span style={{ background: `${col.color}20`, color: col.color, borderRadius: 12, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{items.length}</span>
              </div>
              {items.map(t => {
                const prio = PRIOS.find(p => p.id === t.prioridade) || PRIOS[1]
                const atrib = profiles.find(p => p.id === t.atribuido_para)
                const imovelAssociado = t.imovel_id ? imoveis.find(im => im.id === t.imovel_id) : null
                return (
                  <div key={t.id} draggable onDragStart={e => handleDragStart(e, t.id)}
                    onClick={() => abrirModal(t)}
                    style={{ ...card(), padding: 12, marginBottom: 8, cursor: 'grab', borderLeft: `3px solid ${prio.color}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: C.navy, flex: 1, paddingRight: 8 }}>{t.titulo}</div>
                      <span style={{ background: `${prio.color}20`, color: prio.color, borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>{prio.label}</span>
                    </div>
                    {t.descricao && <div style={{ fontSize: 12, color: C.muted, marginBottom: 6, lineHeight: 1.5 }}>{t.descricao.substring(0, 80)}{t.descricao.length > 80 ? '...' : ''}</div>}
                    {/* Imóvel associado */}
                    {imovelAssociado && (
                      <div style={{ fontSize: 10, padding: '3px 6px', borderRadius: 4, background: '#F0F4FF', border: '1px solid #C7D4F820', color: C.navy, marginBottom: 6, display: 'flex', gap: 4, alignItems: 'center' }}>
                        🏠 <span style={{ fontWeight: 600 }}>{imovelAssociado.codigo_axis || ''}</span>
                        <span style={{ color: C.muted }}>{(imovelAssociado.titulo || '').substring(0, 30)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 11, color: C.hint }}>
                        {atrib && <span>👤 {atrib.nome || atrib.email}</span>}
                        {t.prazo && <span style={{ marginLeft: 8 }}>🗓 {new Date(t.prazo).toLocaleDateString('pt-BR')}</span>}
                      </div>
                      <select onChange={e => { e.stopPropagation(); moverTarefa(t.id, e.target.value) }} value={t.status}
                        onClick={e => e.stopPropagation()}
                        style={{ background: C.surface, border: `1px solid ${C.borderW}`, borderRadius: 6, padding: '3px 6px', color: C.muted, fontSize: 11, cursor: 'pointer', outline: 'none' }}>
                        {COLS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Modal criar/editar */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: isPhone ? 16 : 0 }}>
          <div style={{ background: C.white, border: `1px solid ${C.borderW}`, borderRadius: 14, padding: isPhone ? 20 : 28, width: '90vw', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: C.navy, marginBottom: 20 }}>
              {editando ? '✏️ Editar Tarefa' : '+ Nova Tarefa'}
            </div>
            <form onSubmit={handleSave}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: C.hint, marginBottom: 5, textTransform: 'uppercase' }}>Título *</div>
                <input style={inp()} value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Título da tarefa" />
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: C.hint, marginBottom: 5, textTransform: 'uppercase' }}>Descrição</div>
                <textarea style={{ ...inp(), height: 80, resize: 'vertical' }} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Detalhes..." />
              </div>
              {/* Imóvel associado */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: C.hint, marginBottom: 5, textTransform: 'uppercase' }}>🏠 Associar a Imóvel (opcional)</div>
                <select style={inp()} value={form.imovel_id} onChange={e => setForm(f => ({ ...f, imovel_id: e.target.value }))}>
                  <option value="">Nenhum imóvel</option>
                  {imoveis.slice(0, 50).map(im => (
                    <option key={im.id} value={im.id}>{im.codigo_axis || '—'} · {(im.titulo || 'Sem título').substring(0, 40)}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 11, color: C.hint, marginBottom: 5, textTransform: 'uppercase' }}>Atribuir para</div>
                  <select style={inp()} value={form.atribuido_para} onChange={e => setForm(f => ({ ...f, atribuido_para: e.target.value }))}>
                    <option value="">Selecionar...</option>
                    {profiles.map(p => <option key={p.id} value={p.id}>{p.nome || p.email}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: C.hint, marginBottom: 5, textTransform: 'uppercase' }}>Prioridade</div>
                  <select style={inp()} value={form.prioridade} onChange={e => setForm(f => ({ ...f, prioridade: e.target.value }))}>
                    {PRIOS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 11, color: C.hint, marginBottom: 5, textTransform: 'uppercase' }}>Prazo</div>
                  <input style={inp()} type="date" value={form.prazo} onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))} />
                </div>
                {editando && (
                  <div>
                    <div style={{ fontSize: 11, color: C.hint, marginBottom: 5, textTransform: 'uppercase' }}>Status</div>
                    <select style={inp()} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                      {COLS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ ...btn('s'), fontSize: 13 }}>Cancelar</button>
                <button type="submit" disabled={saving} style={{ background: C.emerald, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                  {saving ? 'Salvando...' : editando ? 'Atualizar' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
