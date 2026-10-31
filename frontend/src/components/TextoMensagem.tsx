import Markdown from 'react-markdown'

export default function TextoMensagem({ texto }: { texto: string }) {
  return (
    <div className="break-words [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-slate-100 [&_pre]:p-3 [&_code]:text-xs [&_a]:underline">
      <Markdown skipHtml components={{ a: ({ children, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer">{children}</a> }}>{texto}</Markdown>
    </div>
  )
}
