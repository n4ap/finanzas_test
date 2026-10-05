import { Fragment } from 'react';

/** Renderizador mínimo y SEGURO (sin HTML): **negrita**, _cursiva_ y listas con «- ». Todo lo demás es texto. */
function inline(s: string) {
  return s.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part.startsWith('_') && part.endsWith('_') && part.length > 2 ? <em key={i} className="text-muted-foreground">{part.slice(1, -1)}</em> : <Fragment key={i}>{part}</Fragment>);
}

export function RichText({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => { if (list.length) { blocks.push(<ul key={`l${blocks.length}`} className="my-1 list-disc space-y-0.5 pl-5">{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>); list = []; } };
  lines.forEach((line) => {
    if (line.startsWith('- ')) { list.push(line.slice(2)); return; }
    flush();
    if (line.trim()) blocks.push(<p key={`p${blocks.length}`} className="my-1">{inline(line)}</p>);
  });
  flush();
  return <div className="text-sm leading-relaxed">{blocks}</div>;
}
