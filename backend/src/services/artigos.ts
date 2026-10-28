import type { PrismaClient } from '@prisma/client'

function normalizarTexto(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export async function buscarArtigos(prisma: PrismaClient, busca: string) {
  const palavras = normalizarTexto(busca)
    .split(/[^a-z0-9]+/)
    .filter((palavra) => palavra.length >= 3)

  if (palavras.length === 0) {
    return []
  }

  const artigos = await prisma.artigo.findMany({
    select: {
      id: true,
      titulo: true,
      conteudo: true,
    },
  })

  return artigos
    .map((artigo) => {
      const texto = normalizarTexto(`${artigo.titulo} ${artigo.conteudo}`)

      const relevancia = palavras.filter((palavra) =>
        texto.includes(palavra),
      ).length

      return { ...artigo, relevancia }
    })
    .filter((artigo) => artigo.relevancia > 0)
    .sort((primeiro, segundo) => segundo.relevancia - primeiro.relevancia)
    .slice(0, 3)
}