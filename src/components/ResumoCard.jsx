/**
 * AXIS — ResumoCard
 * Visão compacta e sem duplicatas do imóvel.
 * Substitui a aba resumo com seções colapsáveis.
 * Princípio: cada dado aparece UMA vez, no lugar certo.
 */

import React, { useState } from "react"
import { C, K, fmtC, recColor, normalizarTextoAlerta } from "../appConstants.js"
import { isMercadoDireto } from "../lib/detectarFonte.js"
import ScoreRadar from "./ScoreRadar.jsx"

function ScoreRingLocal({score, size=72}) {
  const pct = Math.min(100, Math.max(0, score * 10))
  const r = size * 0.38
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - pct / 100)
  const cor = pct >= 75 ? "#059669" : pct >= 55 ? "#D97706" : "#DC2626"
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E2E8F0" strokeWidth={size*0.08} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={cor} strokeWidth={size*0.08}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x={size/2} y={size/2+1} textAnchor="middle" dominantBaseline="middle"
        fontSize={size*0.22} fontWeight="800" fill={cor}>{Math.round(pct)}</text>
      <text x={size/2} y={size/2+size*0.22} textAnchor="middle"
        fontSize={size*0.1} fill="#94A3B8">/100</text>
    </svg>
  )
}

function Chip({ texto, cor = C.navy, bg = C.offwhite, borda = C.borderW }) {
  return (
    <span style={{
      fontSize: 11, padding: "3px 10px", borderRadius: 20,
      background: bg, border: `1px solid ${borda}`, color: cor, fontWeight: 600,
      display: "inline-block", margin: "2px 3px 2px 0",
    }}>{texto}</span>
  )
}

function Secao({ titulo, icone, children, defaultAberto = true }) {
  const [aberto, setAberto] = useState(defaultAberto)
  return (
    <div style={{ marginBottom: 8, border: `1px solid ${C.borderW}`, borderRadius: 10, overflow: "hidden" }}>
      <button onClick={() => setAberto(a => !a)}
        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "10px 14px", background: C.offwhite, border: "none", cursor: "pointer" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>{icone} {titulo}</span>
        <span style={{ fontSize: 10, color: C.muted }}>{aberto ? "▲" : "▼"}</span>
      </button>
      {aberto && <div style={{ padding: "12px 14px", background: C.white }}>{children}</div>}
    </div>
  )
}

function KpiRow({ label, valor, cor, sub }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline",
      padding: "5px 0", borderBottom: `1px solid ${C.offwhite}`, fontSize: 13 }}>
      <span style={{ color: C.muted }}>{label}</span>
      <div style={{ textAlign: "right" }}>
        <span style={{ fontWeight: 700, color: cor || C.navy }}>{valor}</span>
        {sub && <div style={{ fontSize: 10, color: C.muted }}>{sub}</div>}
      </div>
    </div>
  )
}

export default function ResumoCard({ p, isAdmin, isMobile, onUpdateProp }) {
  const [showRadar, setShowRadar] = useState(false)
  if (!p) return null

  const sc = parseFloat(p.score_total || 0)
  const rc = recColor(p.recomendacao)
  const eMercado = isMercadoDireto(p.fonte_url, p.tipo_transacao)
  const area = parseFloat(p.area_usada_calculo_m2 || p.area_privativa_m2 || p.area_m2 || 0)
  const mercado = parseFloat(p.valor_mercado_estimado || 0)
  const maoFlip = parseFloat(p.mao_flip || 0)
  const maoLoc = parseFloat(p.mao_locacao || 0)
  const aluguel = parseFloat(p.aluguel_mensal_estimado || 0)
  const debitos = p.responsabilidade_debitos === "arrematante" ? parseFloat(p.debitos_total_estimado || 0) : 0
  const hoje = Date.now()
  const d1 = p.data_leilao ? Math.ceil((new Date(p.data_leilao + "T12:00") - hoje) / 86400000) : null
  const d2 = p.data_leilao_2 ? Math.ceil((new Date(p.data_leilao_2 + "T12:00") - hoje) / 86400000) : null
  const lance2p = parseFloat(p.valor_minimo_2 || 0)
  const descontoPct = mercado > 0 && lance2p > 0 ? Math.round((1 - lance2p / mercado) * 100) : null

  // Estratégia de lance
  const estrategia = p.lance_maximo_estrategia
  const lanceDef = parseFloat(p.lance_maximo_definido || 0)

  // Veredicto simplificado
  const veredictoTexto = {
    COMPRAR:             "Boa oportunidade — vale participar",
    AGUARDAR:            "Espere a 2ª data para pagar menos",
    INVIAVEL:            "Preço acima do mercado — evitar",
    DADOS_INSUFICIENTES: "Informações incompletas para decidir",
  }[p.recomendacao] || p.recomendacao

  const alertas = (Array.isArray(p.alertas) ? p.alertas : [])
    .map(a => normalizarTextoAlerta(typeof a === "string" ? a : a?.texto || ""))
    .filter(Boolean)
    .filter(a => !a.includes("[INFO]"))
    .slice(0, 3)

  return (
    <div>
      {/* ── BLOCO 1: VEREDICTO + SCORE ─────────────────────── */}
      <div style={{ background: `${rc}12`, border: `1.5px solid ${rc}30`,
        borderRadius: 12, padding: "16px 18px", marginBottom: 10,
        display: "flex", gap: 16, alignItems: "flex-start" }}>
        {/* Score ring clicável para radar */}
        <div onClick={() => setShowRadar(r => !r)} style={{ cursor: "pointer", flexShrink: 0, textAlign: "center" }}>
          {sc > 0 ? (
            showRadar
              ? <ScoreRadar imovel={p} size={140} />
              : <><ScoreRingLocal score={sc} size={72} /><div style={{ fontSize: 8, color: C.muted, marginTop: 2 }}>ver radar ↗</div></>
          ) : (
            <div style={{ width: 72, height: 72, borderRadius: "50%", border: "2px dashed #D4D4D8",
              display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
              <div style={{ fontSize: 12, color: C.muted }}>N/A</div>
            </div>
          )}
        </div>

        {/* Recomendação + justificativa */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: K.t3, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>
            Recomendação
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: rc, lineHeight: 1 }}>
            {p.recomendacao || "—"}
          </div>
          <div style={{ fontSize: 12, color: K.t2, marginTop: 5, lineHeight: 1.5 }}>
            {veredictoTexto}
          </div>
          {p.justificativa && (
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4, fontStyle: "italic", lineHeight: 1.4 }}>
              "{p.justificativa.slice(0, 120)}{p.justificativa.length > 120 ? "..." : ""}"
            </div>
          )}
          {/* Chips de estado */}
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
            <Chip texto={p.ocupacao || "Ocupação?"} cor={p.ocupacao === "Desocupado" ? "#065F46" : "#991B1B"}
              bg={p.ocupacao === "Desocupado" ? "#ECFDF5" : "#FEF2F2"} borda={p.ocupacao === "Desocupado" ? "#6EE7B7" : "#FCA5A5"} />
            <Chip texto={p.financiavel ? "Financiável" : "Só à vista"} cor={p.financiavel ? "#185FA5" : "#5F5E5A"} />
            {!eMercado && p.praca && <Chip texto={`${p.praca}ª Praça`} cor={p.praca >= 2 ? "#92400E" : "#065F46"} />}
            {p.confidence_score && <Chip texto={`${p.confidence_score}% confiança`} cor="#534AB7" />}
          </div>
        </div>
      </div>

      {/* ── BLOCO 2: DATAS DO LEILÃO (só se leilão) ──────── */}
      {!eMercado && (d1 !== null || d2 !== null) && (
        <div style={{ display: "grid", gridTemplateColumns: d1 !== null && d2 !== null ? "1fr 1fr" : "1fr",
          gap: 8, marginBottom: 10 }}>
          {d1 !== null && d1 >= 0 && (
            <div style={{ background: C.offwhite, borderRadius: 8, padding: "10px 12px", border: `1px solid ${C.borderW}` }}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", marginBottom: 2 }}>1ª Praça</div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                {new Date(p.data_leilao + "T12:00").toLocaleDateString("pt-BR")}
              </div>
              <div style={{ fontSize: 12, color: K.amb, fontWeight: 700 }}>
                {d1 === 0 ? "HOJE!" : d1 === 1 ? "Amanhã" : `em ${d1} dias`}
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>{fmtC(p.valor_minimo)}</div>
            </div>
          )}
          {d2 !== null && d2 >= 0 && (
            <div style={{ background: d2 <= 7 ? "#FEF2F2" : "#FFFBEB",
              borderRadius: 8, padding: "10px 12px",
              border: `2px solid ${d2 <= 7 ? "#FCA5A5" : "#FDE68A"}` }}>
              <div style={{ fontSize: 10, color: "#92400E", textTransform: "uppercase", fontWeight: 700, marginBottom: 2 }}>
                ⭐ 2ª Praça — Melhor chance
              </div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                {new Date(p.data_leilao_2 + "T12:00").toLocaleDateString("pt-BR")}
              </div>
              <div style={{ fontSize: 12, color: d2 <= 7 ? "#DC2626" : "#D97706", fontWeight: 700 }}>
                {d2 === 0 ? "HOJE!" : d2 === 1 ? "Amanhã" : `em ${d2} dias`}
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>
                {fmtC(lance2p)}{descontoPct !== null ? ` · ${descontoPct}% abaixo do mercado` : ""}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── BLOCO 3: NÚMEROS ESSENCIAIS ───────────────────── */}
      <div style={{ background: C.white, border: `1px solid ${C.borderW}`, borderRadius: 10,
        padding: "12px 14px", marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase",
          letterSpacing: 0.5, marginBottom: 8 }}>Números essenciais</div>
        
        {mercado > 0 && <KpiRow label="Valor de mercado" valor={fmtC(mercado)} cor="#059669"
          sub={area > 0 && parseFloat(p.preco_m2_mercado) > 0 ? `R$${Math.round(parseFloat(p.preco_m2_mercado)).toLocaleString("pt-BR")}/m²` : null} />}
        
        {maoFlip > 0 && <KpiRow label="Lance máx. para revender (ROI 20%)" valor={fmtC(maoFlip)} cor={C.navy}
          sub={lance2p > 0 ? (lance2p <= maoFlip ? "✅ 2ª praça dentro do limite" : `⚠️ 2ª praça R$${(lance2p-maoFlip).toLocaleString("pt-BR")} acima`) : null} />}
        
        {maoLoc > 0 && <KpiRow label="Lance máx. para alugar (6% a.a.)" valor={fmtC(maoLoc)} cor="#7C3AED"
          sub={lance2p > 0 && lance2p <= maoLoc ? "✅ 2ª praça dentro do limite" : null} />}
        
        {aluguel > 0 && <KpiRow label="Aluguel estimado" valor={`${fmtC(aluguel)}/mês`} cor="#7C3AED"
          sub={`${parseFloat(p.yield_bruto_pct || 0).toFixed(1)}% a.a. bruto`} />}
        
        {debitos > 0 && <KpiRow label="Débitos (você paga)" valor={fmtC(debitos)} cor="#DC2626"
          sub="Condomínio + IPTU em atraso" />}
        
        {parseFloat(p.custo_juridico_estimado || 0) > 0 && (
          <KpiRow label="Custo jurídico estimado" valor={fmtC(p.custo_juridico_estimado)} cor="#D97706"
            sub="Advogado + imissão na posse" />
        )}
      </div>

      {/* ── BLOCO 4: LANCE DEFINIDO (se tiver) ───────────── */}
      {lanceDef > 0 && (
        <div style={{ background: "#F0FDF4", border: "2px solid #059669", borderRadius: 10,
          padding: "12px 14px", marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: "#065F46", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>
            🎯 Seu lance registrado
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#059669" }}>{fmtC(lanceDef)}</div>
          {estrategia && <div style={{ fontSize: 12, color: "#064E3B", marginTop: 2 }}>
            Estratégia: {estrategia === "flip" ? "🔄 Revenda" : estrategia === "locacao" ? "🏠 Aluguel" : "⚡ Misto"}
          </div>}
        </div>
      )}

      {/* ── BLOCO 5: SÍNTESE (colapsável) ────────────────── */}
      {p.sintese_executiva && (
        <Secao titulo="Síntese da análise" icone="🤖" defaultAberto={false}>
          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>
            {p.sintese_executiva}
          </div>
        </Secao>
      )}

      {/* ── BLOCO 6: ALERTAS (só críticos) ───────────────── */}
      {alertas.length > 0 && (
        <Secao titulo={`${alertas.length} alerta${alertas.length > 1 ? "s" : ""}`} icone="⚠️" defaultAberto={true}>
          {alertas.map((a, i) => (
            <div key={i} style={{ fontSize: 12, color: "#92400E", padding: "4px 0",
              borderBottom: i < alertas.length - 1 ? `1px solid ${C.offwhite}` : "none" }}>
              • {a}
            </div>
          ))}
        </Secao>
      )}

      {/* ── BLOCO 7: POSITIVOS/NEGATIVOS ─────────────────── */}
      {((Array.isArray(p.positivos) && p.positivos.length > 0) || (Array.isArray(p.negativos) && p.negativos.length > 0)) && (
        <Secao titulo="Pontos-chave" icone="📊" defaultAberto={false}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {Array.isArray(p.positivos) && p.positivos.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: "#059669", fontWeight: 700, marginBottom: 6 }}>✅ A favor</div>
                {p.positivos.slice(0, 3).map((t, i) => (
                  <div key={i} style={{ fontSize: 12, color: C.text, padding: "3px 0", lineHeight: 1.4 }}>+ {t}</div>
                ))}
              </div>
            )}
            {Array.isArray(p.negativos) && p.negativos.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: "#DC2626", fontWeight: 700, marginBottom: 6 }}>⚠️ Atenção</div>
                {p.negativos.slice(0, 3).map((t, i) => (
                  <div key={i} style={{ fontSize: 12, color: C.text, padding: "3px 0", lineHeight: 1.4 }}>− {t}</div>
                ))}
              </div>
            )}
          </div>
        </Secao>
      )}
    </div>
  )
}
