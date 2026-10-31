import type { PrismaClient } from '@prisma/client'
import { decisaoSchema } from '../agente/decisao'
import {
  criarNexoAgent,
  type RegistroAcao,
} from '../agente/nexoAgent'

export async function responderConversa(
  prisma: PrismaClient,
  usuarioId: string,
  conversaId: string,
) {
  const conversa = await prisma.conversa.findFirst({
    where: {
      id: conversaId,
      usuarioId,
      status: 'COM_AGENTE',
    },
    include: {
      mensagens: {
        orderBy: { criadoEm: 'asc' },
      },
    },
  })

  if (!conversa) {
    return null
  }

  const historico = conversa.mensagens.map((mensagem) => {
    if (mensagem.autor === 'FUNCIONARIO') {
      return {
        role: 'user' as const,
        content: mensagem.texto,
      }
    }

    return {
      role: 'assistant' as const,
      content: mensagem.texto,
    }
  })

  const acoes: RegistroAcao[] = []

  const agente = criarNexoAgent(
  prisma,
  usuarioId,
  (acao) => {
    acoes.push(acao)
  },
  conversaId,
)

  const sinal = AbortSignal.timeout(60_000)

  const resultado = await agente.generate(historico, {
    maxSteps: 5,
    abortSignal: sinal,
    modelSettings: {
      maxRetries: 0,
      maxOutputTokens: 1024,
    },
    structuredOutput: {
      schema: decisaoSchema,
      jsonPromptInjection: true,
      errorStrategy: 'strict',
    },
  })

  sinal.throwIfAborted()

  if (resultado.finishReason === 'aborted') {
    throw new Error('A geração da resposta foi cancelada.')
  }

  const decisao = decisaoSchema.parse(resultado.object)

  if (!decisao.texto.trim()) {
    throw new Error('O agente não retornou uma resposta completa.')
  }

  return prisma.$transaction(async (transacao) => {
    const conversaAtual = await transacao.conversa.findFirst({
      where: {
        id: conversaId,
        usuarioId,
        status: 'COM_AGENTE',
      },
    })

    if (!conversaAtual) {
      return null
    }

    const mensagem = await transacao.mensagem.create({
      data: {
        conversaId,
        autor: 'ASSISTENTE',
        texto: decisao.texto.trim(),
        entendimento: decisao.entendimento,
        justificativa: decisao.justificativa,
        seguranca: decisao.seguranca,
        acoes: {
          create: acoes,
        },
      },
      include: {
        acoes: {
          orderBy: { criadoEm: 'asc' },
        },
      },
    })

    await transacao.conversa.update({
      where: { id: conversaId },
      data: { atualizadoEm: new Date() },
    })

    return mensagem
  })
}