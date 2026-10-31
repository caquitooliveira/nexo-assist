import { useState, type FormEvent } from 'react'

type MensagemSalva = {
  id: string
  autor: string
  texto: string
}

type DadosEdicao = {
  titulo: string
  descricao: string
}

type EditorRascunhoProps = {
  conversaId: string
  token: string | null
  rascunho: {
    id: string
    titulo: string
    descricao: string
  }
  onSalvar: (
    dados: DadosEdicao,
    mensagem: MensagemSalva,
  ) => void
  onCancelar: () => void
}

function EditorRascunho({
  conversaId,
  token,
  rascunho,
  onSalvar,
  onCancelar,
}: EditorRascunhoProps) {
  const [titulo, setTitulo] = useState(rascunho.titulo)
  const [descricao, setDescricao] = useState(rascunho.descricao)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (salvando) return

    if (!token) {
      setErro('Faça login novamente para editar o rascunho.')
      return
    }

    setSalvando(true)
    setErro('')

    try {
      const resposta = await fetch(
        `http://localhost:3000/conversas/${conversaId}/rascunho/${rascunho.id}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            titulo: titulo.trim(),
            descricao: descricao.trim(),
          }),
        },
      )

      if (!resposta.ok) {
        const dados: { mensagem?: string } = await resposta.json()

        throw new Error(
          dados.mensagem || 'Não foi possível salvar as alterações.',
        )
      }

      const dados: {
        rascunho: DadosEdicao
        mensagem: MensagemSalva
      } = await resposta.json()

      onSalvar(dados.rascunho, dados.mensagem)
    } catch (erroCapturado) {
      setErro(
        erroCapturado instanceof Error
          ? erroCapturado.message
          : 'Não foi possível salvar as alterações.',
      )
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      <fieldset disabled={salvando} className="space-y-4">
        <div>
          <label
            htmlFor="titulo-rascunho-edicao"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Título
          </label>

          <input
            id="titulo-rascunho-edicao"
            value={titulo}
            onChange={(event) => setTitulo(event.target.value)}
            required
            minLength={5}
            maxLength={150}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div>
          <label
            htmlFor="descricao-rascunho-edicao"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Descrição
          </label>

          <textarea
            id="descricao-rascunho-edicao"
            value={descricao}
            onChange={(event) => setDescricao(event.target.value)}
            required
            minLength={10}
            maxLength={2000}
            rows={5}
            className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <p className="text-xs text-slate-500">
          Para mudar categoria, pessoas afetadas ou urgência, informe os
          novos dados pelo chat.
        </p>

        {erro && (
          <p role="alert" className="text-sm text-red-600">
            {erro}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : 'Salvar alterações'}
          </button>

          <button
            type="button"
            onClick={onCancelar}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Voltar sem salvar
          </button>
        </div>
      </fieldset>
    </form>
  )
}

export default EditorRascunho