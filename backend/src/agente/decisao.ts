import { z } from 'zod'

export const decisaoSchema = z.object({
  texto: z.string().min(1).describe(
    'Resposta final ao funcionário, em português e baseada nas ferramentas.',
  ),

  entendimento: z.string().min(1).max(500).describe(
    'Resumo objetivo da solicitação atual do funcionário.',
  ),

  justificativa: z.string().min(1).max(800).describe(
    'Explicação curta baseada nas informações consultadas ou nas informações que faltam. Não apresente raciocínio interno.',
  ),

  seguranca: z.enum(['ALTA', 'MEDIA', 'BAIXA']).describe(
    'ALTA quando os dados atendem diretamente ao caso; MEDIA quando é necessário esclarecer informações; BAIXA quando não há segurança para decidir. Não representa probabilidade de acerto.',
  ),

  assuntoTi: z.boolean().describe(
    'Indica se a solicitação atual pertence a TI, incluindo o funcionamento do service desk.',
  ),

  solicitouAnalista: z.boolean().describe(
    'Verdadeiro somente quando o funcionário pede atendimento humano na solicitação atual. Não use pedidos antigos já atendidos.',
  ),

  impacto: z.enum([
    'UMA_PESSOA',
    'EQUIPE',
    'EMPRESA',
    'NAO_INFORMADO',
  ]).describe(
    'Impacto informado para o problema atual. Não presuma a quantidade de pessoas afetadas.',
  ),

  urgencia: z.enum([
    'PARADO',
    'COMPROMISSO_HOJE',
    'COM_ALTERNATIVA',
    'SEM_URGENCIA',
    'NAO_INFORMADA',
  ]).describe(
    'Situação informada para o problema atual. PARADO significa trabalho impedido. Quando não estiver claro, use NAO_INFORMADA e pergunte.',
  ),

  chamadoRelacionadoId: z.string().nullable().describe(
    'ID real do chamado consultado relacionado à solicitação atual. Use null quando não houver um chamado específico relacionado. Não invente IDs nem associe chamados de outro assunto.',
  ),
})

export type DecisaoAgente = z.infer<typeof decisaoSchema>