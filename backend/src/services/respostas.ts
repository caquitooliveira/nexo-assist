import type { PrismaClient } from '@prisma/client'
import { criarNexoAgent } from '../agente/nexoAgent'

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

  const historico = conversa.mensagens.map((mensagem) => ({
    role:
      mensagem.autor === 'FUNCIONARIO'
        ? ('user' as const)
        : ('assistant' as const),
    content: mensagem.texto,
  }))

  const agente = criarNexoAgent(prisma, usuarioId)

  const sinal = AbortSignal.timeout(60_000)

  const resultado = await agente.generate(historico, {
   maxSteps: 5,
   abortSignal: sinal,
   modelSettings: {
    maxRetries: 0,
    maxOutputTokens: 1024,
  },
})

sinal.throwIfAborted()

  const texto = resultado.text.trim()

  if (!texto) {
    throw new Error('O agente não retornou uma resposta.')
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
        texto,
      },
    })

    await transacao.conversa.update({
      where: { id: conversaId },
      data: { atualizadoEm: new Date() },
    })

    return mensagem
  })
}