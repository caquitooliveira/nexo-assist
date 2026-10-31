import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { after, before, test } from 'node:test'
import { PrismaClient } from '@prisma/client'
import { confirmarRascunho } from './confirmacao'
import { avaliarEncaminhamento } from './encaminhamento'
import { transferirParaAnalista } from './transferencias'
import { alterarEstadoAtendimento, responderComoAnalista } from './analista'
import { listarChamadosDoUsuario } from './chamados'
import { adicionarMensagem } from './conversas'
import { decisaoSchema } from '../agente/decisao'
import { verificarDisponibilidadeChamados } from './disponibilidade'

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
  writeFileSync(caminhoBanco, '')
  execFileSync(
    process.execPath,
    [
      resolve('node_modules/prisma/build/index.js'),
      'migrate',
      'deploy',
      '--schema',
      resolve('prisma/schema.prisma'),
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
const decisaoBase = decisaoSchema.parse({
  texto: 'Vou ajudar.', entendimento: 'Problema de TI.', justificativa: 'Dados informados.',
  seguranca: 'ALTA', assuntoTi: true, solicitouAnalista: false,
  impacto: 'UMA_PESSOA', urgencia: 'COM_ALTERNATIVA', chamadoRelacionadoId: null,
})

test('consulta e confirmação não expõem nem alteram dados de outro funcionário', async () => {
  const a = await prepararCenario(null)
  const b = await prepararCenario(null)
  const chamados = await listarChamadosDoUsuario(prisma, a.usuario.id)
  assert.deepEqual(chamados.map((c) => c.id), [a.chamado.id])
  const resultado = await confirmarRascunho(prisma, b.usuario.id, a.conversa.id, a.rascunho.id, a.dados)
  assert.equal(resultado.status, 'CONVERSA_NAO_ENCONTRADA')
  const encaminhamento = await avaliarEncaminhamento(prisma, b.usuario.id, {
    ...decisaoBase, chamadoRelacionadoId: a.chamado.id,
  })
  assert.equal(encaminhamento, null)
})

test('caso coletivo parado é crítico; pessoa com alternativa não é', async () => {
  const a = await prepararCenario(null)
  const critico = await avaliarEncaminhamento(prisma, a.usuario.id, { ...decisaoBase, impacto: 'EQUIPE', urgencia: 'PARADO' })
  assert.equal(critico?.motivo, 'CASO_CRITICO')
  assert.equal(await avaliarEncaminhamento(prisma, a.usuario.id, decisaoBase), null)
})

test('pedido humano e baixa segurança encaminham; assunto fora de TI não', async () => {
  const a = await prepararCenario(null)
  assert.equal((await avaliarEncaminhamento(prisma, a.usuario.id, { ...decisaoBase, solicitouAnalista: true }))?.motivo, 'SOLICITACAO_FUNCIONARIO')
  assert.equal((await avaliarEncaminhamento(prisma, a.usuario.id, { ...decisaoBase, seguranca: 'BAIXA' }))?.motivo, 'BAIXA_SEGURANCA')
  assert.equal(await avaliarEncaminhamento(prisma, a.usuario.id, { ...decisaoBase, assuntoTi: false, seguranca: 'BAIXA' }), null)
})

test('chamado próprio vencido encaminha; resolvido não está vencido', async () => {
  const a = await prepararCenario(null)
  await prisma.chamado.update({ where: { id: a.chamado.id }, data: { atualizadoEm: new Date(Date.now() - 20 * 86400000) } })
  assert.equal((await avaliarEncaminhamento(prisma, a.usuario.id, { ...decisaoBase, chamadoRelacionadoId: a.chamado.id }))?.motivo, 'CHAMADO_VENCIDO')
  await prisma.chamado.update({ where: { id: a.chamado.id }, data: { status: 'RESOLVIDO' } })
  assert.equal(await avaliarEncaminhamento(prisma, a.usuario.id, { ...decisaoBase, chamadoRelacionadoId: a.chamado.id }), null)
})

test('transferência mantém resumo, pausa o agente e só o responsável responde', async () => {
  const a = await prepararCenario(null)
  const analista = await prisma.usuario.create({ data: { nome: 'Analista', email: `${randomUUID()}@nexo.com.br`, papel: 'ANALISTA' } })
  const transferencia = await transferirParaAnalista(prisma, a.usuario.id, a.conversa.id)
  assert.equal(transferencia.status, 'ENCAMINHADA')
  assert.equal((await prisma.conversa.findUniqueOrThrow({ where: { id: a.conversa.id } })).status, 'AGUARDANDO_ANALISTA')
  const repetida = await transferirParaAnalista(prisma, a.usuario.id, a.conversa.id)
  assert.equal(repetida.status, 'JA_ENCAMINHADA')
  await assert.rejects(responderComoAnalista(prisma, analista.id, a.conversa.id, 'Teste'))
  await assert.rejects(alterarEstadoAtendimento(prisma, a.usuario.id, a.conversa.id, 'ASSUMIR'))
  await alterarEstadoAtendimento(prisma, analista.id, a.conversa.id, 'ASSUMIR')
  await assert.rejects(responderComoAnalista(prisma, a.usuario.id, a.conversa.id, 'Teste'))
  const mensagem = await responderComoAnalista(prisma, analista.id, a.conversa.id, 'Olá, vou atender.')
  assert.equal(mensagem.autor, 'ANALISTA')
  await alterarEstadoAtendimento(prisma, analista.id, a.conversa.id, 'DEVOLVER')
  assert.equal((await prisma.conversa.findUniqueOrThrow({ where: { id: a.conversa.id } })).status, 'COM_AGENTE')
})

test('rascunho alterado e conversa transferida não podem ser confirmados', async () => {
  const a = await prepararCenario(null)
  const alterado = await confirmarRascunho(prisma, a.usuario.id, a.conversa.id, a.rascunho.id, { ...a.dados, versaoRascunho: new Date(0).toISOString() })
  assert.equal(alterado.status, 'RASCUNHO_ALTERADO')
  await transferirParaAnalista(prisma, a.usuario.id, a.conversa.id)
  assert.equal((await confirmarRascunho(prisma, a.usuario.id, a.conversa.id, a.rascunho.id, a.dados)).status, 'CONVERSA_INDISPONIVEL')
})

test('limite de 30 mensagens é aplicado no serviço', async () => {
  const a = await prepararCenario(null)
  for (let i = 0; i < 30; i++) await adicionarMensagem(prisma, a.usuario.id, a.conversa.id, `Mensagem ${i}`)
  const resultado = await adicionarMensagem(prisma, a.usuario.id, a.conversa.id, 'Mensagem excedente')
  assert.ok('erro' in resultado)
  if ('erro' in resultado) assert.equal(resultado.erro, 'LIMITE_ATINGIDO')
})

test('indisponibilidade simulada não cria recibo nem altera chamado', async () => {
  const a = await prepararCenario(null)
  const anterior = process.env.CHAMADOS_TAXA_FALHA
  process.env.CHAMADOS_TAXA_FALHA = '1'
  try {
    assert.throws(() => verificarDisponibilidadeChamados(), /temporariamente indisponível/)
    await assert.rejects(confirmarRascunho(prisma, a.usuario.id, a.conversa.id, a.rascunho.id, a.dados), /temporariamente indisponível/)
    assert.equal(await prisma.confirmacaoRascunho.count({ where: { rascunhoId: a.rascunho.id } }), 0)
  } finally {
    if (anterior === undefined) delete process.env.CHAMADOS_TAXA_FALHA
    else process.env.CHAMADOS_TAXA_FALHA = anterior
  }
})
