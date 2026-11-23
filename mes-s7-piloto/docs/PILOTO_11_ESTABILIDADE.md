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
