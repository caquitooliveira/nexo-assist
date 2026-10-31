import type { PrismaClient } from '@prisma/client'
import type { DecisaoAgente } from '../agente/decisao'
import type { RegistroAcao } from '../agente/nexoAgent'
import type { Encaminhamento } from './encaminhamento'

type OpcoesTransferencia = {
  encaminhamento?: Encaminhamento
  decisao?: DecisaoAgente
  acoes?: RegistroAcao[]
}

export async function transferirParaAnalista(
  prisma: PrismaClient,
  usuarioId: string,
  conversaId: string,
  opcoes: OpcoesTransferencia = {},
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

    const motivo =
      opcoes.encaminhamento?.justificativa ??
      'O funcionário solicitou atendimento humano.'

    const historico = [...conversa.mensagens]
      .reverse()
      .map((mensagem) => {
        const autor =
          mensagem.autor === 'FUNCIONARIO'
            ? 'Funcionário'
            : mensagem.autor === 'ANALISTA'
              ? 'Analista'
              : mensagem.autor === 'SISTEMA'
                ? 'Sistema'
                : 'Assistente'

        return `${autor}: ${mensagem.texto.slice(0, 600)}`
      })
      .join('\n\n')

    const entendimento = opcoes.decisao?.entendimento

    const resumo = [
      `Motivo: ${motivo}`,
      entendimento ? `Solicitação: ${entendimento}` : '',
      'Últimas mensagens da conversa:',
      historico,
    ]
      .filter(Boolean)
      .join('\n\n')

    const atualizacao = await transacao.conversa.updateMany({
      where: {
        id: conversaId,
        usuarioId,
        status: 'COM_AGENTE',
      },
      data: {
        status: 'AGUARDANDO_ANALISTA',
        analistaId: null,
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
          `${motivo}\n\n` +
          'Sua conversa foi encaminhada e aguarda um analista. ' +
          'O Nexo Assist ficará pausado durante o atendimento humano.',
        entendimento: entendimento ?? null,
        justificativa: motivo,
        seguranca: opcoes.decisao?.seguranca ?? null,
        acoes: {
          create: [
            ...(opcoes.acoes ?? []),
            {
              nome: 'Encaminhou para um analista',
              entrada: motivo,
              resultado:
                'Conversa aguardando analista, com o assistente pausado.',
            },
          ],
        },
      },
      include: {
        acoes: {
          orderBy: { criadoEm: 'asc' },
        },
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