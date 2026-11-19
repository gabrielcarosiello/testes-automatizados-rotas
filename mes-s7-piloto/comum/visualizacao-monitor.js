// Piloto 06: valores da API no DOM do MES, disponíveis para snapshot e screenshot.
const painelId = 'integracao-visualizacao-s7'

function montarPainel(documento, codigo) {
  documento.getElementById(painelId)?.remove()
  const painel = documento.createElement('section')
  painel.id = painelId
  painel.dataset.rota = codigo
  Object.assign(painel.style, {
    position: 'fixed', inset: '0', zIndex: '2147483647', boxSizing: 'border-box',
    display: 'flex', flexDirection: 'column', background: '#f1f6f8',
    padding: '10px', font: '12px Arial, sans-serif', color: '#123347',
  })
  const titulo = documento.createElement('div')
  titulo.dataset.s7 = 'titulo'
  titulo.textContent = `Rota ${codigo} — Monitor S7 — aguardando leitura após a partida`
  Object.assign(titulo.style, { padding: '10px', background: '#08374b', color: '#fff', fontWeight: 'bold' })
  const detalhe = documento.createElement('div')
  detalhe.dataset.s7 = 'detalhe'
  Object.assign(detalhe.style, { padding: '8px 0', minHeight: '30px', overflowWrap: 'anywhere' })
  const grade = documento.createElement('div')
  grade.dataset.s7 = 'grade'
  Object.assign(grade.style, { display: 'grid', gap: '8px', flex: '1', alignContent: 'start' })
  painel.append(titulo, detalhe, grade)
  documento.body.append(painel)
  return painel
}

function renderizar(documento, resultado, pagina = 0) {
  const painel = documento.getElementById(painelId)
  if (!painel) return 1
  const janela = documento.defaultView
  const colunas = 1 // Tabela única em toda a largura; nunca cria coluna vazia.
  const linhas = Math.max(4, Math.min(40, Math.floor((janela.innerHeight - 150) / 28)))
  const capacidade = colunas * linhas
  const paginas = Math.max(1, Math.ceil(resultado.tags.length / capacidade))
  painel.querySelector('[data-s7="titulo"]').textContent =
    `Rota ${painel.dataset.rota} — Monitor S7 — ${resultado.fase === 'nivel-alto' ? (resultado.concluido && resultado.ok ? 'NÍVEL ALTO CONFIRMADO' : 'ACOMPANHANDO NÍVEL ALTO') : resultado.ok ? 'RETORNOS CONFIRMADOS' : resultado.concluido ? 'FALHA NA CONFIRMAÇÃO' : 'ACOMPANHANDO PARTIDA'} — página ${pagina + 1}/${paginas}`
  painel.querySelector('[data-s7="detalhe"]').textContent =
    `Amostra ${resultado.sequence ?? '—'} · ${resultado.receivedAt || 'aguardando leitura'} · ${resultado.tags.length} tags · ${resultado.fase === 'nivel-alto' ? 'entrada conforme NA/NF · Alm esperado 1' : 'esperado TRUE'}`
  const grade = painel.querySelector('[data-s7="grade"]')
  grade.replaceChildren()
  grade.style.gridTemplateColumns = `repeat(${colunas}, minmax(0, 1fr))`
  const visiveis = resultado.tags.slice(pagina * capacidade, (pagina + 1) * capacidade)
  for (let coluna = 0; coluna < colunas; coluna++) {
    const tabela = documento.createElement('table')
    Object.assign(tabela.style, { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', background: '#fff' })
    const cabecalho = documento.createElement('tr')
    for (const [indice, texto] of ['Equipamento / sinal', 'Endereço', 'Valor', resultado.fase === 'nivel-alto' ? 'Esperado' : 'Visto true'].entries()) {
      const celula = documento.createElement('th')
      celula.textContent = texto
      celula.style.width = ['42%', '23%', '23%', '12%'][indice]
      Object.assign(celula.style, { padding: '6px 4px', textAlign: 'left', background: '#dce9ee', fontSize: '11px' })
      cabecalho.append(celula)
    }
    tabela.append(cabecalho)
    for (const tag of visiveis.slice(coluna * linhas, (coluna + 1) * linhas)) {
      const linha = documento.createElement('tr')
      const posicao = tag.espelho?.startsWith('EspelhoEntrada')
      const estado = resultado.fase === 'nivel-alto' ? (tag.good ? String(Number(tag.value)) : 'INVÁLIDO') : tag.good ? tag.value ? posicao ? 'CONFIRMADO' : 'LIGADO' : posicao ? 'PENDENTE' : 'DESLIGADO' : 'INVÁLIDO'
      const valores = [tag.label, tag.address, estado, resultado.fase === 'nivel-alto' ? String(Number(tag.esperado)) : tag.jaLigou ? 'Sim' : 'Não']
      valores.forEach((texto, indice) => {
        const celula = documento.createElement('td')
        celula.textContent = texto
        Object.assign(celula.style, {
          height: '26px', padding: '2px 4px', boxSizing: 'border-box', borderBottom: '1px solid #dbe5e9',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '11px',
        })
        celula.title = texto
        if (indice === 2) {
          celula.style.color = tag.good && (resultado.fase === 'nivel-alto' ? tag.value === tag.esperado : tag.value) ? '#237326' : '#aa2424'
          celula.style.fontWeight = 'bold'
        }
        linha.append(celula)
      })
      tabela.append(linha)
    }
    grade.append(tabela)
  }
  return paginas
}

function mostrarMonitor(codigo) {
  return cy.document({ log: false }).then(documento => { montarPainel(documento, codigo) })
}

function informarResultado(resultado, pagina = 0) {
  return cy.document({ log: false }).then(documento => renderizar(documento, resultado, pagina))
}

function ocultarMonitor() {
  return cy.document({ log: false }).then(documento => { documento.getElementById(painelId)?.remove() })
}

module.exports = { montarPainel, renderizar, mostrarMonitor, informarResultado, ocultarMonitor }
