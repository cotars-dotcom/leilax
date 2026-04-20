import { useState } from "react"
import { C, RED, ESTRATEGIA_CONFIG } from "../appConstants.js"
import { isMercadoDireto } from '../lib/detectarFonte.js'
import {
  CUSTOS_LEILAO, CUSTOS_MERCADO, calcularFatorHomogeneizacao,
  IPTU_SOBRE_CONDO_RATIO, HOLDING_MESES_PADRAO, calcularLanceMaximoParaROI,
} from '../lib/constants.js'
import { useReforma } from '../hooks/useReforma.jsx'

export default function CalculadoraROI({ imovel }) {
  const [entrada, setEntrada] = useState(30)
  const [prazoVenda, setPrazoVenda] = useState(12)
  const [taxaJuros, setTaxaJuros] = useState(10.5)
  const [tabela, setTabela] = useState('price')
  const [estrategia, setEstrategia] = useState('flip')
  const [usarHomogeneizado, setUsarHomogeneizado] = useState(false)
  const { lanceEstudo, custoReformaAtual } = useReforma()
  const eMercado = isMercadoDireto(imovel.fonte_url, imovel.tipo_transacao)
  const precoAquisicao = lanceEstudo || (eMercado
    ? (parseFloat(imovel.preco_pedido) || parseFloat(imovel.valor_minimo) || 0)
    : (parseFloat(imovel.valor_minimo) || 0))
  if (precoAquisicao <= 0) {
    return <div style={{ padding: 16 }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: C.navy, marginBottom: 6 }}>💰 Calculadora de ROI</div>
      <div style={{ fontSize: 12, color: C.muted }}>Preço de aquisição não disponível — informe o valor para calcular.</div>
    </div>
  }
  const _tab = eMercado ? CUSTOS_MERCADO : CUSTOS_LEILAO
  const comissao    = precoAquisicao * ((imovel.comissao_leiloeiro_pct ?? _tab.comissao_leiloeiro_pct) / 100)
  const itbi        = precoAquisicao * ((imovel.itbi_pct ?? _tab.itbi_pct) / 100)
  const doc         = precoAquisicao * (_tab.documentacao_pct / 100)
  const reforma     = custoReformaAtual
  const advogado    = precoAquisicao * (_tab.advogado_pct / 100)
  const registro    = _tab.registro_fixo ?? 0
  const custoJuridico = parseFloat(imovel.custo_juridico_estimado || 0)
  const debitosArr  = imovel.responsabilidade_debitos === 'arrematante'
    ? parseFloat(imovel.debitos_total_estimado || 0) : 0
  // Holding: condomínio + IPTU estimado × meses padrão
  const condoMensal  = parseFloat(imovel.condominio_mensal || 0)
  const iptuMensal   = parseFloat(imovel.iptu_mensal || 0) || (condoMensal > 0 ? Math.round(condoMensal * IPTU_SOBRE_CONDO_RATIO) : 0)
  const holding      = HOLDING_MESES_PADRAO * (condoMensal + iptuMensal)
  const custoTotal   = precoAquisicao + comissao + itbi + doc + advogado + registro + reforma + custoJuridico + debitosArr + holding

  // Valor de mercado: bruto por padrão (sem double-counting da homogeneização)
  const vmercadoBruto = parseFloat(imovel.valor_mercado_estimado) || parseFloat(imovel.valor_pos_reforma_estimado)
    || (parseFloat(imovel.preco_m2_mercado) * (parseFloat(imovel.area_privativa_m2 || imovel.area_m2) || 0))
    || precoAquisicao * 1.4
  const homo = calcularFatorHomogeneizacao(imovel, vmercadoBruto)
  const vmercadoAjustado = homo.valorAjustado || vmercadoBruto
  const vmercado = usarHomogeneizado ? vmercadoAjustado : vmercadoBruto

  // Badge: valor ajustado acima da média do bairro
  const areaImovel = parseFloat(imovel.area_privativa_m2 || imovel.area_m2) || 1
  const precoM2Mercado = parseFloat(imovel.preco_m2_mercado) || 0
  const ajustadoAcimaDaMed = precoM2Mercado > 0 && (vmercadoAjustado / areaImovel) > precoM2Mercado * 1.10

  // IRPF: isento até R$440k (imóvel único PF)
  const ganhoCapital = Math.max(0, vmercado - custoTotal)
  const irpfGanho = vmercado <= 440000 ? 0 : ganhoCapital * 0.15
  const corretagemVenda = vmercado * 0.06
  const lucroFlip    = vmercado - custoTotal - irpfGanho - corretagemVenda
  const roiFlip      = custoTotal > 0 ? (lucroFlip / custoTotal) * 100 : 0
  const aluguelMensal = imovel.aluguel_mensal_estimado
    || (vmercado * (imovel.yield_bruto_pct || 6) / 100 / 12)
  const rendaAnual   = aluguelMensal * 12
  const yieldLiquido = custoTotal > 0 ? (rendaAnual / custoTotal) * 100 : 0
  const valorFinanciado = custoTotal * (1 - entrada / 100)
  const entradaValor    = custoTotal * (entrada / 100)
  const taxaMensal      = taxaJuros / 100 / 12
  const prazoMeses      = 360
  const parcela         = tabela === 'price' && taxaMensal > 0
    ? valorFinanciado * (taxaMensal * Math.pow(1 + taxaMensal, prazoMeses))
        / (Math.pow(1 + taxaMensal, prazoMeses) - 1)
    : valorFinanciado / prazoMeses + valorFinanciado * taxaMensal
  const saldoDevedor = taxaMensal > 0
    ? valorFinanciado * Math.pow(1 + taxaMensal, prazoVenda)
      - parcela * (Math.pow(1 + taxaMensal, prazoVenda) - 1) / taxaMensal
    : valorFinanciado - parcela * prazoVenda
  const lucroFinanciado = vmercado - saldoDevedor - entradaValor - reforma - comissao - itbi - doc - advogado - registro - custoJuridico - irpfGanho - corretagemVenda
  const fmt = n => n ? `R$ ${Math.round(n).toLocaleString('pt-BR')}` : '—'
  const pct = n => n != null ? `${Number(n).toFixed(1)}%` : '—'

  // MAO: usa fórmula correta com débitos como custo fixo
  const maoFlip = calcularLanceMaximoParaROI(20, imovel, { eMercado, custoReforma: reforma, mercadoBruto: vmercadoBruto })
  const maoLocacao = (() => {
    const classeNorm = normalizarClasseIPEAD(imovel.classe_ipead || imovel.classe_ipead_label || '')
    const capRatePct = classeNorm === 'Classe 4 - Luxo' ? 4.0 : classeNorm === 'Classe 3 - Alto' ? 5.0 : 6.0
    // % costs depend on the price being solved — keep them in the denominator
    const pctCustos = (_tab.comissao_leiloeiro_pct + _tab.itbi_pct + _tab.advogado_pct + _tab.documentacao_pct) / 100
    const custosFixos = reforma + debitosArr + holding + custoJuridico + (_tab.registro_fixo || 0)
    return aluguelMensal > 0 ? ((aluguelMensal * 12) / (capRatePct / 100) - custosFixos) / (1 + pctCustos) : 0
  })()
  const lanceViavel = precoAquisicao <= maoFlip

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
        <span style={{ fontSize:16 }}>💰</span>
        <h4 style={{ margin:0, fontSize:14, fontWeight:700, color:C.navy }}>
          {eMercado ? 'Calculadora de Retorno — Compra Direta' : 'Calculadora de Retorno'}
        </h4>
      </div>

      {/* Toggle Mercado Bruto vs Ajustado */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, padding:'8px 12px',
        borderRadius:8, background:usarHomogeneizado ? '#EFF6FF' : '#F0FDF4',
        border:`1px solid ${usarHomogeneizado ? '#BFDBFE' : '#BBF7D0'}` }}>
        <button onClick={() => setUsarHomogeneizado(false)} style={{
          padding:'4px 10px', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer',
          border:'1px solid #BBF7D0', background: !usarHomogeneizado ? '#065F46' : '#fff',
          color: !usarHomogeneizado ? '#fff' : '#64748B',
        }}>● Mercado bruto {fmt(vmercadoBruto)}</button>
        <button onClick={() => setUsarHomogeneizado(true)} style={{
          padding:'4px 10px', borderRadius:6, fontSize:11, fontWeight:500, cursor:'pointer',
          border:'1px solid #BFDBFE', background: usarHomogeneizado ? '#1D4ED8' : '#fff',
          color: usarHomogeneizado ? '#fff' : '#64748B',
        }}>Ajustado NBR {fmt(vmercadoAjustado)}</button>
        {ajustadoAcimaDaMed && usarHomogeneizado && (
          <span style={{ fontSize:10, color:'#D97706', fontWeight:600 }}>⚠️ Acima da média do bairro</span>
        )}
      </div>

      <div style={{ background:C.surface, borderRadius:10, padding:'12px 14px', marginBottom:12 }}>
        <p style={{ margin:'0 0 8px', fontSize:11, fontWeight:600, color:C.muted,
          textTransform:'uppercase', letterSpacing:'0.5px' }}>Custo Total de Aquisição</p>
        {[
          [eMercado ? 'Preço aquisição' : 'Lance mínimo', fmt(precoAquisicao)],
          ...(eMercado ? [] : [['Comissão leiloeiro (5%)', fmt(comissao)]]),
          [`ITBI (${imovel.itbi_pct ?? _tab.itbi_pct}%)`, fmt(itbi)],
          [`Documentação (${String(_tab.documentacao_pct).replace('.', ',')}%)`, fmt(doc)],
          ...(eMercado ? [] : [[`Honorários advocacia (${_tab.advogado_pct}%)`, fmt(advogado)]]),
          registro > 0 ? ['Registro cartório', fmt(registro)] : null,
          custoJuridico > 0 ? ['Custo jurídico estimado', fmt(custoJuridico)] : null,
          debitosArr > 0 ? ['Débitos (arrematante)', fmt(debitosArr)] : null,
          reforma > 0 ? ['Reforma estimada', fmt(reforma)] : null,
          holding > 0 ? [`Holding ${HOLDING_MESES_PADRAO}m (cond.+IPTU)`, fmt(holding)] : null,
        ].filter(Boolean).map(([k,v]) => (
          <div key={k} style={{ display:'flex', justifyContent:'space-between',
            padding:'4px 0', borderBottom:`1px solid ${C.borderW}`, fontSize:12 }}>
            <span style={{ color:C.muted }}>{k}</span>
            <span style={{ color:C.navy, fontWeight:500 }}>{v}</span>
          </div>
        ))}
        <div style={{ display:'flex', justifyContent:'space-between',
          padding:'6px 0 0', fontSize:13 }}>
          <span style={{ fontWeight:700, color:C.navy }}>Total</span>
          <span style={{ fontWeight:800, color:C.navy }}>{fmt(custoTotal)}</span>
        </div>
      </div>

      <div style={{ display:'flex', gap:4, marginBottom:12 }}>
        {[['flip','🔄 Flip'],['locacao','🏠 Locação'],['financiado','🏦 Financiado']].map(([k,l]) => (
          <button key={k} onClick={() => setEstrategia(k)} style={{
            flex:1, padding:'7px 4px', borderRadius:7, fontSize:11.5, fontWeight:500,
            border:`1px solid ${estrategia===k ? C.emerald : C.borderW}`,
            background: estrategia===k ? C.emeraldL : C.white,
            color: estrategia===k ? C.emerald : C.muted, cursor:'pointer',
          }}>{l}</button>
        ))}
      </div>

      {estrategia === 'flip' && (
        <div style={{ background:roiFlip > 20 ? C.emeraldL : C.surface,
          borderRadius:10, padding:'14px 16px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
            <div>
              <p style={{ margin:0, fontSize:11, color:C.muted }}>Valor de mercado est.</p>
              <p style={{ margin:0, fontSize:16, fontWeight:800, color:C.navy }}>{fmt(vmercado)}</p>
            </div>
            <div style={{ textAlign:'right' }}>
              <p style={{ margin:0, fontSize:11, color:C.muted }}>Lucro estimado</p>
              <p style={{ margin:0, fontSize:16, fontWeight:800,
                color: lucroFlip > 0 ? C.emerald : RED }}>{fmt(lucroFlip)}</p>
            </div>
          </div>
          {/* Detalhamento deduções */}
          {[
            ['Corretagem de venda (6%)', fmt(corretagemVenda)],
            vmercado > 440000 && irpfGanho > 0 ? ['IRPF 15% g.c.', fmt(irpfGanho)] : null,
          ].filter(Boolean).map(([k,v]) => (
            <div key={k} style={{ display:'flex', justifyContent:'space-between',
              padding:'3px 0', borderBottom:`1px solid ${C.borderW}`, fontSize:11 }}>
              <span style={{ color:C.muted }}>{k}</span>
              <span style={{ color:'#92400E' }}>−{v}</span>
            </div>
          ))}
          <div style={{ background:C.white, borderRadius:8, padding:'8px 12px', marginTop:8,
            display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <span style={{ fontSize:12, color:C.muted }}>ROI estimado</span>
              <div style={{ fontSize:9, color:C.hint, marginTop:1 }}>Líquido — inclui corretagem 6%</div>
            </div>
            <span style={{ fontSize:18, fontWeight:800,
              color: roiFlip > 30 ? C.emerald : roiFlip > 15 ? C.mustard : RED }}>
              {pct(roiFlip)}
            </span>
          </div>
          {maoFlip > 0 && (
            <div style={{background:C.surface, borderRadius:8, padding:'8px 12px',
              marginTop:8, border:`1px solid ${lanceViavel ? C.emerald+'40' : RED+'40'}`}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span style={{fontSize:11, color:C.muted}}>{eMercado ? 'Preço máximo (ROI 20%)' : 'Lance máximo (ROI 20%)'}</span>
                <span style={{fontSize:14, fontWeight:800,
                  color: lanceViavel ? C.emerald : RED}}>{fmt(maoFlip)}</span>
              </div>
              <p style={{margin:'4px 0 0', fontSize:11,
                color: lanceViavel ? C.emerald : RED}}>
                {lanceViavel
                  ? (eMercado ? '✓ Preço pedido dentro da margem' : '✓ Lance atual está dentro do MAO')
                  : (eMercado ? '✗ Preço pedido supera a margem' : '✗ Lance atual supera o MAO')}
              </p>
              <div style={{fontSize:9, color:C.hint, marginTop:3}}>Inclui débitos, holding e reforma no cálculo</div>
            </div>
          )}
        </div>
      )}

      {estrategia === 'locacao' && (
        <div style={{ background:C.surface, borderRadius:10, padding:'14px 16px' }}>
          {[
            ['Aluguel mensal estimado', fmt(aluguelMensal)],
            ['Renda bruta anual', fmt(rendaAnual)],
            ['Yield s/ investimento', pct(yieldLiquido)],
          ].map(([k,v]) => (
            <div key={k} style={{ display:'flex', justifyContent:'space-between',
              padding:'5px 0', borderBottom:`1px solid ${C.borderW}`, fontSize:12 }}>
              <span style={{ color:C.muted }}>{k}</span>
              <span style={{ color:C.navy, fontWeight:600 }}>{v}</span>
            </div>
          ))}
          {maoLocacao > 0 && (
            <div style={{background:C.surface, borderRadius:8, padding:'8px 12px', marginTop:8}}>
              <span style={{fontSize:11, color:C.muted}}>{eMercado ? 'Preço máximo' : 'Lance máximo'} (yield 6% a.a.)</span>
              <span style={{fontSize:14, fontWeight:800, color:C.navy, marginLeft:8}}>
                {fmt(maoLocacao)}
              </span>
            </div>
          )}
        </div>
      )}

      {estrategia === 'financiado' && (
        <div style={{ background:C.surface, borderRadius:10, padding:'14px 16px' }}>
          <div style={{ display:'flex', gap:8, marginBottom:10 }}>
            <div style={{ flex:1 }}>
              <p style={{ margin:'0 0 4px', fontSize:10, color:C.muted }}>Entrada (%)</p>
              <input type="range" min="10" max="90" value={entrada}
                onChange={e => setEntrada(+e.target.value)}
                style={{ width:'100%', accentColor: C.emerald, touchAction:'none' }} />
              <p style={{ margin:0, fontSize:11, fontWeight:600, color:C.navy,
                textAlign:'center' }}>{entrada}% = {fmt(entradaValor)}</p>
            </div>
            <div style={{ flex:1 }}>
              <p style={{ margin:'0 0 4px', fontSize:10, color:C.muted }}>Vender em (meses)</p>
              <input type="range" min="6" max="60" step="6" value={prazoVenda}
                onChange={e => setPrazoVenda(+e.target.value)}
                style={{ width:'100%', accentColor: C.emerald, touchAction:'none' }} />
              <p style={{ margin:0, fontSize:11, fontWeight:600, color:C.navy,
                textAlign:'center' }}>{prazoVenda} meses</p>
            </div>
          </div>
          {[
            ['1ª parcela estimada', fmt(parcela)],
            ['Saldo devedor na venda', fmt(Math.max(0, saldoDevedor))],
            ['Lucro líquido estimado', fmt(lucroFinanciado)],
          ].map(([k,v]) => (
            <div key={k} style={{ display:'flex', justifyContent:'space-between',
              padding:'5px 0', borderBottom:`1px solid ${C.borderW}`, fontSize:12 }}>
              <span style={{ color:C.muted }}>{k}</span>
              <span style={{ color: k.includes('Lucro') && lucroFinanciado > 0
                ? C.emerald : C.navy, fontWeight:600 }}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
