const { indiceCatalogo } = require('./indice-catalogo')
const { criarClienteMonitor } = require('./cliente-monitor')
const { criarEstadoEscrita } = require('./estado-escrita')
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs')
const path = require('node:path')
const { isIPv4 } = require('node:net')
const { setTimeout: dormir } = require('node:timers/promises')
const { selecionarValidacao } = require('./perfis')
const { configurarContatoLSH } = require('./contato-lsh')
const { criarCatalogoProjeto, conferirSinaisLir } = require('./catalogo-projeto')
const { configuracaoNivel, resolverAlarme, criarControleNivel } = require('./nivel-alto')
const perfisPadrao = require('../../perfis-s7.json')
const { consultarDbsDaRotaSql } = require('./gerarRotaCLP')

function mapear(vinculos, catalogo, perfis = perfisPadrao, modoValidacao = 'sql') {
  if (vinculos.some(v => ![0, 1, 2].includes(v.val_comando))) {
    throw new Error('O SQL retornou vínculo com comando fora de 0, 1 ou 2.')
  }
  const ativos = vinculos.filter(v => v.val_comando !== 0)
  if (!ativos.length) throw new Error('A rota não tem vínculos com comando 1 ou 2 no SQL.')
  const tags = new Map()
  const pendencias = []
  for (const vinculo of ativos) {
    try {
      const [equipamento] = consultarDbsDaRotaSql([vinculo], catalogo)
      const { ponto, db, bloco, val_comando } = equipamento
      if (!bloco) throw new Error(`DB${db} ausente ou ambíguo no TIA`)
      const validacao = selecionarValidacao(vinculo, perfis, modoValidacao)
      const campo = `Eqp.EquipamentoDWord1.${validacao.espelho}`
      const registros = indiceCatalogo(catalogo).campos.get(JSON.stringify([bloco, db, campo])) || []
      const [tag] = registros
      if (registros.length !== 1 || tag.type?.toUpperCase() !== 'BOOL' ||
          !Number.isInteger(tag.offsetBits) || tag.offsetBits < 0) {
        throw new Error(`${campo} sem definição BOOL e offset confirmados`)
      }
      const address = `DB${db},X${Math.floor(tag.offsetBits / 8)}.${tag.offsetBits % 8}`
      if (validacao.espelho.startsWith('EspelhoEntrada')) {
        const indice = Number(validacao.espelho.slice(-1)) - 1
        const cadastrado = vinculo.espelhos_entrada[indice]
        const partes = /^DB(\d+),X(\d+)\.([0-7])$/i.exec(cadastrado)
        const enderecoSql = partes ? `DB${Number(partes[1])},X${Number(partes[2])}.${partes[3]}` : null
        if (enderecoSql !== address) throw new Error(`Entrada SQL ${cadastrado} diverge do catálogo TIA ${address}.`)
      }
      const referencia = {
        cod_equipamento: vinculo.cod_equipamento, tip_equipamento: vinculo.tip_equipamento,
        val_comando, ...validacao,
      }
      if (!tags.has(address)) {
        tags.set(address, { id: `s7_${tags.size + 1}`, label: `${ponto} / ${validacao.espelho}`.slice(0, 100),
          address, bloco, campo, offsetBits: tag.offsetBits, ...validacao, equipamentos: [referencia] })
      } else {
        const existente = tags.get(address)
        existente.equipamentos.push(referencia)
        existente.exigirDesligadoAntes ||= validacao.exigirDesligadoAntes
      }
    } catch (erro) {
      pendencias.push(`${vinculo.des_tag || vinculo.cod_equipamento}: ${erro.message}`)
    }
  }
  if (pendencias.length) throw new Error(pendencias.join(' | '))
  if (tags.size > 32) throw new Error(`${tags.size} tags esperadas. O Monitor aceita até 32 por mapeamento.`)
  return [...tags.values()]
}

function diagnostico(amostra, tags, esperado) {
  if (amostra.mode !== 's7' || !amostra.connected || amostra.state !== 'ok' ||
      !Number.isInteger(amostra.sequence) || !Number.isFinite(Date.parse(amostra.receivedAt))) {
    return amostra.diagnostic || 'Aguardando leitura válida do CLP.'
  }
  const lidas = new Map((amostra.tags || []).map(t => [t.id, t]))
  return tags.flatMap(tag => {
    const lida = lidas.get(tag.id)
    const valorCorreto = esperado === false && tag.exigirDesligadoAntes === false
      ? typeof lida?.value === 'boolean'
      : lida?.value === esperado
    return lida?.address === tag.address && lida.good === true && valorCorreto
      ? []
      : [`${tag.label} (${tag.address}): esperado ${esperado}, lido ${lida?.good === true ? lida.value : 'inválido'}`]
  }).join(' | ')
}

function criarPiloto(raiz, consultarRota = codigo => require('./consultarRota').consultarRota(codigo), opcoes = {}) {
  const local = JSON.parse(readFileSync(path.join(raiz, 's7.local.json'), 'utf8').replace(/^\uFEFF/, ''))
  const nivelCfg = configuracaoNivel(local)
  if (nivelCfg.habilitado && (!local.incluirLSHNoMonitor || !local.escritaManualLSH)) throw new Error('Nível alto exige incluirLSHNoMonitor=true e escritaManualLSH=true.')
  const contatoLSH = configurarContatoLSH(local.tipoContatoLSH)
  const modoValidacao = local.modoValidacao ?? 'sql'
  if (!['sql', 'entradas'].includes(modoValidacao)) {
    throw new Error('modoValidacao deve ser "sql" ou "entradas" no s7.local.json.')
  }
  const monitor = new URL(local.monitor)
  if (!['127.0.0.1', 'localhost'].includes(monitor.hostname) || monitor.protocol !== 'http:' ||
      monitor.pathname !== '/' || monitor.username || monitor.password || monitor.search || monitor.hash) {
    throw new Error('Informe a URL HTTP local do Monitor no s7.local.json.')
  }
  const { host, rack, slot, pollMs } = local
  if (!isIPv4(host)) throw new Error('Configure o IPv4 do CLP em s7.local.json.')
  for (const [nome, valor, min, max] of [['rack', rack, 0, 7], ['slot', slot, 0, 31], ['pollMs', pollMs, 100, 10000]]) {
    if (!Number.isInteger(valor) || valor < min || valor > max) throw new Error(`${nome} deve ser inteiro entre ${min} e ${max} em s7.local.json.`)
  }
  for (const campo of ['incluirLSHNoMonitor', 'escritaManualLSH']) {
    if (local[campo] !== undefined && typeof local[campo] !== 'boolean') throw new Error(`${campo} deve ser true ou false em s7.local.json.`)
  }
  if (local.escritaManualLSH && !local.incluirLSHNoMonitor) throw new Error('escritaManualLSH exige incluirLSHNoMonitor=true.')
  if (local.incluirLSHNoMonitor && !contatoLSH) throw new Error('Defina tipoContatoLSH (0=NA, 1=NF) ao incluir a LSH no Monitor.')
  const intervaloConsultaMs = local.intervaloConsultaMs ?? 1000
  const prazoS7Ms = local.prazoS7Ms ?? 45000
  if (!Number.isInteger(intervaloConsultaMs) || intervaloConsultaMs < 500 || intervaloConsultaMs > 5000 ||
      !Number.isInteger(prazoS7Ms) || prazoS7Ms < 1000 || prazoS7Ms > 180000) {
    throw new Error('intervaloConsultaMs deve estar entre 500 e 5000 e prazoS7Ms entre 1000 e 180000.')
  }
  let contexto

  const chamar = criarClienteMonitor(monitor)
  const estadoEscrita = criarEstadoEscrita(raiz, { host, rack, slot })

  async function aguardar({ connection, tags, esperado, depoisDe = -1 }) {
    const limite = Date.now() + 15000
    let detalhe
    do {
      const leitura = await chamar('/api/tags')
      if (leitura.connection !== connection) throw new Error('A conexão ou o mapeamento do Monitor mudou.')
      detalhe = diagnostico(leitura, tags, esperado)
      if (!detalhe && leitura.sequence > depoisDe) return leitura
      if (!detalhe) detalhe = 'Aguardando nova amostra após a confirmação do MES.'
      await dormir(intervaloConsultaMs)
    } while (Date.now() < limite)
    throw new Error(detalhe)
  }

  const catalogoProjeto = criarCatalogoProjeto(raiz, local, chamar)
  const controleNivel = criarControleNivel({ getContext: () => contexto, chamar, cfg: nivelCfg, contato: contatoLSH, pollMs, registrarEscrita: estadoEscrita.registrar, exigirPropriedade: estadoEscrita.exigirPropriedade, exigirLivre: estadoEscrita.exigirLivre })
  return {
    ...controleNivel,
    async validarCatalogoS7() {
      estadoEscrita.exigirLivre()
      if (contexto?.nivel?.restauracaoPendente) throw new Error('A LSH da execução anterior ainda precisa ser restaurada.')
      catalogoProjeto.reiniciar()
      const { arrays, info } = await catalogoProjeto.obter()
      const sinaisLir = conferirSinaisLir(opcoes.rotas || [], arrays)
      if (local.incluirLSHNoMonitor) {
        const invalidos = sinaisLir.filter(sinal => !sinal.address)
        if (invalidos.length) throw new Error('LSH sem endereço de entrada único: ' + invalidos.map(s => `${s.sinal} (${s.situacao})`).join(', '))
      }
      if (nivelCfg.habilitado) for (const rota of opcoes.rotas || []) resolverAlarme(rota, arrays, nivelCfg)
      let verificacaoSql = null
      if (opcoes.prevalidarSql && opcoes.rotas?.length) {
        const codigo = Number(opcoes.rotas[0].codigo)
        try {
          const vinculos = await consultarRota(codigo)
          if (!Array.isArray(vinculos)) throw new Error('Resposta de vínculos inválida.')
          verificacaoSql = { codigo, vinculos: vinculos.length }
        } catch (causa) { throw new Error(`SQL: verificação inicial da rota ${codigo} falhou: ${causa.message}`, { cause: causa }) }
      }
      return { ...info, verificacaoSql, nivelAlto: nivelCfg, declaracoes: arrays.length, sinaisLir, contatoLSH }
    },
    // Pré-partida: SQL + catálogo resolvem os equipamentos, LSH e Alm.
    // Somente a entrada LSH pode receber escrita; retornos/Alm são leitura.
    async prepararS7(codigo) {
      estadoEscrita.exigirLivre()
      if (contexto?.nivel?.restauracaoPendente) throw new Error('A LSH da rota anterior ainda precisa ser restaurada.')
      contexto = undefined
      const vinculos = await consultarRota(Number(codigo))
      const { arrays, info: catalogoInfo } = await catalogoProjeto.obter()
      const perfis = JSON.parse(readFileSync(path.join(raiz, 'perfis-s7.json'), 'utf8').replace(/^\uFEFF/, ''))
      const tags = mapear(vinculos, arrays, perfis, modoValidacao)
      const rota = (opcoes.rotas || []).find(r => Number(r.codigo) === Number(codigo))
      if (local.incluirLSHNoMonitor && !rota) throw new Error(`Rota ${codigo} não foi informada ao preparar a LSH. Recarregue a configuração do Piloto.`)
      const sinaisLir = conferirSinaisLir(rota ? [rota] : [], arrays)
      let lsh = null
      if (local.incluirLSHNoMonitor && rota?.nivelAlto?.aplicavel) {
        const [sinal] = sinaisLir
        if (!sinal?.address || sinal.situacao !== 'localizado') throw new Error(`LSH ${rota.nivelAlto.io}: ${sinal?.situacao || 'não localizada'} no catálogo. A rota não foi iniciada.`)
        if (tags.length >= 32) throw new Error('A LSH exige uma posição: selecione até 31 retornos de equipamentos para usar incluirLSHNoMonitor.')
        lsh = { id: 'lsh_nivel_alto', label: sinal.sinal, address: sinal.address, writable: local.escritaManualLSH === true }
      }
      const alarme = resolverAlarme(rota, arrays, nivelCfg)
      const alarmes = alarme ? [alarme, ...(alarme.alternativas || [])] : []
      if (tags.length + (lsh ? 1 : 0) + alarmes.length > 32) throw new Error('Nível alto excede 32 tags incluindo entrada e sinais de confirmação.')
      const tagsConexao = [...tags.map(({ id, label, address }) => ({ id, label, address })), ...(lsh ? [lsh] : []), ...alarmes]
      const sessao = await chamar('/api/conexao', { body: JSON.stringify({ host, rack, slot, pollMs, tags: tagsConexao }) })
      if (!sessao.connection || sessao.host !== host) throw new Error('O Monitor não confirmou a sessão configurada.')
      if (lsh?.writable && !sessao.tags?.some(tag => tag.id === lsh.id && tag.address === lsh.address && tag.writeType === 'X')) throw new Error('O Monitor não habilitou a escrita da LSH. Utilize a versão 0.12 ou posterior com escrita de I/O.')
      const inicial = await aguardar({ connection: sessao.connection, tags: [...tags, ...(lsh ? [{ ...lsh, exigirDesligadoAntes: false }] : []), ...alarmes], esperado: false })
      if (lsh) {
        lsh.valorInicial = inicial.tags.find(tag => tag.id === lsh.id).value
        if (lsh.valorInicial !== contatoLSH.valorSemNivelAlto) throw new Error(`LSH ${lsh.label} já indica nível alto. Restaure a entrada para ${Number(contatoLSH.valorSemNivelAlto)} antes de preparar a rota.`)
      }
      contexto = {
        codigo, vinculos, perfis, catalogoInfo, sinaisLir, lsh, alarme, connection: sessao.connection, tags, baseline: inicial.sequence,
        observadas: Object.fromEntries(tags.map(tag => [tag.id, { jaLigou: false, primeiroTrue: null, ultimoTrue: null }])),
        historico: [], iniciadoEm: null, resultado: null,
      }
      return tags
    },
    async confirmarS7({ inicio } = {}) {
      if (!contexto) return { ok: false, concluido: true, detalhe: 'Mapeamento da rota indisponível.', tags: [] }
      if (contexto.resultado) return contexto.resultado
      if (!contexto.iniciadoEm) contexto.iniciadoEm = Date.now()
      let leitura
      let erro = ''
      try {
        leitura = await chamar('/api/tags')
        if (leitura.connection !== contexto.connection) throw new Error('A conexão ou o mapeamento S7 mudou após a partida.')
      } catch (falha) {
        erro = falha.message
      }
      const nova = leitura && leitura.sequence > contexto.baseline &&
        Date.parse(leitura.receivedAt) >= (inicio || contexto.iniciadoEm) &&
        Date.now() - Date.parse(leitura.receivedAt) <= Math.max(3000, 3 * pollMs)
      const estadoValido = !erro && nova && leitura.mode === 's7' && leitura.state === 'ok' && leitura.connected
      const lidas = new Map((leitura?.tags || []).map(tag => [tag.id, tag]))
      const tags = contexto.tags.map(tag => {
        const lida = lidas.get(tag.id)
        const good = Boolean(estadoValido && lida?.good === true && lida.address === tag.address && typeof lida.value === 'boolean')
        const observado = contexto.observadas[tag.id]
        if (good && lida.value === true) {
          observado.jaLigou = true
          observado.primeiroTrue ||= leitura.receivedAt
          observado.ultimoTrue = leitura.receivedAt
        }
        return { ...tag, ...observado, good, value: good ? lida.value : null, esperado: true }
      })
      if (leitura && contexto.historico.at(-1)?.sequence !== leitura.sequence) {
        contexto.historico.push({
          sequence: leitura.sequence, receivedAt: leitura.receivedAt, state: leitura.state,
          tags: tags.map(({ id, address, value, good }) => ({ id, address, value, good })),
        })
      }
      const ok = tags.length > 0 && tags.every(tag => tag.good && tag.value === true)
      const expirou = Date.now() - contexto.iniciadoEm >= prazoS7Ms
      const concluido = ok || expirou || Boolean(erro)
      const pendentes = tags.filter(tag => !tag.good || tag.value !== true).map(tag =>
        `${tag.label} (${tag.address}): esperado true, lido ${tag.good ? tag.value : 'inválido'}` +
        (tag.jaLigou
          ? `; já foi true em ${tag.ultimoTrue}, ${tag.espelho?.startsWith('EspelhoEntrada') ? 'posição perdeu confirmação' : 'conferir pulso/temporização'}`
          : '; true ainda não observado')
      )
      const detalhe = ok
        ? `S7: ${tags.length} retornos confirmados em ${leitura.receivedAt} (amostra ${leitura.sequence}).`
        : erro || pendentes.join(' | ')
      const resultado = {
        ok, concluido, detalhe, tags, sequence: leitura?.sequence ?? null,
        receivedAt: leitura?.receivedAt ?? null, intervaloConsultaMs,
      }
      if (concluido) contexto.resultado = resultado
      return resultado
    },
    salvarEvidenciaS7({ pasta }) {
      if (!contexto || !/^[a-zA-Z0-9_-]+$/.test(pasta || '')) throw new Error('Execução S7 indisponível ou pasta inválida.')
      const destino = path.join(raiz, 'resultados', pasta)
      mkdirSync(destino, { recursive: true })
      const nome = `s7-rota-${Number(contexto.codigo)}-${Date.now()}.json`
      writeFileSync(path.join(destino, nome), JSON.stringify({
        rota: contexto.codigo, connection: contexto.connection, vinculosSql: contexto.vinculos, mapeamento: contexto.tags, perfisAplicados: contexto.perfis,
        catalogoProjeto: contexto.catalogoInfo, sinaisLir: contexto.sinaisLir,
        inicio: contexto.iniciadoEm, prazoS7Ms, intervaloConsultaMs, modoValidacao, contatoLSH,
        lshManual: contexto.lsh ? { ...contexto.lsh, ensaioNivelAltoExecutado: Boolean(contexto.nivel) } : null,
        nivelAlto: contexto.nivel || null, alarme: contexto.alarme,
        resultado: contexto.resultado, observadas: contexto.observadas, historico: contexto.historico,
      }, null, 2))
      return path.join('resultados', pasta, nome).split(path.sep).join('/')
    },
  }
}

module.exports = { criarPiloto, mapear, diagnostico }
