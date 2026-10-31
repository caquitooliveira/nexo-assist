import { randomUUID } from 'node:crypto'
import { Prisma, type PrismaClient } from '@prisma/client'

export async function confirmarRascunho(
  prisma: PrismaClient,
  usuarioId: string,
  conversaId: string,
  rascunhoId: string,
) {
  try {
    return await prisma.$transaction(async (transacao) => {
      const conversa = await transacao.conversa.findFirst({
        where: {
          id: conversaId,
          usuarioId,
        },
      })

      if (!conversa) {
        return { status: 'CONVERSA_NAO_ENCONTRADA' } as const
      }

      const chamadoExistente = await transacao.chamado.findUnique({
        where: {
          origemRascunhoId: rascunhoId,
        },
      })

      if (chamadoExistente?.usuarioId === usuarioId) {
        return {
          status: 'JA_CONFIRMADO',
          chamado: chamadoExistente,
        } as const
      }

      if (conversa.status !== 'COM_AGENTE') {
        return { status: 'CONVERSA_INDISPONIVEL' } as const
      }

      const rascunho = await transacao.rascunhoChamado.findFirst({
        where: {
          id: rascunhoId,
          conversaId,
        },
      })

      if (!rascunho) {
        return { status: 'RASCUNHO_NAO_ENCONTRADO' } as const
      }

      const seteDiasAtras = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000,
      )

      const candidatos = await transacao.chamado.findMany({
        where: {
          usuarioId,
          tipo: rascunho.tipo,
          categoria: rascunho.categoria,
          OR: [
            {
              status: {
                not: 'RESOLVIDO',
              },
            },
            {
              status: 'RESOLVIDO',
              resolvidoEm: {
                gte: seteDiasAtras,
              },
            },
          ],
        },
        select: {
          id: true,
          numero: true,
          titulo: true,
          status: true,
        },
      })

      if (candidatos.length > 0) {
        return {
          status: 'REVISAO_NECESSARIA',
          candidatos,
        } as const
      }

      const identificador = randomUUID()
        .replaceAll('-', '')
        .slice(0, 10)
        .toUpperCase()

      const chamado = await transacao.chamado.create({
        data: {
          numero: `${rascunho.tipo}-${identificador}`,
          titulo: rascunho.titulo,
          descricao: rascunho.descricao,
          tipo: rascunho.tipo,
          categoria: rascunho.categoria,
          prioridade: rascunho.prioridade,
          afetados: rascunho.afetados,
          status: 'AGUARDANDO_ANALISTA',
          usuarioId,
          origemRascunhoId: rascunho.id,
        },
      })

      await transacao.rascunhoChamado.delete({
        where: {
          id: rascunho.id,
        },
      })

      return {
        status: 'CRIADO',
        chamado,
      } as const
    })
  } catch (erro) {
    if (
      erro instanceof Prisma.PrismaClientKnownRequestError &&
      erro.code === 'P2002'
    ) {
      const chamado = await prisma.chamado.findUnique({
        where: {
          origemRascunhoId: rascunhoId,
        },
      })

      if (chamado?.usuarioId === usuarioId) {
        return {
          status: 'JA_CONFIRMADO',
          chamado,
        } as const
      }
    }

    throw erro
  }
}