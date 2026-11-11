import { askAnswerLines, askListMarker, type AskResponse, type AskTotals } from "@/lib/ask";

export function AskAnswerText({ result }: { result: AskResponse }) {
  const blocks: Array<{ kind: "p"; text: string } | { kind: "ul" | "ol"; items: string[] }> = [];
  for (const line of askAnswerLines(result)) {
    const marker = askListMarker(line);
    const last = blocks[blocks.length - 1];
    if (!marker) blocks.push({ kind: "p", text: line });
    else if (last && last.kind === (marker.ordered ? "ol" : "ul")) (last as { items: string[] }).items.push(marker.text);
    else blocks.push({ kind: marker.ordered ? "ol" : "ul", items: [marker.text] });
  }
  return (
    <div className="max-w-[72ch] space-y-2 text-[15px] leading-relaxed text-foreground" data-testid="ask-answer">
      {blocks.map((block, index) => block.kind === "p" ? <p key={index}>{block.text}</p>
        : block.kind === "ol" ? <ol key={index} className="list-decimal space-y-1 pl-5">{block.items.map((item, i) => <li key={i}>{item}</li>)}</ol>
        : <ul key={index} className="list-disc space-y-1 pl-5">{block.items.map((item, i) => <li key={i}>{item}</li>)}</ul>)}
    </div>
  );
}

export function AskTotalsList({ totals }: { totals: AskTotals }) {
  const rows: Array<[string, number]> = [
    ["Tracked applications", totals.applications], ["Open now", totals.open],
    ["Reached an interview (ever)", totals.reachedInterview], ["In interviews (now)", totals.inInterviewStage],
    ["Offers", totals.offers], ["Rejected", totals.rejected],
  ];
  return <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="ask-totals">
    {rows.map(([label, value]) => <div key={label} className="rounded-lg bg-muted/50 px-3 py-2">
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className="text-[20px] font-semibold tabular-nums text-foreground">{value}</dd>
    </div>)}
  </dl>;
}
