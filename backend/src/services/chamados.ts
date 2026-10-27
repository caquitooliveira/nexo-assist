import type { PrismaClient } from '@prisma/client'
import { calcularPrazo } from './prazos'

export async function listarChamadosDoUsuario(
  prisma: PrismaClient,
  usuarioId: string,
) {
  const chamados = await prisma.chamado.findMany({
    where: {
      usuarioId,
    },
    orderBy: {
      atualizadoEm: 'desc',
    },
    select: {
      id: true,
      numero: true,
      titulo: true,
      descricao: true,
      tipo: true,
      categoria: true,
      prioridade: true,
      status: true,
      afetados: true,
      criadoEm: true,
      atualizadoEm: true,
      resolvidoEm: true,
    },
  })

  return chamados.map((chamado) => ({
    ...chamado,
    prazo: calcularPrazo(
      chamado.prioridade,
      chamado.atualizadoEm,
      chamado.status,
    ),
  }))
}