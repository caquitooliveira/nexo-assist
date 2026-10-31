import type { PrismaClient } from '@prisma/client'
import type { DecisaoAgente } from '../agente/decisao'
import { calcularPrazo } from './prazos'

export type Encaminhamento = {
  motivo:
    | 'SOLICITACAO_FUNCIONARIO'
    | 'CASO_CRITICO'
    | 'CHAMADO_VENCIDO'
    | 'BAIXA_SEGURANCA'
  justificativa: string
}

export async function avaliarEncaminhamento(
  prisma: PrismaClient,
  usuarioId: string,
  decisao: DecisaoAgente,
): Promise<Encaminhamento | null> {
  if (!decisao.assuntoTi) {
    return null
  }

  if (decisao.solicitouAnalista) {
    return {
      motivo: 'SOLICITACAO_FUNCIONARIO',
      justificativa:
        'O funcionário solicitou atendimento humano.',
    }
  }

  const impactoColetivo =
    decisao.impacto === 'EQUIPE' ||
    decisao.impacto === 'EMPRESA'

  if (impactoColetivo && decisao.urgencia === 'PARADO') {
    return {
      motivo: 'CASO_CRITICO',
      justificativa:
        'Foi informado que o problema impede o trabalho de uma equipe ou da empresa.',
    }
  }

  if (decisao.chamadoRelacionadoId) {
    const chamado = await prisma.chamado.findFirst({
      where: {
        id: decisao.chamadoRelacionadoId,
        usuarioId,
      },
    })

    if (chamado) {
      const prazo = calcularPrazo(
        chamado.prioridade,
        chamado.atualizadoEm,
        chamado.status,
      )

      if (prazo.vencido) {
        return {
          motivo: 'CHAMADO_VENCIDO',
          justificativa:
            `O chamado ${chamado.numero}, relacionado à solicitação, ` +
            'está com o prazo vencido.',
        }
      }
    }
  }

  if (decisao.seguranca === 'BAIXA') {
    return {
      motivo: 'BAIXA_SEGURANCA',
      justificativa:
        'O agente declarou não ter segurança suficiente para conduzir o caso.',
    }
  }

  return null
}