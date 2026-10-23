"use client";

import type { ElementType } from "react";
import { Mark, MarkerText, type MarkType } from "@/components/kokonutui/marker-text";

// Hand-drawn marks in Maskati colours: a mint-olive wash for highlights, olive ink for lines.
const COLORS: Record<MarkType, string> = {
  highlight: "rgba(169, 189, 120, 0.45)",
  underline: "#6f8541",
  circle: "#6f8541",
  box: "#6f8541",
  strike: "#b23a2a",
};
const PATTERN = /\[\[(.+?)\]\]|__(.+?)__|\(\((.+?)\)\)|\{\{(.+?)\}\}/g;
const TYPES: MarkType[] = ["highlight", "underline", "circle", "box"];

/** Removes the marking syntax, for places that can't draw (emails, alt text). */
export const plain = (text: string) => text.replace(PATTERN, (_m, a, b, c, d) => a ?? b ?? c ?? d);

/**
 * Text with hand-drawn marks. Write [[highlight]], __underline__, ((circle)) or {{box}}
 * around a phrase; the marks draw in reading order when the text scrolls into view.
 */
export function Marked({ text, as = "p", className }: { text: string; as?: ElementType; className?: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(PATTERN)) {
    if (m.index! > last) parts.push(text.slice(last, m.index));
    const g = [m[1], m[2], m[3], m[4]];
    const k = g.findIndex((x) => x !== undefined);
    const type = TYPES[k];
    parts.push(<Mark color={COLORS[type]} key={i++} type={type}>{g[k]}</Mark>);
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  if (!i) {
    const Tag = as;
    return <Tag className={className}>{text}</Tag>;
  }
  return <MarkerText as={as} className={className}>{parts}</MarkerText>;
}
