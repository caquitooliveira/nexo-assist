# Nexo Assist

Assistente de service desk de TI construído para o desafio prático. O funcionário conversa com um agente, consulta artigos e chamados, revisa rascunhos e confirma a criação, complementação ou reabertura. Um analista pode assumir a conversa, responder, devolver ao agente ou encerrar.

## Executar localmente

Requisitos: Node.js 22.22.3 ou superior, npm e uma chave do Google Gemini com acesso ao modelo configurado. Os arquivos de dependências estão versionados para instalação com `npm ci`.

No PowerShell, a partir da pasta do repositório:

```powershell
cd backend
Copy-Item .env.example .env
npm ci
```

Edite `backend/.env`: preencha `GOOGLE_API_KEY` e substitua `JWT_SECRET` por um segredo local. Não publique esse arquivo. `DATABASE_URL="file:./dev.db"` cria o SQLite em `backend/prisma/dev.db`.

```powershell
npm run db:setup
npm run dev
```

Em outro terminal, a partir da pasta do repositório:

```powershell
cd frontend
npm ci
npm run dev
```

Abra a URL exibida pelo Vite, normalmente http://localhost:5173. A API usa http://localhost:3000; verifique http://localhost:3000/health. A interface está configurada para essa porta. Se alterar a porta do backend, atualize também as URLs da interface.

### Acessos de demonstração

| E-mail | Papel |
| --- | --- |
| ana.souza@nexo.com.br | Funcionária |
| bruno.tavares@nexo.com.br | Funcionário |
| carla.mendes@nexo.com.br | Funcionária |
| rafael.lima@nexo.com.br | Analista |

Qualquer senha preenchida é aceita, conforme o desafio. O servidor identifica o papel salvo no banco; o frontend direciona o analista para `/analista` e os demais para `/atendimento`. Isso é autenticação de demonstração, não login para produção.

O seed cadastra usuários, seis artigos e chamados variados. Ele atualiza usuários/artigos, mas preserva chamados já existentes para não apagar o andamento da demonstração. Os exemplos de datas são relativos à primeira execução; para uma demonstração em banco limpo, use outro arquivo SQLite e aplique migrations/seed. Não apague um banco com dados que queira preservar.

## Arquitetura

- `frontend/src/pages`: login, chat do funcionário e console do analista.
- `frontend/src/components`: rascunho, edição, revisão de possíveis duplicidades, cards de chamado e mensagens formatadas.
- `backend/src/agente`: agente Mastra, ferramentas e schema Zod da decisão.
- `backend/src/services`: regras de prioridade/prazo, artigos, chamados, confirmação e atendimento humano. O agente chama serviços; não recebe Prisma nem SQL como ferramenta pública.
- `backend/src/routes/analista.ts`: endpoints protegidos pelo papel do usuário no banco.
- `backend/prisma`: schema, migrations e dados iniciais.

React + Vite mantêm a interface simples; Express concentra autenticação e operações. Prisma + SQLite permitem executar localmente sem instalar um servidor de banco. Mastra integra o modelo e as ferramentas. TypeScript estrito é usado no frontend e backend.

### Como o agente decide

O agente recebe o histórico da conversa e ferramentas limitadas ao usuário autenticado. Para dúvidas, busca os artigos; para chamados, consulta somente os do funcionário. Quando faltam informações, pergunta. Para criar ou complementar, prepara um rascunho com os dados informados.

A resposta inclui texto, entendimento, justificativa curta, autoavaliação qualitativa de segurança, impacto/urgência e eventual chamado relacionado. O servidor valida o schema e aplica as regras de encaminhamento. Essa justificativa é uma explicação resumida para auditoria, não uma exposição do raciocínio interno do modelo.

O modelo padrão é configurável em `GOOGLE_MODEL` (padrão `gemini-3.5-flash-lite`). Foi escolhido pela integração com ferramentas e custo/latência esperados para mensagens curtas. A disponibilidade depende da conta/provedor. O uso tem limite de cinco etapas, saída de até 1536 tokens e tempo total de 60 segundos. Não há repetição automática ilimitada de requisições pagas.

### Regras garantidas por código

- Prioridade: equipe/empresa parada → crítica; pessoa parada ou compromisso hoje → alta; com alternativa → média; sem urgência → baixa.
- Prazos: crítica 1 hora corrida; alta 4 horas úteis; média 30 horas úteis; baixa 50 horas úteis. Expediente assumido: segunda a sexta, 8h–18h de Brasília (UTC−3), sem feriados. Assim, um dia útil equivale a dez horas. O prazo é contado desde a última atualização; resolvidos não ficam vencidos.
- Rascunho não cria chamado. A confirmação usa transação, versão do rascunho e do chamado e recibo único para evitar repetição da operação.
- Possíveis duplicidades são candidatos da mesma categoria e tipo, pertencentes ao funcionário. A interface exige revisão; o funcionário pode complementar um existente ou declarar que é outro problema. Essa abordagem favorece revisão humana, mas não garante equivalência semântica perfeita.
- Só é permitida reabertura de resolvidos há até sete dias.
- Encaminhamento: pedido humano, equipe/empresa parada, chamado relacionado vencido ou baixa segurança. A extração da intenção depende do modelo; o prazo e a propriedade do chamado são verificados no servidor.
- Após encaminhamento, o estado é persistido e o agente fica pausado. Somente o analista responsável responde. Retorno e encerramento são transições condicionais no banco.
- Limite: 30 mensagens do funcionário por conversa persistida; mensagens do agente, sistema e analista não entram na contagem.
- Consultas e alterações do funcionário são filtradas pelo usuário do JWT. O analista tem acesso operacional às conversas encaminhadas e aos chamados do respectivo solicitante.

### Atualização e falhas

O envio do chat usa um fluxo NDJSON: primeiro confirma a mensagem salva, depois informa ferramentas concluídas e finalmente entrega a resposta validada. **O texto final chega completo; não há streaming token a token.** Chamadas sem esse cabeçalho continuam recebendo JSON. A sincronização entre funcionário e analista usa polling a cada quatro segundos.

Se o provedor de IA falhar, a mensagem do funcionário continua salva. O botão “Tentar responder novamente” pede uma resposta para a mensagem pendente, sem reenviá-la. Se a conexão cair, recarregue e confira o histórico antes de reenviar. Há trava de geração por conversa em um único processo; ela não é uma fila distribuída.

Para simular o legado indisponível, altere `CHAMADOS_TAXA_FALHA` no `.env` e reinicie o backend:

- `0`: serviço estável, padrão para demonstração.
- `0.15`: probabilidade de falha de 15% por acesso, com janela mínima de três segundos.
- `1`: indisponibilidade forçada para testar erros.

A simulação ocorre antes de consultar ou confirmar chamados e não faz alterações parciais. Falhas devem ser apresentadas como falhas, nunca como uma operação realizada. Volte a `0` e reinicie para continuar a demonstração.

## Verificação

```powershell
cd backend
npm run check
npm test
```

```powershell
cd frontend
npm run build
npm run lint
```

Os testes usam um banco temporário e aplicam as migrations. Cobrem prazos, reabertura dentro/fora da janela, confirmação repetida, isolamento entre funcionários, versão desatualizada, transferência e autorização do responsável, limite de mensagens e indisponibilidade sem gravação parcial. As regras determinísticas de encaminhamento são testadas sem consumo de API; isso não substitui validar a classificação do LLM em uma conversa real.

### Roteiro de demonstração

1. Entre como Ana e pergunte o horário do service desk: deve consultar a central e citar o horário do artigo.
2. Pergunte sobre VPN erro 809 no Windows 11: o artigo indica suporte; não deve inventar alterações no registro.
3. Como Bruno, solicite VS Code, somente para você, sem urgência. Revise/edite o rascunho e confirme. Repita uma confirmação para verificar que não duplica.
4. Solicite complemento de um chamado aberto. Revise os candidatos, selecione o existente e confirme.
5. Peça um analista, ou relate a equipe inteira parada. Entre como Rafael, assuma, responda e confira a mensagem na conta do funcionário. Devolva ou encerre.
6. Consulte chamados com outro funcionário e confira o isolamento.
7. Reinicie os servidores e confira persistência do histórico e do estado de atendimento.
8. Force a falha do serviço de chamados e confira que o sistema não afirma ter concluído a operação.

## Limitações e próximos passos

O projeto foi organizado para execução local em um único backend. Não inclui deploy, autenticação corporativa real, cadastro administrativo ou alteração de status de tickets pelo analista; o console gerencia o estado da conversa. Busca de artigos usa termos normalizados, sem embeddings. As opções rápidas são sugestões para preencher a mensagem, sem envio automático. Decisões probabilísticas do LLM exigem avaliação com exemplos reais e não são garantidas apenas pelas instruções.

Com mais tempo: ampliar testes de integração HTTP e avaliações do agente, substituir polling por eventos, oferecer streaming do texto validado por uma estratégia própria, melhorar busca semântica, monitorar custo/latência e usar fila/banco apropriados a múltiplas instâncias. Antes de qualquer deploy público: autenticação real, restrição de origem, limite de requisições/custo e remoção de segredos eventualmente existentes no histórico Git.

## Uso de IA

Ferramentas de IA foram usadas no desenvolvimento e na revisão do código. As escolhas principais estão descritas acima para permitir discutir regras, falhas e limitações na entrevista.
