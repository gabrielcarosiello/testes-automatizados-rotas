'use strict'
const { consultarDbsDaRotaSql } = require('./gerarRotaCLP')

const tipos = { BOOL: 'X', BYTE: 'BYTE', USINT: 'BYTE', SINT: 'SINT', WORD: 'WORD',
  UINT: 'WORD', INT: 'INT', DWORD: 'DWORD', UDINT: 'DWORD', DINT: 'DINT' }
const camposComuns = /^(?:[bxi])?(?:estado|status|situacao|emergencia|alarmeemergencia|emergency|manutencao|maintenance|suspensao|suspenso|suspensa|suspended|falha|fault|alarme|alm|alarm|bloqueado|bloqueio|blocked|intertravamento|intertravado|interlock|inoperante|indisponivel)$/
const normalizar = nome => nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase()
const campoDeEstado = nome => camposComuns.test(normalizar(nome.split('.').at(-1)))

function mapearCamposDiagnostico(vinculos, catalogo, campos = []) {
  const ativos = vinculos.filter(v => v.val_comando === 1 || v.val_comando === 2)
  const equipamentos = [...new Map(consultarDbsDaRotaSql(ativos, catalogo)
    .map(e => [JSON.stringify([e.cod_equipamento, e.db, e.ponto]), e])).values()]
  const blocos = new Map(equipamentos.filter(e => e.bloco).map(e => [JSON.stringify([e.bloco, e.db]), []]))
  for (const t of catalogo) {
    const bloco = blocos.get(JSON.stringify([t.block, t.dbNumber]))
    if (bloco && (campoDeEstado(t.name) || campos.includes(t.name))) bloco.push(t)
  }
  let alias = 0
  return equipamentos.map(e => {
    const declaracoes = blocos.get(JSON.stringify([e.bloco, e.db])) || []
    const nomes = new Map()
    for (const t of declaracoes) {
      const lista = nomes.get(t.name) || []
      lista.push(t)
      nomes.set(t.name, lista)
    }
    const semEndereco = []
    const tags = []
    for (const [nome, lista] of nomes) {
      const [t] = lista
      const tipo = Object.hasOwn(tipos, t.type.toUpperCase()) ? tipos[t.type.toUpperCase()] : null
      if (lista.length !== 1 || !tipo || t.unverifiedLayout || !Number.isInteger(t.offsetBits) ||
          t.offsetBits < 0 || t.offsetBits > 0xffffff || (tipo !== 'X' && t.offsetBits % 8 !== 0)) {
        semEndereco.push(nome)
        continue
      }
      const endereco = Math.floor(t.offsetBits / 8)
      tags.push({ id: 'diag_' + ++alias, label: nome.slice(0, 100), nome,
        address: 'DB' + e.db + ',' + tipo + endereco + (tipo === 'X' ? '.' + t.offsetBits % 8 : '') })
    }
    return { equipamento: e.ponto, db: e.db, tags, semEndereco }
  })
}

function detalheErroDiagnostico(erro) {
  if (erro.status === 404 || erro.status === 405) {
    return `API de diagnóstico de DBs indisponível (HTTP ${erro.status}). Na VM, encerre a instância atual do Monitor S7 e inicie npm start na pasta monitor-s7 da versão atual do projeto.`
  }
  return erro.message
}

async function verificarApiDiagnostico(chamar) {
  // Lista vazia é rejeitada pelo Monitor antes de abrir qualquer conexão S7.
  try {
    await chamar('/api/diagnostico-dbs', { body: '{"tags":[]}' })
  } catch (erro) {
    if (erro.status === 400 && erro.message.includes('Diagnóstico aceita somente leituras escalares de DB')) return
    const detalhe = detalheErroDiagnostico(erro)
    throw new Error(detalhe, { cause: erro })
  }
  throw new Error('Resposta inesperada do Monitor à verificação de diagnóstico de DBs.')
}

async function lerDiagnosticoEquipamentos({ equipamentos, cpu, chamar }) {
  const tags = equipamentos.flatMap(e => e.tags)
  const valores = new Map()
  const avisos = []
  for (let i = 0; i < tags.length; i += 32) {
    const grupo = tags.slice(i, i + 32).map(({ id, label, address }) => ({ id, label, address }))
    try {
      const resposta = await chamar('/api/diagnostico-dbs', { body: JSON.stringify({ ...cpu, tags: grupo }), timeout: 18000 })
      if (resposta.host !== cpu.host || !Array.isArray(resposta.tags)) throw new Error('O Monitor retornou outra CPU ou resposta inválida.')
      for (const tag of resposta.tags) if (tag.good === true &&
          (typeof tag.value === 'boolean' || Number.isFinite(tag.value))) valores.set(tag.id, tag)
    } catch (error) {
      avisos.push(detalheErroDiagnostico(error))
      break
    }
  }
  const observacoes = equipamentos.map(e => {
    const lidas = e.tags.filter(tag => valores.get(tag.id)?.address === tag.address)
    const campos = lidas.map(tag => tag.nome + '=' + valores.get(tag.id).value)
    if (!campos.length) campos.push('nenhum campo de estado confirmado')
    const nomesLidos = lidas.map(tag => normalizar(tag.nome.split('.').at(-1)))
    for (const [situacao, padrao] of [
      ['Equipamento em emergência', /^(?:[bxi])?(?:emergencia|alarmeemergencia|emergency)$/],
      ['Equipamento em manutenção', /^(?:[bxi])?(?:manutencao|maintenance)$/],
      ['Equipamento suspenso', /^(?:[bxi])?(?:suspensao|suspenso|suspensa|suspended)$/],
      ['Equipamento com falha', /^(?:[bxi])?(?:falha|fault)$/],
      ['Equipamento bloqueado', /^(?:[bxi])?(?:bloqueado|bloqueio|blocked)$/],
    ]) {
      const ativo = lidas.find((tag, i) => padrao.test(nomesLidos[i]) && valores.get(tag.id).value === true)
      if (ativo) campos.push(situacao + ' (' + ativo.address + ')')
    }
    const naoVerificadas = [
      ['emergência', /emergencia|emergency/],
      ['manutenção', /manutencao|maintenance/],
      ['suspensão', /suspensao|suspenso|suspensa|suspended/],
    ].filter(([, padrao]) => !nomesLidos.some(nome => padrao.test(nome))).map(([rotulo]) => rotulo)
    if (naoVerificadas.length) campos.push('não verificadas: ' + naoVerificadas.join(', '))
    const faltam = e.tags.length - lidas.length
    if (faltam) campos.push(faltam + ' leitura(s) indisponível(is)')
    if (e.semEndereco.length) campos.push('layout não confirmado: ' + e.semEndereco.join(', '))
    return { completo: lidas.length > 0 && faltam === 0 && e.semEndereco.length === 0,
      texto: e.equipamento + ' (DB' + e.db + '): ' + campos.join(', ') }
  })
  return { completo: observacoes.length > 0 && observacoes.every(o => o.completo) && !avisos.length,
    detalhes: observacoes.length ? [...observacoes.map(o => o.texto), ...avisos].join(' | ') :
      'A rota não retornou equipamentos vinculados para diagnóstico.' }
}
module.exports = { mapearCamposDiagnostico, lerDiagnosticoEquipamentos, verificarApiDiagnostico }
