import { describe, expect, it } from "vitest";
import { detectIssues } from "../analyzers/issueDetector";
import type { SubtitleCue } from "../models";
const cue = (
  id: string,
  startMs: number,
  endMs: number,
  text: string,
): SubtitleCue => ({ id, index: Number(id), startMs, endMs, text });
describe("issue detection", () => {
  it("distinguishes touching edges from overlap", () => {
    expect(
      detectIssues([cue("1", 0, 1000, "A"), cue("2", 1000, 2000, "B")]).some(
        (i) => i.type === "overlap",
      ),
    ).toBe(false);
    expect(
      detectIssues([cue("1", 0, 1300, "A"), cue("2", 1000, 2000, "B")]).some(
        (i) => i.type === "overlap",
      ),
    ).toBe(true);
  });
  it("detects empty, short, fast, and long captions", () => {
    const issues = detectIssues([
      cue("1", 0, 100, ""),
      cue("2", 1000, 1300, "这是一个用于检查速度的非常长的字幕内容".repeat(3)),
    ]);
    expect(issues.map((i) => i.type)).toEqual(
      expect.arrayContaining(["empty", "too-short", "too-fast", "too-long"]),
    );
  });
  it("counts visual lines with the same rule as the preview", () => {
    // 空白行在预览中不可见，两行文本不算超行
    expect(
      detectIssues([cue("1", 0, 2000, "第一行\n\n第二行")]).some(
        (i) => i.type === "too-long",
      ),
    ).toBe(false);
    expect(
      detectIssues([cue("2", 0, 2000, "第一行\n第二行\n")]).some(
        (i) => i.type === "too-long",
      ),
    ).toBe(false);
    // 折行后超过两行的内容会被检出
    const tooLong = detectIssues([
      cue("3", 0, 4000, `${"汉".repeat(22)}\n短句`),
    ]).find((i) => i.type === "too-long");
    expect(tooLong?.message).toBe("超过两行，画面占用较高");
    // 刚好占满两行的内容本就合规，不能误报
    expect(
      detectIssues([cue("4", 0, 4000, "汉".repeat(42))]).some(
        (i) => i.type === "too-long",
      ),
    ).toBe(false);
  });
});
