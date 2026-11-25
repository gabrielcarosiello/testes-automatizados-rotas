# Reaproveitamento para novos processos

| Etapa | Recursos já usados | Conferência do processo novo |
| --- | --- | --- |
| Configuração | [Configuração local](../../../../mes-s7-piloto/comum/execucao.js) e [credenciais MES](../../../../mes-s7-piloto/comum/credenciais-mes.js), usadas pelas configurações Cypress. | Confirmar acesso e ponto de entrada. Manter a senha restrita ao login. |
| Cenário e identidade | [Cenários de produto](../../../../mes-s7-piloto/testes/ordens-recebimento/cenarios.json), [ordens confirmadas](../../../../mes-s7-piloto/testes/recebimentos/ordens-confirmadas.js) e [leitura da LIR](../../../../mes-s7-piloto/testes/recebimentos/lir-recebimento.js). | Definir os identificadores próprios e validar a origem dos dados. Para Dosagem, levantar fórmula, insumos, silos, quantidades e tolerâncias. |
| Formulário e cartão | [Consulta de elementos](../../../../mes-s7-piloto/comum/consultas-mes.js) e [formulário de Recebimento](../../../../mes-s7-piloto/testes/recebimentos/formulario-recebimento.js). | Conferir campos antes de iniciar. Identificar o cartão pelo registro do processo e validar os textos dos diálogos na VM. |
| S7, encerramento e retomada | [Piloto S7](../../../../mes-s7-piloto/comum/s7/piloto.js), [painel S7](../../../../mes-s7-piloto/comum/visualizacao-monitor.js) e [estado da escrita](../../../../mes-s7-piloto/comum/s7/estado-escrita.js). | Mapear sinais e permissivos próprios. Se houver atuação, preservar persistência, releitura e restauração. Confirmar identidade e estado antes de repetir um comando. |
| Evidência | [JSONL reutilizado](../../../../mes-s7-piloto/comum/registro-execucao.js) pelo [cadastro](../../../../mes-s7-piloto/testes/ordens-recebimento/evidencias.js) e pelas tarefas de Recebimento e Transporte. | Registrar identidade, etapa, erro e captura na pasta compartilhada. Se Cypress Tap não enxergar a sessão na VM, diagnosticar pelos arquivos antes de repetir a operação. |

Valide primeiro seleção, depois um ciclo completo e por fim o segundo cenário e a retomada. Use os dados de cenário para variar produtos, ordens e destinos. Distinga o que foi observado no código, coberto em regressão local ou confirmado na VM.

Todo novo teste operacional deve aplicar o procedimento de evidência do [Piloto](../SKILL.md) e prever o caso de falha antes da primeira ação no MES.

Crie regressões locais na pasta do processo em `mes-s7-piloto/regressao/`, conforme a [skill do Piloto](../SKILL.md). As specs operacionais continuam em `mes-s7-piloto/testes/`.

Para integrar fases, use uma entrega baseada em confirmação do processo de origem. O Recebimento registra esse resultado conforme R08 na [matriz](matriz-processos.md). A confirmação de estoque para a próxima fase deve usar leitura atual.
