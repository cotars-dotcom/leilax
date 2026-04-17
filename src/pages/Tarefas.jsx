import { useState, useEffect, useRef, useCallback } from 'react'
import { getTarefas, saveTarefa, updateTarefaStatus, deleteTarefa, getAllProfiles, getImoveis } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { C, btn, inp, card } from '../appConstants.js'

const COLS = [
  { id: 'pendente', label: 'Pendente', emoji: '⏳', color: '#D97706' },
  { id: 'em_andamento', label: 'Em Andamento', emoji: '▶️', color: '#05A86D' },
  { id: 'concluido', label: 'Concluído', emoji: '✅', color: '#16A34A' },
  { id: 'cancelado', label: 'Cancelado', emoji: '❌', color: '#E5484D' },
]
const PRIOS = [
  { id: 'baixa', label: 'Baixa', color: '#8E8EA0' },
  { id: 'normal', label: 'Normal', color: '#05A86D' },
  { id: 'alta', label: 'Alta', color: '#D97706' },
  { id: 'urgente', label: 'Urgente', color: '#E5484D' },
]

export default function Tarefas() {
  const isPhone = useIsMobile(480)
  const isMobile = useIsMobile(900)
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
  const [confirmDelete, setConfirmDelete] = useState(null)

  // Drag state
  const [dragId, setDragId] = useState(null)
  const [dragOverCol, setDragOverCol] = useState(null)
  const touchRef = useRef({ id: null, startY: 0, startX: 0, moved: false })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [t, p, im] = await Promise.all([
        getTarefas(profile?.id, profile?.role),
        getAllProfiles(),
        getImoveis().catch(() => []),
      ])
      setTarefas(t || [])
      setProfiles(p || [])
      setImoveis(im || [])
    } catch (e) { console.error('[Tarefas] load:', e) }
    setLoading(false)
  }

  function abrirModal(tarefa = null) {
    if (tarefa) {
      setEditando(tarefa.id)
      setForm({
        titulo: tarefa.titulo || '', descricao: tarefa.descricao || '',
        atribuido_para: tarefa.atribuido_para || '', prioridade: tarefa.prioridade || 'normal',
        prazo: tarefa.prazo ? tarefa.prazo.substring(0, 10) : '',
        status: tarefa.status || 'pendente', imovel_id: tarefa.imovel_id || '',
      })
    } else {
      setEditando(null)
      setForm({ titulo: '', descricao: '', atribuido_para: '', prioridade: 'normal', prazo: '', status: 'pendente', imovel_id: '' })
    }
    setShowModal(true)
  }

  async function handleSave(e) {
    if (e?.preventDefault) e.preventDefault()
    if (!form.titulo.trim()) return
    setSaving(true)
    try {
      const payload = { ...form, criado_por: profile?.id }
      if (!payload.imovel_id) delete payload.imovel_id
      if (!payload.prazo) delete payload.prazo
      if (editando) payload.id = editando
      await saveTarefa(payload)
      setShowModal(false)
      await load()
    } catch (er) { console.error('[Tarefas] save:', er) }
    setSaving(false)
  }

  async function handleDelete(id) {
    try {
      await deleteTarefa(id)
      setTarefas(prev => prev.filter(t => t.id !== id))
      setConfirmDelete(null)
    } catch (e) { console.error('[Tarefas] delete:', e) }
  }

  const moverTarefa = useCallback(async (id, novoStatus) => {
    try {
      await updateTarefaStatus(id, novoStatus)
      setTarefas(prev => prev.map(t => t.id === id ? { ...t, status: novoStatus } : t))
    } catch (e) { console.error('[Tarefas] move:', e) }
  }, [])

  // ── HTML5 Drag (desktop) ──
  function onDragStart(e, id) {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }
  function onDragOver(e, colId) {
    e.preventDefault()
    setDragOverCol(colId)
  }
  function onDragLeave() { setDragOverCol(null) }
  function onDrop(e, colId) {
    e.preventDefault()
    setDragOverCol(null)
    const id = e.dataTransfer.getData('text/plain') || dragId
    if (id) moverTarefa(id, colId)
    setDragId(null)
  }
  function onDragEnd() { setDragId(null); setDragOverCol(null) }

  // ── Touch Drag (mobile) ──
  function onTouchStart(e, id) {
    const touch = e.touches[0]
    touchRef.current = { id, startX: touch.clientX, startY: touch.clientY, moved: false }
  }
  function onTouchMove(e) {
    if (!touchRef.current.id) return
    const touch = e.touches[0]
    const dx = Math.abs(touch.clientX - touchRef.current.startX)
    const dy = Math.abs(touch.clientY - touchRef.current.startY)
    if (dx > 15 || dy > 15) touchRef.current.moved = true
    // Highlight column under finger
    const el = document.elementFromPoint(touch.clientX, touch.clientY)
    const colEl = el?.closest('[data-col-id]')
    setDragOverCol(colEl?.dataset.colId || null)
  }
  function onTouchEnd() {
    const { id, moved } = touchRef.current
    if (id && moved && dragOverCol) {
      moverTarefa(id, dragOverCol)
    }
    touchRef.current = { id: null, startX: 0, startY: 0, moved: false }
    setDragOverCol(null)
  }

  const tarefasFiltradas = filtroMembro === 'todos' ? tarefas
    : tarefas.filter(t => t.atribuido_para === filtroMembro || t.criado_por === filtroMembro)

  const getNome = (id) => {
    const p = profiles.find(x => x.id === id)
    return p?.nome || p?.email?.split('@')[0] || '—'
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.emerald }}>⏳ Carregando...</div>

  return (
    <div style={{ minHeight: '100%', background: C.offwhite }}
      onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>

      {/* Header */}
      <div style={{ padding: isPhone ? '14px 16px' : '18px 28px', borderBottom: `1px solid ${C.borderW}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
        background: C.white }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, color: C.navy }}>📋 Tarefas</div>
          <div style={{ fontSize: 11, color: C.muted }}>{tarefas.length} tarefa{tarefas.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {isAdmin && profiles.length > 1 && (
            <select value={filtroMembro} onChange={e => setFiltroMembro(e.target.value)}
              style={{ ...inp(), width: 'auto', padding: '6px 10px', fontSize: 12 }}>
              <option value="todos">Todos</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.nome || p.email}</option>)}
            </select>
          )}
          <button onClick={() => abrirModal()} style={{
            background: C.emerald, color: '#fff', border: 'none', borderRadius: 8,
            padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            + Nova
          </button>
        </div>
      </div>

      {/* Kanban */}
      <div style={{ padding: isPhone ? 12 : '16px 24px', display: 'flex', gap: 12,
        overflowX: 'auto', WebkitOverflowScrolling: 'touch', minHeight: 'calc(100vh - 140px)',
        paddingBottom: isMobile ? 80 : 16 }}>
        {COLS.map(col => {
          const items = tarefasFiltradas.filter(t => t.status === col.id)
          const isOver = dragOverCol === col.id
          return (
            <div key={col.id} data-col-id={col.id}
              onDragOver={e => onDragOver(e, col.id)} onDragLeave={onDragLeave}
              onDrop={e => onDrop(e, col.id)}
              style={{
                flex: '0 0 260px', minWidth: 260, maxWidth: 300,
                background: isOver ? `${col.color}12` : C.surface,
                border: `1.5px solid ${isOver ? col.color : C.borderW}`,
                borderRadius: 12, padding: '12px 10px',
                transition: 'all .2s', display: 'flex', flexDirection: 'column',
              }}>
              {/* Column header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: 10, padding: '0 4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14 }}>{col.emoji}</span>
                  <span style={{ fontWeight: 700, fontSize: 12, color: col.color }}>{col.label}</span>
                </div>
                <span style={{ background: `${col.color}18`, color: col.color, borderRadius: 10,
                  padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>{items.length}</span>
              </div>

              {/* Cards */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {items.map(t => {
                  const prio = PRIOS.find(p => p.id === t.prioridade) || PRIOS[1]
                  const imAssoc = t.imovel_id ? imoveis.find(im => im.id === t.imovel_id) : null
                  const isDragging = dragId === t.id
                  return (
                    <div key={t.id}
                      draggable
                      onDragStart={e => onDragStart(e, t.id)}
                      onDragEnd={onDragEnd}
                      onTouchStart={e => onTouchStart(e, t.id)}
                      style={{
                        background: isDragging ? `${prio.color}08` : C.white,
                        border: `1px solid ${isDragging ? prio.color : C.borderW}`,
                        borderLeft: `3px solid ${prio.color}`,
                        borderRadius: 8, padding: '10px 10px 8px', cursor: 'grab',
                        opacity: isDragging ? 0.6 : 1,
                        transition: 'all .15s', userSelect: 'none',
                        WebkitUserSelect: 'none',
                      }}>
                      {/* Title + priority */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4, marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.navy, flex: 1, lineHeight: 1.3 }}>{t.titulo}</span>
                        <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                          background: `${prio.color}15`, color: prio.color, flexShrink: 0, whiteSpace: 'nowrap' }}>
                          {prio.label}
                        </span>
                      </div>
                      {/* Description */}
                      {t.descricao && (
                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 5, lineHeight: 1.4,
                          maxHeight: 36, overflow: 'hidden' }}>
                          {t.descricao.substring(0, 80)}{t.descricao.length > 80 ? '...' : ''}
                        </div>
                      )}
                      {/* Imóvel associado */}
                      {imAssoc && (
                        <div style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, marginBottom: 5,
                          background: '#F0F4FF', border: '1px solid #C7D4F820', color: C.navy,
                          display: 'flex', gap: 3, alignItems: 'center', overflow: 'hidden' }}>
                          🏠 <strong>{imAssoc.codigo_axis || ''}</strong>
                          <span style={{ color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {(imAssoc.titulo || '').substring(0, 25)}
                          </span>
                        </div>
                      )}
                      {/* Footer: assignee + date + actions */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <div style={{ fontSize: 10, color: C.hint, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {t.atribuido_para && <span>👤 {getNome(t.atribuido_para)}</span>}
                          {t.prazo && (
                            <span style={{
                              color: new Date(t.prazo) < new Date() && t.status !== 'concluido' ? '#E5484D' : C.hint
                            }}>
                              🗓 {new Date(t.prazo).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={e => { e.stopPropagation(); abrirModal(t) }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12,
                              padding: '2px 4px', borderRadius: 4, color: C.muted }}
                            title="Editar">✏️</button>
                          <button onClick={e => { e.stopPropagation(); setConfirmDelete(t.id) }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12,
                              padding: '2px 4px', borderRadius: 4, color: '#E5484D' }}
                            title="Excluir">🗑</button>
                        </div>
                      </div>
                      {/* Move buttons (mobile fallback) */}
                      {isPhone && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                          {COLS.filter(c => c.id !== t.status).map(c => (
                            <button key={c.id}
                              onClick={e => { e.stopPropagation(); moverTarefa(t.id, c.id) }}
                              style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, cursor: 'pointer',
                                background: `${c.color}10`, border: `1px solid ${c.color}30`, color: c.color }}>
                              → {c.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
                {items.length === 0 && (
                  <div style={{ padding: 20, textAlign: 'center', color: C.hint, fontSize: 11 }}>
                    {isPhone ? 'Vazio' : 'Arraste tarefas aqui'}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Confirm delete */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: 16 }}>
          <div style={{ background: C.white, borderRadius: 12, padding: 24, maxWidth: 340, width: '100%',
            textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🗑</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.navy, marginBottom: 8 }}>Excluir tarefa?</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>Esta ação não pode ser desfeita.</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setConfirmDelete(null)}
                style={{ ...btn('s'), padding: '8px 20px', fontSize: 13 }}>Cancelar</button>
              <button onClick={() => handleDelete(confirmDelete)}
                style={{ background: '#E5484D', color: '#fff', border: 'none', borderRadius: 8,
                  padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal criar/editar */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: C.white, border: `1px solid ${C.borderW}`, borderRadius: 14,
            padding: isPhone ? 20 : 28, width: '90vw', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: C.navy }}>
                {editando ? '✏️ Editar Tarefa' : '+ Nova Tarefa'}
              </div>
              <button onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: C.muted }}>✕</button>
            </div>
            <div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: C.hint, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .5 }}>Título *</div>
                <input style={inp()} value={form.titulo}
                  onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                  placeholder="O que precisa ser feito?" autoFocus />
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: C.hint, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .5 }}>Descrição</div>
                <textarea style={{ ...inp(), height: 70, resize: 'vertical' }} value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Detalhes..." />
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: C.hint, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .5 }}>🏠 Imóvel (opcional)</div>
                <select style={inp()} value={form.imovel_id}
                  onChange={e => setForm(f => ({ ...f, imovel_id: e.target.value }))}>
                  <option value="">Nenhum</option>
                  {imoveis.slice(0, 50).map(im => (
                    <option key={im.id} value={im.id}>
                      {im.codigo_axis || '—'} · {(im.titulo || '').substring(0, 35)}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 11, color: C.hint, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .5 }}>Responsável</div>
                  <select style={inp()} value={form.atribuido_para}
                    onChange={e => setForm(f => ({ ...f, atribuido_para: e.target.value }))}>
                    <option value="">—</option>
                    {profiles.map(p => <option key={p.id} value={p.id}>{p.nome || p.email}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: C.hint, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .5 }}>Prioridade</div>
                  <select style={inp()} value={form.prioridade}
                    onChange={e => setForm(f => ({ ...f, prioridade: e.target.value }))}>
                    {PRIOS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 11, color: C.hint, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .5 }}>Prazo</div>
                  <input style={inp()} type="date" value={form.prazo}
                    onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))} />
                </div>
                {editando && (
                  <div>
                    <div style={{ fontSize: 11, color: C.hint, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .5 }}>Status</div>
                    <select style={inp()} value={form.status}
                      onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                      {COLS.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)}
                  style={{ ...btn('s'), fontSize: 13 }}>Cancelar</button>
                <button onClick={handleSave} disabled={saving || !form.titulo.trim()}
                  style={{ background: saving ? C.muted : C.emerald, color: '#fff', border: 'none',
                    borderRadius: 8, padding: '9px 20px', fontWeight: 700, cursor: saving ? 'default' : 'pointer',
                    fontSize: 13, opacity: saving ? 0.7 : 1 }}>
                  {saving ? '⏳' : editando ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
