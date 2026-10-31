import { verificarDisponibilidadeChamados } from './disponibilidade'
import { randomUUID } from 'node:crypto'
import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'

export const confirmacaoSchema = z.object({
  versaoRascunho: z.string().datetime(),

  chamadoId: z.string().min(1).optional(),
  versaoChamado: z.string().datetime().optional(),

  revisados: z.array(
    z.object({
      id: z.string().min(1),
      atualizadoEm: z.string().datetime(),
    }),
  ).max(100).default([]),
}).refine(
  (dados) => !dados.chamadoId || Boolean(dados.versaoChamado),
  {
    message: 'Informe a versão do chamado escolhido.',
  },
)

type DadosConfirmacao = z.infer<typeof confirmacaoSchema>

function maiorPrioridade(atual: string, nova: string) {
  const prioridades = ['Baixa', 'Media', 'Alta', 'Critica']
  const indiceAtual = prioridades.indexOf(atual)
  const indiceNovo = prioridades.indexOf(nova)

  if (indiceAtual < 0 || indiceNovo < 0) {
    throw new Error('Prioridade inválida.')
  }

  return prioridades[Math.max(indiceAtual, indiceNovo)]
}

export async function confirmarRascunho(
  prisma: PrismaClient,
  usuarioId: string,
  conversaId: string,
  rascunhoId: string,
  dados: DadosConfirmacao,
) {
  verificarDisponibilidadeChamados()
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

      const confirmacaoAnterior =
        await transacao.confirmacaoRascunho.findUnique({
          where: { rascunhoId },
          include: { chamado: true },
        })

      if (
        confirmacaoAnterior?.conversaId === conversaId &&
        confirmacaoAnterior.chamado.usuarioId === usuarioId
      ) {
        return {
          status: 'JA_CONFIRMADO',
          chamado: confirmacaoAnterior.chamado,
        } as const
      }

      // Compatibilidade com chamados criados antes desta alteração.
      const chamadoAnterior = await transacao.chamado.findUnique({
        where: { origemRascunhoId: rascunhoId },
      })

      if (chamadoAnterior?.usuarioId === usuarioId) {
        return {
          status: 'JA_CONFIRMADO',
          chamado: chamadoAnterior,
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

      if (
        rascunho.atualizadoEm.toISOString() !== dados.versaoRascunho
      ) {
        return { status: 'RASCUNHO_ALTERADO' } as const
      }

      const agora = new Date()
      const seteDiasAtras = new Date(
        agora.getTime() - 7 * 24 * 60 * 60 * 1000,
      )

      const candidatos = await transacao.chamado.findMany({
        where: {
          usuarioId,
          tipo: rascunho.tipo,
          categoria: rascunho.categoria,
          OR: [
            {
              status: { not: 'RESOLVIDO' },
            },
            {
              status: 'RESOLVIDO',
              resolvidoEm: { gte: seteDiasAtras },
            },
          ],
        },
        select: {
          id: true,
          numero: true,
          titulo: true,
          descricao: true,
          status: true,
          prioridade: true,
          afetados: true,
          atualizadoEm: true,
          resolvidoEm: true,
        },
      })

      const escolhido = dados.chamadoId
        ? candidatos.find((chamado) => chamado.id === dados.chamadoId)
        : undefined

      if (
        dados.chamadoId &&
        (
          !escolhido ||
          escolhido.atualizadoEm.toISOString() !== dados.versaoChamado
        )
      ) {
        return { status: 'CHAMADO_ALTERADO' } as const
      }

      if (!dados.chamadoId && candidatos.length > 0) {
        const todosRevisados = candidatos.every((candidato) =>
          dados.revisados.some(
            (revisado) =>
              revisado.id === candidato.id &&
              revisado.atualizadoEm ===
                candidato.atualizadoEm.toISOString(),
          ),
        )

        if (!todosRevisados) {
          return {
            status: 'REVISAO_NECESSARIA',
            candidatos,
          } as const
        }
      }

      const reabertura = escolhido?.status === 'RESOLVIDO'

      const acao = escolhido
        ? reabertura
          ? 'REABERTO'
          : 'ATUALIZADO'
        : 'CRIADO'

      let chamado

      if (escolhido) {
        const afetados = Array.from(
          new Set([escolhido.afetados, rascunho.afetados]),
        ).join('; ')

        chamado = await transacao.chamado.update({
          where: { id: escolhido.id },
          data: {
            descricao:
              `${escolhido.descricao}\n\n` +
              `Complemento em ${agora.toISOString()}:\n` +
              rascunho.descricao,
            afetados,
            prioridade: maiorPrioridade(
              escolhido.prioridade,
              rascunho.prioridade,
            ),
            ...(reabertura
              ? {
                  status: 'AGUARDANDO_ANALISTA',
                  resolvidoEm: null,
                }
              : {}),
          },
        })
      } else {
        const identificador = randomUUID()
          .replaceAll('-', '')
          .slice(0, 10)
          .toUpperCase()

        chamado = await transacao.chamado.create({
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
      }

      await transacao.confirmacaoRascunho.create({
        data: {
          rascunhoId,
          conversaId,
          chamadoId: chamado.id,
          acao,
        },
      })

      const descricaoAcao = escolhido
        ? reabertura
          ? 'Reabriu o chamado'
          : 'Complementou o chamado'
        : 'Criou o chamado'

      const mensagem = await transacao.mensagem.create({
        data: {
          conversaId,
          autor: 'ASSISTENTE',
          texto: `${descricaoAcao} ${chamado.numero} após sua confirmação.`,
          acoes: {
            create: {
              nome: descricaoAcao,
              entrada: rascunho.titulo,
              resultado: `Operação confirmada no chamado ${chamado.numero}.`,
            },
          },
        },
        include: { acoes: true },
      })

      await transacao.rascunhoChamado.delete({
        where: { id: rascunho.id },
      })

      await transacao.conversa.update({
        where: { id: conversaId },
        data: { atualizadoEm: agora },
      })

      return {
        status: acao,
        chamado,
        mensagem,
      } as const
    })
  } catch (erro) {
    if (
      erro instanceof Prisma.PrismaClientKnownRequestError &&
      erro.code === 'P2002'
    ) {
      const confirmacao = await prisma.confirmacaoRascunho.findUnique({
        where: { rascunhoId },
        include: { chamado: true },
      })

      if (
        confirmacao?.conversaId === conversaId &&
        confirmacao.chamado.usuarioId === usuarioId
      ) {
        return {
          status: 'JA_CONFIRMADO',
          chamado: confirmacao.chamado,
        } as const
      }
    }

    throw erro
  }
}