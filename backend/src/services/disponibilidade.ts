/** Simula uma indisponibilidade curta do legado, sem modificar dados. */
let indisponivelAte = 0
export function verificarDisponibilidadeChamados() {
  const taxa = Number(process.env.CHAMADOS_TAXA_FALHA ?? '0')
  if (!Number.isFinite(taxa) || taxa < 0 || taxa > 1) {
    throw new Error('CHAMADOS_TAXA_FALHA deve estar entre 0 e 1.')
  }
  if (Date.now() < indisponivelAte || Math.random() < taxa) {
    indisponivelAte = Math.max(indisponivelAte, Date.now() + 3000)
    throw new Error('Serviço de chamados temporariamente indisponível. Tente novamente em alguns segundos.')
  }
}
