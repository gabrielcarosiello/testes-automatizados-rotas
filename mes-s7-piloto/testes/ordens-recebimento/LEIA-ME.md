# Criação de ordens de recebimento

No Cypress principal, abra E2E Testing → Specs e selecione nova-ordem.ordem.js. Cada execução libera uma ordem na simulação com lote e placa aleatórios, cadastra um produto por cenário de cenarios.json e informa 1000 kg por padrão em Peso Total NF e um lote aleatório em Lote Fornecedor na linha do produto. Os demais campos usam os valores já exibidos pelo MES.

O spec salva o item e o cabeçalho, volta para a listagem, verifica o número gerado na coluna Recebimento. O produto é conferido na grade de itens antes de voltar e grava a captura. A confirmação da disponibilidade em Receber Granel e a ampliação para cinco ordens ficam para a próxima etapa.

O cadastro reutiliza o acesso local ao MES e roda na configuração principal ou na dedicada.

Cada execução grava etapas e resultado em resultados/Ordem_Recebimento_*/eventos.jsonl. O registro informa o número assim que o MES o atribui. O spec solicita uma captura de sucesso ou falha no Cypress, mesmo quando a conferência da lista falha.

Cada registro de cenarios.json define um identificador único, o código exibido pelo MES e o nome usado na busca. O pesoTotalNfKg pode ser definido se o cenário exigir outro peso. Milho CG Moído e Farelo de Soja CG Moído são candidatos do catálogo para a validação inicial. O vínculo com uma fórmula específica de Dosagem será confirmado na seleção do lote.

Os eventos de resultado registram o item e se a ordem foi conferida na listagem. A seleção automática no Recebimento será desenvolvida na etapa seguinte.
