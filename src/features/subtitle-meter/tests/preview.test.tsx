import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PreviewModule } from "../components/PreviewModule";
import { countVisualLines } from "../analyzers/textLayout";
import type { SubtitleCue } from "../models";

const cue = (text: string): SubtitleCue => ({
  id: "cue-1",
  index: 1,
  startMs: 0,
  endMs: 2000,
  text,
});

describe("preview line count", () => {
  it("displays the same visual line count used by inspection", () => {
    const samples = [
      "第一行\n\n第二行",
      "汉".repeat(22),
      `${"汉".repeat(22)}\n短句`,
    ];
    for (const text of samples) {
      const html = renderToStaticMarkup(<PreviewModule cue={cue(text)} />);
      expect(html).toContain(`${countVisualLines(text)} 行字幕`);
    }
  });
});
