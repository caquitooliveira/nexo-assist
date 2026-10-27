const HORA_EM_MS = 60 * 60 * 1000
const DIA_EM_MS = 24 * HORA_EM_MS

// Horário de Brasília: UTC-3.
const DESLOCAMENTO_BRASILIA = -3 * HORA_EM_MS

const INICIO_EXPEDIENTE = 8
const FIM_EXPEDIENTE = 18

type ResultadoPrazo = {
  dataLimite: Date
  vencido: boolean
}

function adicionarHorasUteis(inicio: Date, horas: number): Date {
  // Usamos métodos UTC sobre uma data deslocada para representar Brasília.
  let atual = new Date(inicio.getTime() + DESLOCAMENTO_BRASILIA)
  let tempoRestante = horas * HORA_EM_MS

  while (tempoRestante > 0) {
    const diaSemana = atual.getUTCDay()

    // Sábado ou domingo: avança para a próxima segunda-feira às 8h.
    if (diaSemana === 0 || diaSemana === 6) {
      const diasAteSegunda = diaSemana === 6 ? 2 : 1
      atual.setUTCDate(atual.getUTCDate() + diasAteSegunda)
      atual.setUTCHours(INICIO_EXPEDIENTE, 0, 0, 0)
      continue
    }

    const inicioDia = new Date(atual)
    inicioDia.setUTCHours(INICIO_EXPEDIENTE, 0, 0, 0)

    const fimDia = new Date(atual)
    fimDia.setUTCHours(FIM_EXPEDIENTE, 0, 0, 0)

    if (atual < inicioDia) {
      atual = inicioDia
    }

    if (atual >= fimDia) {
      atual = new Date(inicioDia.getTime() + DIA_EM_MS)
      continue
    }

    const tempoDisponivel = fimDia.getTime() - atual.getTime()
    const tempoUsado = Math.min(tempoRestante, tempoDisponivel)

    atual = new Date(atual.getTime() + tempoUsado)
    tempoRestante -= tempoUsado
  }

  // Converte o horário de Brasília de volta para um instante UTC.
  return new Date(atual.getTime() - DESLOCAMENTO_BRASILIA)
}

export function calcularPrazo(
  prioridade: string,
  ultimaAtualizacao: Date,
  status: string,
  agora: Date = new Date(),
): ResultadoPrazo {
  let dataLimite: Date

  switch (prioridade) {
    case 'Critica':
      dataLimite = new Date(ultimaAtualizacao.getTime() + HORA_EM_MS)
      break

    case 'Alta':
      dataLimite = adicionarHorasUteis(ultimaAtualizacao, 4)
      break

    case 'Media':
      dataLimite = adicionarHorasUteis(ultimaAtualizacao, 30)
      break

    case 'Baixa':
      dataLimite = adicionarHorasUteis(ultimaAtualizacao, 50)
      break

    default:
      throw new Error(`Prioridade desconhecida: ${prioridade}`)
  }

  return {
    dataLimite,
    vencido: status !== 'RESOLVIDO' && agora > dataLimite,
  }
}