'use strict'
const normalizar = valor => String(valor ?? '').replace(/\s+/g, ' ').trim()
const foraPainel = el => !el.closest('#integracao-visualizacao-s7')
function comandos(linha, texto, visivel) {
  return [...linha.querySelectorAll('button')].filter(el => foraPainel(el) && visivel(el) && normalizar(el.textContent) === texto)
}
function temIndicadores(linha, visivel) {
  return [...linha.querySelectorAll('.card-situations')].some(el => foraPainel(el) && visivel(el)) || comandos(linha, 'Parar', visivel).length || comandos(linha, 'Limpar', visivel).length
}
function lerSituacoes(linha, visivel) {
  return [...linha.querySelectorAll('.card-situations')].filter(el => foraPainel(el) && visivel(el))
    .map(el => {
      const copia = el.cloneNode(true)
      copia.querySelectorAll('svg, [aria-hidden=true], i[class*=fa-], i[class*=icon], .material-icons, .material-symbols-outlined').forEach(icone => icone.remove())
      return normalizar(copia.textContent)
    }).filter(texto => texto && texto !== '+' && texto !== '＋')
}
function lerCartoes(documento, visivel, nomeEsperado = null) {
  const candidatos = [...documento.querySelectorAll('.row > :nth-child(1) > :nth-child(2)')]
  // Se o MES mudou a posição do nome no cartão, procurar o texto exato dentro de uma row.
  if (nomeEsperado) candidatos.push(...[...documento.body.querySelectorAll('*')].filter(el =>
    normalizar(el.textContent) === normalizar(nomeEsperado) && ![...el.children].some(c => normalizar(c.textContent) === normalizar(nomeEsperado))))
  const registros = new Map()
  for (const elemento of candidatos) {
    if (!foraPainel(elemento) || !visivel(elemento)) continue
    if (elemento.closest('form, .custom-dropdown, .dropdown-menu, .form-select, [role=listbox], [role=combobox]')) continue
    const linha = elemento.closest('.row')
    if (!linha || !temIndicadores(linha, visivel)) continue
    const nome = normalizar(elemento.textContent)
    if (!nome || elemento.querySelector('input, select, .custom-dropdown, .form-select')) continue
    const possuiEstado = [...linha.querySelectorAll('.card-situations')].some(el => visivel(el))
    const possuiParar = comandos(linha, 'Parar', visivel).length > 0
    // Limpar no formulário não é um cartão de transferência.
    if (!possuiEstado && !possuiParar && linha.querySelector('input, select, .custom-dropdown, .form-select')) continue
    if (nomeEsperado && nome !== normalizar(nomeEsperado)) continue
    const chave = linha
    if (registros.has(chave)) {
      if (registros.get(chave).nome !== nome) registros.get(chave).ambiguo = true
      continue
    }
    registros.set(chave, { nome, linha, botoes: comandos(linha, 'Parar', visivel), limpar: comandos(linha, 'Limpar', visivel), situacoes: lerSituacoes(linha, visivel).length, textosSituacoes: lerSituacoes(linha, visivel) })
  }
  return [...registros.values()]
}
function diagnosticarLocal(documento, visivel) {
  const mensagem = [...documento.body.querySelectorAll('*')].some(el => foraPainel(el) && visivel(el) && normalizar(el.textContent) === 'Não há nenhuma transferência em uso')
  const cartoes = lerCartoes(documento, visivel)
  const estados = lerSituacoes(documento, visivel).length
  const parar = [...documento.querySelectorAll('button')].filter(el => foraPainel(el) && visivel(el) && normalizar(el.textContent) === 'Parar').length
  const dialogos = [...documento.querySelectorAll('dialog[open], [role=dialog], [aria-modal=true], .modal.show')].filter(el => visivel(el)).length
  const botoes = [...documento.querySelectorAll('button')].filter(el => foraPainel(el) && visivel(el)).map(el => normalizar(el.textContent))
  const confirmacao = botoes.some(texto => ['OK', 'Sim', 'Não'].includes(texto))
  return { mensagem, cartoes, estados, parar, dialogos, confirmacao,
    vazio: mensagem && !cartoes.length && !estados && !parar && !dialogos && !confirmacao }
}
function confirmarVazio(documento, visivel) { return diagnosticarLocal(documento, visivel).vazio }

function estadoRecuperacao(documento, visivel, nome) {
  if (confirmarVazio(documento, visivel)) return { livre: true, detalhe: 'Ausência de transferência confirmada no MES após a falha.' }
  const cartoes = lerCartoes(documento, visivel, nome)
  return { livre: false, detalhe: cartoes.length === 1 && !cartoes[0].ambiguo ? 'A transferência ainda possui cartão/comandos no MES; nova parada não será repetida automaticamente.' : 'Estado da transferência ausente, ambíguo ou ainda em renderização; encerramento não confirmado.' }
}
module.exports = { lerCartoes, confirmarVazio, estadoRecuperacao, diagnosticarLocal, lerSituacoes }
