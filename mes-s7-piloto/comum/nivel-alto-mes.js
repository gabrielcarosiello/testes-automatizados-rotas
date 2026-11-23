const normalizar = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase()
function statusNivelNoMes(documento, nome, esperado, visivel) {
  const nomes = [...documento.querySelectorAll('.row > :nth-child(1) > :nth-child(2)')].filter(el => normalizar(el.textContent) === normalizar(nome) && visivel(el))
  if (nomes.length > 1) throw new Error('Mais de um cartão da transferência durante o teste de nível alto.')
  if (!nomes.length) return null
  const estados = [...nomes[0].closest('.row').querySelectorAll('.card-situations')].filter(visivel)
  if (estados.some(el => normalizar(el.textContent) === 'iniciado')) return null
  const encontrados = estados.filter(el => normalizar(el.textContent) === normalizar(esperado))
  if (encontrados.length > 1) throw new Error('Status de nível alto ambíguo no MES.')
  return encontrados[0]?.textContent.trim() || null
}
function acompanharNivelAlto(rota, informarResultado) {
  return cy.task('consultarNivelAltoS7', null, { timeout: 10000 }).then(resultado => {
    const falhou = resultado.concluido && !resultado.ok
    if (falhou && !resultado.confirmadoClp) throw new Error(resultado.detalhe)
    if (!falhou) informarResultado(resultado)
    return cy.document({ log: false }).then(doc => {
      const statusMes = statusNivelNoMes(doc, rota.nome, resultado.statusMes, el => Cypress.dom.isVisible(el))
      if (falhou) {
        if (statusMes) throw new Error(resultado.detalhe)
        throw new Error(
          `Nível alto confirmado no CLP e não confirmado no MES para a rota ${rota.codigo} (${rota.origem} → ${rota.destino}). ` +
          `Validar a FC do transporte correspondente à transferência "${rota.nome}", caminho "${rota.rota}", e a geração do alarme de nível alto enviado ao MES.`
        )
      }
      if (resultado.ok && statusMes) return cy.task('confirmarNivelAltoMesS7', { statusMes })
      return cy.wait(resultado.intervaloConsultaMs, { log: false }).then(() => acompanharNivelAlto(rota, informarResultado))
    })
  })
}
module.exports = { statusNivelNoMes, acompanharNivelAlto }
