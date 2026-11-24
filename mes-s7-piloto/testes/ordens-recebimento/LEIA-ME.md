# Criação de ordens de recebimento

No Cypress principal, abra E2E Testing → Specs e selecione nova-ordem.ordem.js. O primeiro ensaio acessa Movimentação → Ordem Recebimento → Adicionar, preenche lote e placa gerados para a simulação, libera a ordem, verifica Adicionar item e salva uma captura em resultados/ordens-recebimento.

Cada execução que concluir Liberar cria um novo cabeçalho de ordem. A próxima etapa é confirmar o número gerado e incluir um item de milho, produto 2, usando os valores de referência registrados no levantamento. Verifique a disponibilidade em Receber Granel e confirme o cabeçalho e o item via SQL. Depois de validar uma criação, amplie para cinco ordens e registre os números gerados para associá-los às rotas da LIR.

O fluxo usa a URL e as credenciais locais já usadas pelo Piloto. O spec de cadastro não chama tarefas S7. A configuração dedicada continua disponível para abrir somente esse cadastro.
