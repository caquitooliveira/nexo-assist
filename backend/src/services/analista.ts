import type { PrismaClient } from '@prisma/client'
import { listarChamadosDoUsuario } from './chamados'

export class ErroAtendimento extends Error {
  statusCode: number

  constructor(statusCode: number, mensagem: string) {
    super(mensagem)
    this.statusCode = statusCode
  }
}

export async function listarConversasAnalista(prisma: PrismaClient) {
  return prisma.conversa.findMany({
    where: {
      resumo: { not: null },
    },
    orderBy: {
      atualizadoEm: 'desc',
    },
    select: {
      id: true,
      status: true,
      atualizadoEm: true,
      analistaId: true,
      usuario: {
        select: {
          nome: true,
          email: true,
        },
      },
      mensagens: {
        orderBy: { criadoEm: 'desc' },
        take: 1,
        select: { texto: true },
      },
    },
  })
}

export async function obterConversaAnalista(
  prisma: PrismaClient,
  conversaId: string,
) {
  const conversa = await prisma.conversa.findFirst({
    where: {
      id: conversaId,
      resumo: { not: null },
    },
    include: {
      usuario: {
        select: {
          id: true,
          nome: true,
          email: true,
        },
      },
      analista: {
        select: {
          id: true,
          nome: true,
        },
      },
      mensagens: {
        orderBy: { criadoEm: 'asc' },
        include: {
          acoes: {
            orderBy: { criadoEm: 'asc' },
          },
        },
      },
    },
  })

  if (!conversa) {
    throw new ErroAtendimento(404, 'Conversa não encontrada.')
  }

  const chamados = await listarChamadosDoUsuario(
    prisma,
    conversa.usuario.id,
  )

  return {
    ...conversa,
    chamados,
  }
}

export async function alterarEstadoAtendimento(
  prisma: PrismaClient,
  analistaId: string,
  conversaId: string,
  acao: 'ASSUMIR' | 'DEVOLVER' | 'ENCERRAR',
) {
  return prisma.$transaction(async (transacao) => {
    const analista = await transacao.usuario.findUnique({
      where: { id: analistaId },
      select: { nome: true, papel: true },
    })

    if (analista?.papel !== 'ANALISTA') {
      throw new ErroAtendimento(403, 'Acesso exclusivo dos analistas.')
    }

    const assumir = acao === 'ASSUMIR'

    const novoStatus =
      acao === 'ASSUMIR'
        ? 'COM_ANALISTA'
        : acao === 'DEVOLVER'
          ? 'COM_AGENTE'
          : 'ENCERRADA'

    const atualizacao = await transacao.conversa.updateMany({
      where: {
        id: conversaId,
        resumo: { not: null },
        status: assumir ? 'AGUARDANDO_ANALISTA' : 'COM_ANALISTA',
        analistaId: assumir ? null : analistaId,
      },
      data: {
        status: novoStatus,
        analistaId:
          acao === 'DEVOLVER'
            ? null
            : analistaId,
      },
    })

    if (atualizacao.count === 0) {
      throw new ErroAtendimento(
        409,
        'A conversa mudou ou você não é o analista responsável.',
      )
    }

    const textos = {
      ASSUMIR:
        `${analista.nome} assumiu o atendimento. ` +
        'O assistente continua pausado.',
      DEVOLVER:
        `${analista.nome} devolveu a conversa ao Nexo Assist.`,
      ENCERRAR:
        `${analista.nome} encerrou esta conversa.`,
    }

    const mensagem = await transacao.mensagem.create({
      data: {
        conversaId,
        autor: 'SISTEMA',
        texto: textos[acao],
      },
    })

    const conversa = await transacao.conversa.findUniqueOrThrow({
      where: { id: conversaId },
    })

    return {
      conversa,
      mensagem,
    }
  })
}

export async function responderComoAnalista(
  prisma: PrismaClient,
  analistaId: string,
  conversaId: string,
  texto: string,
) {
  return prisma.$transaction(async (transacao) => {
    const atualizacao = await transacao.conversa.updateMany({
      where: {
        id: conversaId,
        status: 'COM_ANALISTA',
        analistaId,
      },
      data: {
        atualizadoEm: new Date(),
      },
    })

    if (atualizacao.count === 0) {
      throw new ErroAtendimento(
        409,
        'Assuma a conversa antes de responder.',
      )
    }

    return transacao.mensagem.create({
      data: {
        conversaId,
        autor: 'ANALISTA',
        texto,
      },
    })
  })
}