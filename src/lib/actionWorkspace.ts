import type { QueueItem } from "@/lib/premiumTaskQueue";

const KEY = /^[a-f0-9]{16}$/;
export type ActionContext = { logicalKey: string; dedupeKey: string };

export function readActionContext(search: string): ActionContext | null {
  const params = new URLSearchParams(search);
  const logicalKey = params.get("action");
  const dedupeKey = params.get("version");
  if (params.getAll("action").length !== 1 || params.getAll("version").length !== 1
    || !KEY.test(logicalKey || "") || !KEY.test(dedupeKey || "")) return null;
  return { logicalKey: logicalKey!, dedupeKey: dedupeKey! };
}

export function actionToolHref(href: string, item: Pick<QueueItem, "logicalKey" | "dedupeKey">): string {
  if (!KEY.test(item.logicalKey || "") || !KEY.test(item.dedupeKey || "")) return href;
  // Only our two workspace destinations receive context. No private payload in URLs.
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const target = new URL(href, "https://applendium.com");
  if (target.origin !== "https://applendium.com"
    || !["/apply-gate", "/resumes"].includes(target.pathname)) return href;
  target.searchParams.set("action", item.logicalKey!);
  target.searchParams.set("version", item.dedupeKey!);
  return `${target.pathname}${target.search}${target.hash}`;
}
