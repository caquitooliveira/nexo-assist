import { z } from 'zod'

export const decisaoSchema = z.object({
  texto: z.string().min(1).describe(
    'Resposta final ao funcionário, em português e baseada nas ferramentas.',
  ),

  entendimento: z.string().min(1).max(500).describe(
    'Resumo objetivo do que o funcionário está solicitando.',
  ),

  justificativa: z.string().min(1).max(800).describe(
    'Explicação curta da decisão, citando as informações consultadas ou as informações que faltam. Não apresente raciocínio interno.',
  ),

  seguranca: z.enum(['ALTA', 'MEDIA', 'BAIXA']).describe(
    'Autoavaliação qualitativa: ALTA quando os dados consultados atendem diretamente ao caso; MEDIA quando faltam informações e é necessário perguntar; BAIXA quando há ambiguidade ou falta de evidências. Não representa probabilidade de acerto.',
  ),
})