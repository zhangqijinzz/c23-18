import { describe, expect, it } from "vitest";
import {
  CAPACITY_EM_PER_LINE,
  charWidthEm,
  compactCapacityEm,
  layoutCaption,
} from "../utils/textLayout";
import { detectIssues } from "../analyzers/issueDetector";
import type { SubtitleCue } from "../models";

const cue = (
  id: string,
  startMs: number,
  endMs: number,
  text: string,
): SubtitleCue => ({ id, index: Number(id), startMs, endMs, text });

const tooLongTypes = (text: string) =>
  detectIssues([cue("1", 0, 5000, text)])
    .filter((issue) => issue.type === "too-long")
    .map((issue) => issue.message);

describe("shared text layout rules", () => {
  it("weights full-width and half-width characters differently", () => {
    expect(charWidthEm("字".codePointAt(0)!)).toBe(1);
    expect(charWidthEm("，".codePointAt(0)!)).toBe(1);
    expect(charWidthEm("a".codePointAt(0)!)).toBeLessThan(0.7);
    expect(charWidthEm("1".codePointAt(0)!)).toBeLessThan(0.7);
  });

  it("keeps two explicit short lines as two rows", () => {
    const layout = layoutCaption("第一行\n第二行", CAPACITY_EM_PER_LINE);
    expect(layout.lineCount).toBe(2);
    expect(layout.overLineLimit).toBe(false);
    expect(layout.lineOverflow).toBe(false);
  });

  it("wraps one over-long hard line into several visual rows", () => {
    const text = "这".repeat(45);
    const layout = layoutCaption(text, CAPACITY_EM_PER_LINE);
    expect(layout.lineCount).toBeGreaterThan(2);
    expect(layout.overLineLimit).toBe(true);
  });

  it("does not count a narrow mixed line by raw character count", () => {
    // 24 个码位，但半角内容多，宽度不到一行 21em，且只有一个硬换行对。
    const text = "Hello world, this is fine";
    const layout = layoutCaption(text, CAPACITY_EM_PER_LINE);
    expect(layout.lineCount).toBe(1);
    expect(layout.overLineLimit).toBe(false);
    expect(layout.lineOverflow).toBe(false);
  });

  it("does not flag compliant two-line captions", () => {
    expect(tooLongTypes("第一行短句\n第二行短句")).toEqual([]);
    expect(tooLongTypes("Hello world\n你好世界")).toEqual([]);
  });

  it("uses the wider compact capacity for two-line captions (11px row)", () => {
    // 22 个全角字：单行口径（12px，21em）会折行，
    // 但两条硬换行时预览降到 11px，每行放得下，不应误报。
    const twoLongLines = `${"字".repeat(22)}\n${"字".repeat(22)}`;
    expect(layoutCaption(twoLongLines).lineCount).toBe(2);
    expect(layoutCaption(twoLongLines).lineOverflow).toBe(false);
    expect(tooLongTypes(twoLongLines)).toEqual([]);
    // 再宽一个字就会折成三行。
    const overLine = `${"字".repeat(23)}\n${"字".repeat(23)}`;
    expect(layoutCaption(overLine).lineCount).toBeGreaterThan(2);
    expect(tooLongTypes(overLine).join("")).toContain("超过两行");
  });

  it("derives compact capacity from the measured base capacity", () => {
    expect(compactCapacityEm(21)).toBeCloseTo(22.9, 1);
    expect(compactCapacityEm(21)).toBeGreaterThan(21);
  });

  it("flags long single-line text that visually wraps past two rows", () => {
    const messages = tooLongTypes("这".repeat(45));
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("超过两行");
  });

  it("flags three explicit lines even when each is short", () => {
    const messages = tooLongTypes("一\n二\n三");
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("超过两行");
  });

  it("keeps a long English word from breaking inside the word", () => {
    const word = "supercalifragilisticexpialidocious".repeat(2);
    const layout = layoutCaption(word, CAPACITY_EM_PER_LINE);
    expect(layout.lines).toHaveLength(1);
    expect(layout.lines[0]).toBe(word);
    expect(layout.lineOverflow).toBe(true);
  });
});
