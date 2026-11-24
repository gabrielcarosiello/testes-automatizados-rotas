# Criação de ordens de recebimento

No Cypress principal, abra E2E Testing → Specs e selecione nova-ordem.ordem.js. Cada execução libera uma ordem na simulação com lote e placa aleatórios, cadastra um produto por cenário de cenarios.json e informa 1000 kg por padrão em Peso Total NF e um lote aleatório em Lote Fornecedor na linha do produto. Os demais campos usam os valores já exibidos pelo MES.

O spec salva o item e o cabeçalho, volta para a listagem, verifica o número gerado na coluna Recebimento. O produto é conferido na grade de itens antes de voltar e grava a captura. A confirmação da disponibilidade em Receber Granel e a ampliação para cinco ordens ficam para a próxima etapa.

O cadastro reutiliza o acesso local ao MES e roda na configuração principal ou na dedicada.

Cada execução grava etapas e resultado em resultados/Ordem_Recebimento_*/eventos.jsonl. O registro informa o número assim que o MES o atribui. O spec solicita uma captura de sucesso ou falha no Cypress, mesmo quando a conferência da lista falha.

Cada registro de cenarios.json define um identificador único, o código exibido pelo MES e o nome usado na busca. O pesoTotalNfKg pode ser definido se o cenário exigir outro peso. Milho CG Moído e Farelo de Soja CG Moído são candidatos do catálogo para a validação inicial. O vínculo com uma fórmula específica de Dosagem será confirmado na seleção do lote.

Os eventos de resultado registram o item e se a ordem foi conferida na listagem. A seleção automática no Recebimento será desenvolvida na etapa seguinte.

O spec nova-ordem.ensacados.js reutiliza o cadastro completo, com Ensacados marcado antes de Liberar. Os produtos ficam em cenarios-ensacados.json. MICRO é o cenário inicial para validar a criação da OR. O destino e o fluxo operacional do MICRO serão confirmados separadamente.

Para Ensacados, cenarios-ensacados.json define quantidade e pesoUnitarioKg. O caso inicial usa 10 unidades de 25 kg. Quantidade Disponível deve ficar igual à quantidade. O MES calcula Peso Total NF e o spec verifica o valor salvo, esperado em 250 kg. O lote do produto continua aleatório.

Cadastro completo de Ensacados: o cenário define o fornecedor existente e a validade em dias. O spec gera NF de teste, fabricação na data da execução e validade calculada. Confere esses campos e os valores do item após salvar. Peso Total NF, peso disponível quando calculado e situação continuam sob controle do MES.
