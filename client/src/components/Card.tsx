import type { ReactNode } from "react";

function cn(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Card(props: {
  title: string;
  right?: ReactNode;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-3 shadow-sm h-full flex flex-col">
      <div className="mb-2 flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold text-white">{props.title}</h2>
        {props.right ? <div className="shrink-0">{props.right}</div> : null}
      </div>
      <div className={cn("flex-1", props.bodyClassName)}>{props.children}</div>
    </section>
  );
}

