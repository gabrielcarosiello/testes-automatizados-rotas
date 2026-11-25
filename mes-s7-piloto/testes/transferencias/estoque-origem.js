async function conferirEstoqueOrigem(origem, consultarSilo) {
  let silos
  try {
    silos = await consultarSilo(origem)
  } catch {
    return { estado: 'inconclusivo', detalhe: 'Consulta SQL de estoque indisponível para a origem ' + origem + '.' }
  }
  if (!silos.length) return { estado: 'sem-cadastro' }
  const peso = silos[0].val_peso_estoque
  if (silos.length !== 1 || !Number.isFinite(peso) || peso < 0) {
    return { estado: 'inconclusivo', detalhe: 'Estoque sem confirmação para a origem ' + origem + '.' }
  }
  if (peso === 0) return {
    estado: 'vazio', detalhe: 'Silo de origem ' + origem + ' vazio (estoque 0 kg). A transferência não pode ser iniciada.',
  }
  return { estado: 'com-estoque' }
}

module.exports = { conferirEstoqueOrigem }
