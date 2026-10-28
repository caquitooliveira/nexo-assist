import type { PrismaClient } from '@prisma/client'

const LIMITE_MENSAGENS = 30

export async function obterOuCriarConversa(
  prisma: PrismaClient,
  usuarioId: string,
) {
  const conversaExistente = await prisma.conversa.findFirst({
    where: {
      usuarioId,
      status: { not: 'ENCERRADA' },
    },
    orderBy: { atualizadoEm: 'desc' },
    include: {
      mensagens: {
        orderBy: { criadoEm: 'asc' },
      },
    },
  })

  if (conversaExistente) {
    return conversaExistente
  }

  return prisma.conversa.create({
    data: {
      usuarioId,
      status: 'COM_AGENTE',
    },
    include: {
      mensagens: true,
    },
  })
}

export async function adicionarMensagem(
  prisma: PrismaClient,
  usuarioId: string,
  conversaId: string,
  texto: string,
) {
  return prisma.$transaction(async (transacao) => {
    const conversa = await transacao.conversa.findFirst({
      where: {
        id: conversaId,
        usuarioId,
        status: { not: 'ENCERRADA' },
      },
    })

    if (!conversa) {
      return { erro: 'CONVERSA_NAO_ENCONTRADA' } as const
    }

    const totalMensagens = await transacao.mensagem.count({
      where: {
        conversaId,
        autor: 'FUNCIONARIO',
      },
    })

    if (totalMensagens >= LIMITE_MENSAGENS) {
      return { erro: 'LIMITE_ATINGIDO' } as const
    }

    const mensagem = await transacao.mensagem.create({
      data: {
        conversaId,
        autor: 'FUNCIONARIO',
        texto,
      },
    })

    await transacao.conversa.update({
      where: { id: conversaId },
      data: { atualizadoEm: new Date() },
    })

    return { mensagem } as const
  })
}