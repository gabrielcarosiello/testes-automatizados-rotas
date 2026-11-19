const { indiceCatalogo } = require('./indice-catalogo')
const { randomUUID } = require('node:crypto')
'use strict'
const normalizar = text => String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase()
function configuracaoNivel(local) {
  const value = local.nivelAlto ?? { habilitado: false }
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.habilitado !== 'boolean') throw new Error('nivelAlto.habilitado deve ser true ou false.')
  const cfg = { habilitado: value.habilitado, campoAlarme: value.campoAlarme ?? 'Dig.str_Dig.Alm', statusMes: value.statusMes ?? 'Nível Alto', prazoMs: value.prazoMs ?? 60000, alarmesConfirmados: value.alarmesConfirmados ?? {} }
  if (typeof cfg.campoAlarme !== 'string' || !cfg.campoAlarme || typeof cfg.statusMes !== 'string' || !cfg.statusMes || !Number.isInteger(cfg.prazoMs) || cfg.prazoMs < 1000 || cfg.prazoMs > 180000 || !cfg.alarmesConfirmados || typeof cfg.alarmesConfirmados !== 'object' || Array.isArray(cfg.alarmesConfirmados)) throw new Error('Revise campoAlarme, statusMes, prazoMs (1000..180000) e alarmesConfirmados em nivelAlto.')
  cfg.offsetsConfirmacao = value.offsetsConfirmacao ?? ['1.0', '1.1']
  if (!Array.isArray(cfg.offsetsConfirmacao) || !cfg.offsetsConfirmacao.length || cfg.offsetsConfirmacao.length > 8 || cfg.offsetsConfirmacao.some(v => typeof v !== 'string' || !/^\d+\.[0-7]$/.test(v) || Number(v.split('.')[0]) > 2097151)) throw new Error('nivelAlto.offsetsConfirmacao deve conter offsets como 1.0 e 1.1.')
  return cfg
}
function resolverAlarme(rota, arrays, cfg) {
  if (!cfg.habilitado || !rota?.nivelAlto?.aplicavel || rota.nivelAlto.status === '---') return null
  const { io, idDigital } = rota.nivelAlto
  const matches = (indiceCatalogo(arrays).nomes.get(cfg.campoAlarme) || []).filter(t => {
    const block = /^DIG(\d+)_(.+)$/.exec(t.block)
    return block && Number(block[1]) === idDigital && block[2] === io && t.name === cfg.campoAlarme
  })
  const unique = [...new Map(matches.map(t => [JSON.stringify(t), t])).values()]
  if (unique.length !== 1 || unique[0].type.toUpperCase() !== 'BOOL' || !Number.isInteger(unique[0].dbNumber)) throw new Error(`${io}: campo ${cfg.campoAlarme} não localizado de forma única no DB DIG correspondente ao ID ${idDigital}.`)
  const tag = unique[0]
  const confirmed = cfg.alarmesConfirmados[io]
  let address, origem
  if (confirmed !== undefined) {
    const m = /^DB(\d+),X(\d+)\.([0-7])$/i.exec(confirmed)
    if (!m || Number(m[1]) !== tag.dbNumber || Number(m[2]) > 2097151) throw new Error(`${io}: endereço de alarme confirmado diverge do DB importado ou é inválido.`)
    address = `DB${tag.dbNumber},X${Number(m[2])}.${m[3]}`; origem = 'confirmado-na-configuracao'
  } else if (Number.isInteger(tag.offsetBits) && tag.offsetBits >= 0 && tag.offsetBits <= 0xffffff && !tag.unverifiedLayout) {
    address = `DB${tag.dbNumber},X${Math.floor(tag.offsetBits / 8)}.${tag.offsetBits % 8}`; origem = 'catalogo'
  } else {
    // Layout do bloco confirmado para este projeto: não usar offsets sugeridos pelo parser.
    address = `DB${tag.dbNumber},X${(cfg.offsetsConfirmacao ?? ['1.0', '1.1'])[0]}`
    origem = 'layout-de-confirmacao-configurado'
  }
  const offsets = [...new Set(cfg.offsetsConfirmacao ?? ['1.0', '1.1'])]
  if (!offsets.includes(address.split(',X')[1])) throw new Error(`${io}: offset do campo importado fora de offsetsConfirmacao. Confira o layout deste projeto.`)
  const alternativas = offsets.filter(offset => `DB${tag.dbNumber},X${offset}` !== address).map((offset, i) => ({ id: `lsh_alarme_alternativa_${i}`, label: `${io} / ${offset === '1.1' ? 'Aviso' : offset === '1.0' ? 'Alm' : offset}`, address: `DB${tag.dbNumber},X${offset}`, writable: false }))
  return { alternativas, id: 'lsh_alarme', label: `${io} / Alm`, address, bloco: tag.block, campo: tag.name, origem, writable: false }
}
function criarControleNivel({ getContext, chamar, cfg, contato, pollMs, registrarEscrita = () => {} }) {
  function context() {
    const c = getContext()
    if (!cfg.habilitado || !c?.alarme || !c?.lsh) throw new Error('Ensaio de nível alto não está preparado para esta rota.')
    return c
  }
  async function sample(c) {
    const data = await chamar('/api/tags')
    if (data.connection !== c.connection || data.mode !== 's7' || data.state !== 'ok' || !data.connected || !Number.isInteger(data.sequence) || !Number.isFinite(Date.parse(data.receivedAt)) || Math.abs(Date.now() - Date.parse(data.receivedAt)) > Math.max(3000, 3 * pollMs)) throw new Error('Leitura S7 inválida/expirada ou conexão alterada durante nível alto.')
    const points = [c.lsh, c.alarme, ...(c.alarme.alternativas || [])].map(tag => {
      const read = data.tags.find(t => t.id === tag.id && t.address === tag.address)
      if (!read?.good || typeof read.value !== 'boolean') throw new Error(`Leitura inválida: ${tag.label}.`)
      return { ...tag, value: read.value, good: true, esperado: tag.id === c.lsh.id ? contato.valorNivelAlto : true }
    })
    return { data, points }
  }
  const controls = {
    // Fase 1: um comando explícito, apenas após partida normal aprovada.
    async acionarNivelAltoS7() {
      const c = context()
      if (!c.resultado?.ok) throw new Error('Confirme os equipamentos antes de acionar a LSH.')
      if (c.nivel) throw new Error('O acionamento de nível alto já foi solicitado nesta rota; não será repetido.')
      const { data, points } = await sample(c)
      if (points[0].value !== c.lsh.valorInicial || points.slice(1).some(p => p.value !== false)) throw new Error('A LSH ou o alarme mudou desde a preparação. Entrada não foi acionada.')
      if (c.nivel) throw new Error('Já existe um acionamento de nível alto em andamento.')
      // Mark cleanup as required BEFORE sending: a lost response can hide a successful write.
      c.nivel = { id: randomUUID(), valorSolicitado: contato.valorNivelAlto, inicio: Date.now(), baseline: data.sequence, limite: Date.now() + cfg.prazoMs, restauracaoPendente: true, restauracaoTentada: false, historico: [], aprovado: false }
      registrarEscrita('solicitada', c)
      const result = await chamar('/api/escrita', { body: JSON.stringify({ id: c.lsh.id, connection: c.connection, expected: points[0].value, value: contato.valorNivelAlto }) })
      c.nivel.escrita = result
      if (!result.acknowledged || !result.verified || result.observed !== contato.valorNivelAlto) throw new Error('A escrita da LSH não foi confirmada por releitura. Não será repetida automaticamente.')
      registrarEscrita('confirmada', c)
      return { valor: contato.valorNivelAlto, statusMes: cfg.statusMes, prazoMs: cfg.prazoMs }
    },
    // Fase 2: observar entrada e Alm em amostra válida; não simular retenção.
    async consultarNivelAltoS7() {
      const c = context()
      if (!c.nivel) throw new Error('Nível alto ainda não acionado.')
      let read
      try { read = await sample(c) } catch (error) { return { ok: false, concluido: true, detalhe: error.message, tags: [], intervaloConsultaMs: 1000 } }
      const { data, points } = read
      const fresh = data.sequence > c.nivel.baseline && Date.parse(data.receivedAt) >= c.nivel.inicio
      const inputOk = points[0].value === contato.valorNivelAlto
      const dbOk = fresh && inputOk && points.slice(1).some(p => p.value === true)
      const expired = Date.now() >= c.nivel.limite
      const error = fresh && !inputOk ? 'A LSH não permaneceu no valor de nível alto.' : expired ? 'Prazo para confirmar nível alto no DB e no MES esgotado.' : ''
      c.nivel.ultima = { sequence: data.sequence, receivedAt: data.receivedAt, entrada: points[0].value, alm: points[1].value, confirmacoes: points.slice(1).map(p => ({ address: p.address, value: p.value })) }
      if (c.nivel.historico.at(-1)?.sequence !== data.sequence) c.nivel.historico.push(c.nivel.ultima)
      return { ok: dbOk && !error, concluido: Boolean(error), detalhe: error || (dbOk ? 'Alm ou Aviso confirmado; aguardando Nível Alto no MES.' : 'Aguardando LSH e Alm ou Aviso.'), tags: points, sequence: data.sequence, receivedAt: data.receivedAt, intervaloConsultaMs: 1000, statusMes: cfg.statusMes, fase: 'nivel-alto' }
    },
    // Fase 3: juntar a evidência S7 ao estado lido no cartão correto do MES.
    async confirmarNivelAltoMesS7({ statusMes } = {}) {
      const c = context()
      const current = await controls.consultarNivelAltoS7()
      if (!current.ok || normalizar(statusMes) !== normalizar(cfg.statusMes)) throw new Error('O alarme no DB e o status de nível alto no MES não foram confirmados juntos.')
      c.nivel.reacaoConfirmada = true; c.nivel.statusMes = statusMes; c.nivel.confirmadoEm = new Date().toISOString()
      return { ...current, ok: true, concluido: true, detalhe: 'LSH, Alm ou Aviso do DB e Nível Alto no MES confirmados.' }
    },
    // Fase 4: chamada no sucesso e no afterEach; nunca escrever em outra sessão.
    async restaurarNivelAltoS7() {
      const c = getContext()
      if (!c?.nivel?.restauracaoPendente) return { ok: true, necessario: false }
      try {
        const data = await chamar('/api/tags')
        const read = data.tags?.find(t => t.id === c.lsh.id && t.address === c.lsh.address)
        if (data.connection !== c.connection || data.state !== 'ok' || !data.connected || !read?.good || typeof read.value !== 'boolean' || !Number.isFinite(Date.parse(data.receivedAt)) || Math.abs(Date.now() - Date.parse(data.receivedAt)) > Math.max(3000, 3 * pollMs)) throw new Error('Sessão ou leitura da entrada indisponível para restaurar.')
        if (read.value !== c.lsh.valorInicial) {
          if (c.nivel.restauracaoTentada) throw new Error('Restauração anterior não confirmada. Não será repetida sem intervenção.')
          c.nivel.restauracaoTentada = true
          const result = await chamar('/api/escrita', { body: JSON.stringify({ id: c.lsh.id, connection: c.connection, expected: read.value, value: c.lsh.valorInicial }) })
          if (!result.verified || result.observed !== c.lsh.valorInicial) throw new Error('Restauração da LSH não confirmada por releitura.')
        }
        registrarEscrita('restaurada', c)
        c.nivel.restauracaoPendente = false; c.nivel.aprovado = c.nivel.reacaoConfirmada === true; c.nivel.restauradoEm = new Date().toISOString()
        return { ok: true, necessario: true, valor: c.lsh.valorInicial }
      } catch (error) { c.nivel.erroRestauracao = error.message; return { ok: false, necessario: true, detalhe: error.message } }
    }
  }
  return controls
}
module.exports = { configuracaoNivel, resolverAlarme, criarControleNivel }
