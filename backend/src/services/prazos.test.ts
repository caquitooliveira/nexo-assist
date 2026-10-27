import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calcularPrazo } from './prazos'

test('prazo crítico conta uma hora corrida, mesmo no fim de semana', () => {
  const resultado = calcularPrazo(
    'Critica',
    new Date('2026-10-31T22:00:00.000Z'),
    'ABERTO',
    new Date('2026-10-31T23:01:00.000Z'),
  )

  assert.equal(
    resultado.dataLimite.toISOString(),
    '2026-10-31T23:00:00.000Z',
  )
  assert.equal(resultado.vencido, true)
})

test('prazo alto continua na segunda-feira depois do expediente de sexta', () => {
  // Sexta-feira, 17h em Brasília.
  const resultado = calcularPrazo(
    'Alta',
    new Date('2026-10-30T20:00:00.000Z'),
    'ABERTO',
    new Date('2026-11-02T13:00:00.000Z'),
  )

  // Segunda-feira, 11h em Brasília.
  assert.equal(
    resultado.dataLimite.toISOString(),
    '2026-11-02T14:00:00.000Z',
  )
  assert.equal(resultado.vencido, false)
})

test('prazo médio soma três dias de expediente', () => {
  // Segunda-feira, 8h em Brasília.
  const resultado = calcularPrazo(
    'Media',
    new Date('2026-11-02T11:00:00.000Z'),
    'ABERTO',
  )

  // Quarta-feira, 18h em Brasília.
  assert.equal(
    resultado.dataLimite.toISOString(),
    '2026-11-04T21:00:00.000Z',
  )
})

test('um chamado resolvido não é marcado como vencido', () => {
  const resultado = calcularPrazo(
    'Media',
    new Date('2026-10-20T11:00:00.000Z'),
    'RESOLVIDO',
    new Date('2026-10-30T21:00:00.000Z'),
  )

  assert.equal(resultado.vencido, false)
})

test('uma prioridade desconhecida gera erro', () => {
  assert.throws(() => {
    calcularPrazo(
      'Inexistente',
      new Date('2026-10-27T11:00:00.000Z'),
      'ABERTO',
    )
  }, /Prioridade desconhecida/)
})