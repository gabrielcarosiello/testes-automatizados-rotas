# Validação do encerramento MES + S7 no Windows

O procedimento de recuperação operacional está no [Manual de operação](../../MANUAL_OPERACAO.md#10-recuperar-escrita-pendente).

## Ocorrência de 23/11/2026

1. Às 09:43, a rota 179 (RG37 para MG14) chegou a Iniciado. O Monitor confirmou a escrita da LSH antes de o Windows recusar o rename de escrita-pendente.json. A evidência do afterEach registrou a restauração para o valor original. O cartão permaneceu no MES e a etapa normal de parada não foi alcançada.
2. Na execução iniciada às 10:17, 45 rotas falharam em **Verificar transferência ativa**. O bloqueio ocorreu antes de o piloto iniciar qualquer uma dessas rotas. As rotas 703 e 704 tiveram um erro distinto com o botão Iniciar desabilitado.
3. A primeira ocorrência por local agora registra nome e situação do cartão e o código da rota bloqueada. As rotas seguintes daquele local são marcadas como puladas no Cypress antes da validação da LIR. Outros locais continuam sujeitos às próprias verificações de preparação.
4. Se uma rota que chegou a Iniciado falhar antes de enviar Parar, o afterEach pode parar uma vez o mesmo cartão observado, após confirmar a restauração da LSH ou que ela era desnecessária. A saída exige confirmação de local vazio. Se o cartão tiver mudado, houver ambiguidade ou já houver uma tentativa, o bloqueio é mantido até o MES confirmar o encerramento.
5. A persistência confirma a intenção antes do POST. A atualização para confirmada é atômica e as novas tentativas se limitam ao rename. O registro anterior e o temporário são preservados se a substituição falhar.

## Demonstração no terminal do VS Code

Execute na raiz do projeto, com as dependências do Piloto e do Monitor instaladas.

```powershell
# 1. Preparação com local ativo, sem comando Parar.
node --test mes-s7-piloto/testes/transferencias/seguranca-cartoes.test.js

# 2. Intenção, escrita simulada, falha de persistência e restauração.
node --test mes-s7-piloto/comum/s7/estado-escrita.test.js mes-s7-piloto/comum/s7/nivel-alto.test.js

# 3. Primeira parada após falha, ausência de repetição e confirmação de local vazio.
node --test mes-s7-piloto/comum/recuperar-encerramento.test.js mes-s7-piloto/comum/cartoes-mes.test.js

# 4. Suíte completa.
node verificar-tudo.cjs
```

No Windows, passaram 4 testes de preparação, 19 de persistência e 27 de encerramento nos grupos individuais. A suíte completa teve 152 aprovações, com 124 do Piloto, 25 do Monitor e 3 de integração simulada. A validação de arquivos ocorreu no Windows local. O MES e o CLP foram simulados.

Para validar em bancada, o operador deve primeiro identificar e encerrar a transferência que já estava ativa e confirmar que o local ficou livre. Confira a LSH no valor original e arquive eventual pendência conforme o manual. Em seguida, execute uma única rota autorizada, acompanhe a confirmação de Iniciado, a restauração e a confirmação de local vazio no MES. Registre os eventos antes de retomar o lote.

## Recusa de partida por nível alto em RG11

Na rota 169, o MES apresentou um aviso de recusa por nível alto no destino RG11. O piloto reconhece as duas frases mesmo quando o aviso aparece em linhas separadas, captura a mensagem e confirma OK. A rota é registrada como partida recusada. As próximas rotas só são liberadas quando o MES confirma que o local está vazio e não há restauração pendente. A regressão reproduz esse fluxo no DOM simulado do Cypress.

## Rearme após recusa de partida no PLCSIM 6.0

A opção `nivelAlto.rearmarRecusaPlcsim: true` em `s7.local.json` declara que o Monitor está conectado à CPU do PLCSIM. A opção vem desativada e exige MES + S7, ensaio de nível alto e escrita da LSH habilitados. O Monitor usa o mesmo protocolo S7 para a CPU simulada, então confirme a instância configurada antes de ativar a opção.

Após a recusa por nível alto no MES, o piloto preserva a captura e o evento da primeira partida e confirma que o local está vazio. Se a LSH estiver em nível alto, grava a intenção, solicita uma única escrita para o valor normal e confirma por releitura que a LSH, Alm e Aviso normalizaram. Se todos os sinais já estiverem normais, a tentativa segue sem escrita. Se a LSH já estiver normal e Alm ou Aviso permanecer ativo, a rota falha e a origem do alarme precisa ser verificada. A nova tentativa repete a preparação da mesma rota. Uma nova recusa encerra o teste sem outro rearme.

Se restar uma pendência do tipo `rearme-plcsim`, o valor normal a confirmar é o campo `destino`. Siga a seção de recuperação do manual antes de liberar o piloto. Se a preparação S7 barrar a rota antes da tentativa de partida no MES, confira o destino na bancada e libere-o antes de reexecutar.

Validação no Windows com MES e S7 simulados. Passaram 158 testes, incluindo escrita única, normalização sem escrita quando os sinais já estão normais, alarme ativo com LSH normal, perda de resposta e opção desativada.

## Transferência interrompida por impedimento de equipamento

Na execução da rota 704, ME06 e ME32 ficaram sem confirmação de retorno no S7. Na VM, o cartão 12137 de ME29 para ME07 aparecia como Interrompido, com Parar desabilitado e Limpar habilitado. Mais Informações exibia apenas a rota.

No modo MES + S7, o piloto reconhece um cartão Interrompido da rota em teste antes da partida ou na finalização. Exige cartão único, número da transferência, origem e destino correspondentes, Parar indisponível e Limpar habilitado. A situação dos equipamentos vem dos DBs vinculados à rota pelo SQL e dos campos com endereço confirmado no catálogo TIA. O Monitor faz a consulta em conexão de leitura separada. O painel mantém seu mapeamento.

O diagnóstico procura campos de estado, emergência, manutenção, suspensão, falha e bloqueio. Campos específicos do projeto podem ser acrescentados pela lista opcional `camposDiagnosticoEquipamentos` em `s7.local.json` com os nomes completos do catálogo. Códigos numéricos são gravados com o valor lido. A coluna Detalhes do histórico Rev 00 identifica o equipamento, o DB e os campos lidos, além de listar separadamente os retornos S7 que ficaram sem confirmação.

Antes de Limpar, o piloto grava o impedimento no log e relê o cartão para confirmar o mesmo número de transferência. Um diagnóstico incompleto mantém o cartão para conferência. Após a limpeza, a rota permanece com resultado Falhou. As próximas rotas seguem somente quando o MES confirma o local vazio.

Reinicie o Monitor S7 na VM após atualizar o projeto, para disponibilizar a leitura de diagnóstico. A suíte de 167 testes passou no Windows com MES e S7 simulados. A leitura dos endereços de diagnóstico do catálogo CL373.01 no PLCSIM ainda precisa ser conferida na VM.
