import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { after, before, test } from 'node:test'
import { PrismaClient } from '@prisma/client'
import { confirmarRascunho } from './confirmacao'

const pastaTemporaria = mkdtempSync(
  join(tmpdir(), 'nexo-confirmacao-'),
)

const caminhoBanco = join(pastaTemporaria, 'teste.db')
  .replaceAll('\\', '/')

const urlBanco = `file:${caminhoBanco}`

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: urlBanco,
    },
  },
})

before(() => {
  execFileSync(
    process.execPath,
    [
      resolve('node_modules/prisma/build/index.js'),
      'db',
      'push',
      '--schema',
      resolve('prisma/schema.prisma'),
      '--skip-generate',
    ],
    {
      env: {
        ...process.env,
        DATABASE_URL: urlBanco,
      },
      stdio: 'pipe',
      timeout: 60_000,
    },
  )
})

after(async () => {
  await prisma.$disconnect()

  rmSync(pastaTemporaria, {
    recursive: true,
    force: true,
  })
})

async function prepararCenario(diasDesdeResolucao: number | null) {
  const usuario = await prisma.usuario.create({
    data: {
      nome: 'Funcionário de teste',
      email: `${randomUUID()}@teste.nexo.com.br`,
    },
  })

  const conversa = await prisma.conversa.create({
    data: {
      usuarioId: usuario.id,
      status: 'COM_AGENTE',
    },
  })

  const rascunho = await prisma.rascunhoChamado.create({
    data: {
      conversaId: conversa.id,
      titulo: 'Acesso ao sistema SAP',
      descricao: 'Complemento do teste para conferir a atualização.',
      tipo: 'INC',
      categoria: 'Acesso',
      prioridade: 'Media',
      afetados: 'Funcionário de teste',
    },
  })

  const resolvidoEm =
    diasDesdeResolucao === null
      ? null
      : new Date(
          Date.now() -
            diasDesdeResolucao * 24 * 60 * 60 * 1000,
        )

  const chamado = await prisma.chamado.create({
    data: {
      numero: `INC-${randomUUID()}`,
      titulo: 'Problema no acesso ao SAP',
      descricao: 'Descrição original que deve ser preservada.',
      tipo: 'INC',
      categoria: 'Acesso',
      prioridade: 'Media',
      afetados: 'Funcionário de teste',
      status: resolvidoEm ? 'RESOLVIDO' : 'EM_ANDAMENTO',
      resolvidoEm,
      usuarioId: usuario.id,
    },
  })

  const dados = {
    versaoRascunho: rascunho.atualizadoEm.toISOString(),
    chamadoId: chamado.id,
    versaoChamado: chamado.atualizadoEm.toISOString(),
    revisados: [],
  }

  return {
    usuario,
    conversa,
    rascunho,
    chamado,
    dados,
  }
}

test('reabre um chamado resolvido há quatro dias', async () => {
  const cenario = await prepararCenario(4)

  const resultado = await confirmarRascunho(
    prisma,
    cenario.usuario.id,
    cenario.conversa.id,
    cenario.rascunho.id,
    cenario.dados,
  )

  assert.equal(resultado.status, 'REABERTO')

  const chamado = await prisma.chamado.findUniqueOrThrow({
    where: { id: cenario.chamado.id },
  })

  assert.equal(chamado.status, 'AGUARDANDO_ANALISTA')
  assert.equal(chamado.resolvidoEm, null)
  assert.equal(chamado.numero, cenario.chamado.numero)

  assert.ok(
    chamado.descricao.includes(
      'Descrição original que deve ser preservada.',
    ),
  )

  assert.ok(
    chamado.descricao.includes(
      'Complemento do teste para conferir a atualização.',
    ),
  )

  const quantidade = await prisma.chamado.count({
    where: { usuarioId: cenario.usuario.id },
  })

  assert.equal(quantidade, 1)
})

test('não reabre um chamado resolvido há oito dias', async () => {
  const cenario = await prepararCenario(8)

  const resultado = await confirmarRascunho(
    prisma,
    cenario.usuario.id,
    cenario.conversa.id,
    cenario.rascunho.id,
    cenario.dados,
  )

  assert.equal(resultado.status, 'CHAMADO_ALTERADO')

  const chamado = await prisma.chamado.findUniqueOrThrow({
    where: { id: cenario.chamado.id },
  })

  assert.equal(chamado.status, 'RESOLVIDO')
  assert.equal(chamado.descricao, cenario.chamado.descricao)

  const rascunho = await prisma.rascunhoChamado.findUnique({
    where: { id: cenario.rascunho.id },
  })

  assert.ok(rascunho)

  const confirmacoes = await prisma.confirmacaoRascunho.count({
    where: { rascunhoId: cenario.rascunho.id },
  })

  assert.equal(confirmacoes, 0)
})

test('repetir a confirmação não duplica o complemento', async () => {
  const cenario = await prepararCenario(null)

  const primeira = await confirmarRascunho(
    prisma,
    cenario.usuario.id,
    cenario.conversa.id,
    cenario.rascunho.id,
    cenario.dados,
  )

  const segunda = await confirmarRascunho(
    prisma,
    cenario.usuario.id,
    cenario.conversa.id,
    cenario.rascunho.id,
    cenario.dados,
  )

  assert.equal(primeira.status, 'ATUALIZADO')
  assert.equal(segunda.status, 'JA_CONFIRMADO')

  const chamado = await prisma.chamado.findUniqueOrThrow({
    where: { id: cenario.chamado.id },
  })

  const ocorrencias = chamado.descricao.split(
    'Complemento do teste para conferir a atualização.',
  ).length - 1

  assert.equal(ocorrencias, 1)

  const confirmacoes = await prisma.confirmacaoRascunho.count({
    where: { rascunhoId: cenario.rascunho.id },
  })

  assert.equal(confirmacoes, 1)

  const mensagens = await prisma.mensagem.count({
    where: {
      conversaId: cenario.conversa.id,
      autor: 'ASSISTENTE',
    },
  })

  assert.equal(mensagens, 1)
})