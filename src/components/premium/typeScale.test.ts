import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

import { TYPE_SCALE_PX } from "./tone";

// The Dashboard used 11 font sizes (designer review, 2026-10-14). The shell's pages and shared
// components now use only the six sizes of the scale; this fails if an off-scale size creeps back.
const FILES = [
  "src/pages/DashboardNew.tsx",
  "src/pages/FixSuggestions.tsx",
  "src/pages/StrategyAlerts.tsx",
  "src/pages/Settings.tsx",
  "src/components/premium/PremiumUI.tsx",
  "src/components/premium/tone.ts",
  "src/components/premium/WeekInReview.tsx",
  "src/components/InterviewDebriefCards.tsx",
  "src/components/AskApplendium.tsx",
  "src/components/AppSidebar.tsx",
  "src/components/YourDataPanel.tsx",
];

describe("type scale", () => {
  test.each(FILES)("%s uses only scale sizes", (file) => {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");
    const sizes = Array.from(source.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g), (match) => Number(match[1]));
    const offScale = sizes.filter((size) => !(TYPE_SCALE_PX as readonly number[]).includes(size));
    expect(offScale).toEqual([]);
  });
});
