import type { PrismaClient } from '@prisma/client'

export async function transferirParaAnalista(
  prisma: PrismaClient,
  usuarioId: string,
  conversaId: string,
) {
  return prisma.$transaction(async (transacao) => {
    const conversa = await transacao.conversa.findFirst({
      where: {
        id: conversaId,
        usuarioId,
      },
      include: {
        mensagens: {
          orderBy: { criadoEm: 'desc' },
          take: 12,
        },
      },
    })

    if (!conversa) {
      return { status: 'CONVERSA_NAO_ENCONTRADA' } as const
    }

    if (conversa.status === 'ENCERRADA') {
      return { status: 'CONVERSA_ENCERRADA' } as const
    }

    if (
      conversa.status === 'AGUARDANDO_ANALISTA' ||
      conversa.status === 'COM_ANALISTA'
    ) {
      return {
        status: 'JA_ENCAMINHADA',
        conversa,
      } as const
    }

    if (conversa.status !== 'COM_AGENTE') {
      return { status: 'ESTADO_INVALIDO' } as const
    }

    const historico = [...conversa.mensagens]
      .reverse()
      .map((mensagem) => {
        const autor =
          mensagem.autor === 'FUNCIONARIO'
            ? 'Funcionário'
            : mensagem.autor === 'ANALISTA'
              ? 'Analista'
              : 'Assistente'

        return `${autor}: ${mensagem.texto.slice(0, 600)}`
      })
      .join('\n\n')

    const resumo =
      'Motivo: transferência solicitada pelo funcionário.\n\n' +
      'Últimas mensagens da conversa:\n\n' +
      historico

    const atualizacao = await transacao.conversa.updateMany({
      where: {
        id: conversaId,
        usuarioId,
        status: 'COM_AGENTE',
      },
      data: {
        status: 'AGUARDANDO_ANALISTA',
        resumo,
      },
    })

    if (atualizacao.count === 0) {
      return { status: 'ESTADO_INVALIDO' } as const
    }

    const mensagem = await transacao.mensagem.create({
      data: {
        conversaId,
        autor: 'ASSISTENTE',
        texto:
          'Sua conversa foi encaminhada e aguarda um analista. ' +
          'O Nexo Assist ficará pausado durante o atendimento humano.',
        acoes: {
          create: {
            nome: 'Encaminhou para um analista',
            entrada: 'Solicitação do funcionário.',
            resultado:
              'Conversa aguardando analista, com o assistente pausado.',
          },
        },
      },
      include: {
        acoes: true,
      },
    })

    const conversaAtualizada =
      await transacao.conversa.findUniqueOrThrow({
        where: { id: conversaId },
      })

    return {
      status: 'ENCAMINHADA',
      conversa: conversaAtualizada,
      mensagem,
    } as const
  })
}