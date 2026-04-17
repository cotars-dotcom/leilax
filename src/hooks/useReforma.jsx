/**
 * AXIS — useReforma: Context centralizado de reforma
 *
 * Resolve o problema de 3 painéis com seletores de reforma independentes.
 * Agora o cenário de reforma (basica/media/completa) e o escopo detalhado
 * (6 opções SINAPI) são compartilhados entre:
 *   - PainelRentabilidade
 *   - PainelLancamento
 *   - CenariosReforma
 *
 * O provider deve envolver os 3 painéis no Detail.jsx.
 *
 * Fonte de verdade dos custos: reformaUnificada.js
 *   → Banco (custo_reforma_basica/media/completa) como primário
 *   → SINAPI-MG 2026 como fallback
 */
import { createContext, useContext, useState, useMemo } from 'react'
import {
  calcularReformas3Cenarios,
  calcularCustoReformaSINAPI,
  fatorValorizacao,
  CUSTO_M2_SINAPI,
  MAPA_SIMPLIFICADO,
  detectarClasse,
} from '../lib/reformaUnificada.js'

const ReformaContext = createContext(null)

// Mapeamento inverso: escopo detalhado → cenário simplificado
const ESCOPO_PARA_CENARIO = {
  sem_reforma:              'basica',
  refresh_giro:             'basica',
  leve_funcional:           'basica',
  leve_reforcada_1_molhado: 'media',
  media:                    'media',
  pesada:                   'completa',
}

// Mapeamento: cenário simplificado → escopo detalhado padrão
const CENARIO_PARA_ESCOPO = {
  basica:   'refresh_giro',
  media:    'leve_reforcada_1_molhado',
  completa: 'pesada',
}

export function ReformaProvider({ imovel, children }) {
  const [cenarioSimplificado, setCenarioSimplificado] = useState('media')
  const [escopoDetalhado, setEscopoDetalhado] = useState('leve_reforcada_1_molhado')
  
  // ─── Sprint 18: Lance de estudo global ───────────────────────────
  const _eMercado = imovel?.tipo_transacao === 'mercado_direto' || (imovel?.fonte_url || '').includes('zapimoveis') || (imovel?.fonte_url || '').includes('vivareal')
  const _avaliacao = parseFloat(imovel?.valor_avaliacao) || parseFloat(imovel?.valor_minimo) || 0
  const _lance2p = Math.round(_avaliacao * 0.50)
  const _lance1p = parseFloat(imovel?.valor_minimo || imovel?.preco_pedido) || 0
  const _lanceDefault = _eMercado ? _lance1p : (_lance2p > 0 ? _lance2p : _lance1p)
  const [lanceEstudo, setLanceEstudo] = useState(_lanceDefault)

  // Dados do imóvel
  const area = parseFloat(imovel?.area_privativa_m2 || imovel?.area_m2) || 80
  const preco_m2 = parseFloat(imovel?.preco_m2_mercado) || 7000
  const classe = detectarClasse(preco_m2)

  // Valores do banco (fonte primária)
  const valoresBanco = useMemo(() => ({
    custo_reforma_basica:   imovel?.custo_reforma_basica,
    custo_reforma_media:    imovel?.custo_reforma_media,
    custo_reforma_completa: imovel?.custo_reforma_completa,
  }), [imovel?.custo_reforma_basica, imovel?.custo_reforma_media, imovel?.custo_reforma_completa])

  // 3 custos unificados (banco → SINAPI fallback)
  const reformas = useMemo(
    () => calcularReformas3Cenarios(area, preco_m2, valoresBanco),
    [area, preco_m2, valoresBanco]
  )

  // Custo atual baseado no cenário simplificado selecionado
  const custoReformaAtual = reformas[cenarioSimplificado]

  // Custo detalhado (para CenariosReforma): direto do SINAPI por escopo
  const custoEscopoDetalhado = useMemo(() => {
    const custoM2 = CUSTO_M2_SINAPI[escopoDetalhado]?.[classe] || 0
    return Math.round(area * custoM2)
  }, [escopoDetalhado, classe, area])

  // Fator de valorização para o cenário atual
  const fatorValor = fatorValorizacao(cenarioSimplificado)

  // Sincronizar: quando muda cenário simplificado → atualizar escopo
  const selecionarCenario = (cenario) => {
    setCenarioSimplificado(cenario)
    setEscopoDetalhado(CENARIO_PARA_ESCOPO[cenario] || 'leve_reforcada_1_molhado')
  }

  // Sincronizar: quando muda escopo detalhado → atualizar cenário
  const selecionarEscopo = (escopo) => {
    setEscopoDetalhado(escopo)
    setCenarioSimplificado(ESCOPO_PARA_CENARIO[escopo] || 'media')
  }

  const value = useMemo(() => ({
    // Estado
    cenarioSimplificado,
    escopoDetalhado,
    lanceEstudo,
    // Ações
    selecionarCenario,
    selecionarEscopo,
    setLanceEstudo,
    // Custos calculados
    reformas,            // { basica, media, completa }
    custoReformaAtual,   // valor do cenário selecionado
    custoEscopoDetalhado,
    fatorValor,
    // Dados derivados
    area,
    preco_m2,
    classe,
    valoresBanco,
  }), [cenarioSimplificado, escopoDetalhado, lanceEstudo, reformas, custoReformaAtual, custoEscopoDetalhado, fatorValor, area, preco_m2, classe, valoresBanco])

  return (
    <ReformaContext.Provider value={value}>
      {children}
    </ReformaContext.Provider>
  )
}

export function useReforma() {
  const ctx = useContext(ReformaContext)
  if (!ctx) {
    // Fallback: fora do provider (ex: card preview), retornar defaults
    console.warn('[useReforma] Usado fora do ReformaProvider — usando defaults')
    return {
      cenarioSimplificado: 'media',
      escopoDetalhado: 'leve_reforcada_1_molhado',
      lanceEstudo: 0,
      selecionarCenario: () => {},
      selecionarEscopo: () => {},
      setLanceEstudo: () => {},
      reformas: { basica: 0, media: 0, completa: 0 },
      custoReformaAtual: 0,
      custoEscopoDetalhado: 0,
      fatorValor: 1.12,
      area: 80,
      preco_m2: 7000,
      classe: 'C_intermediario',
      valoresBanco: {},
    }
  }
  return ctx
}

export default useReforma
