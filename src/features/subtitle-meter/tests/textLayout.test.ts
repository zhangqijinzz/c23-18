import { describe, expect, it } from "vitest";
import {
  countVisualLines,
  LINE_CAPACITY_UNITS,
  measureLineUnits,
  wrappedLineCount,
} from "../analyzers/textLayout";

describe("text layout metrics", () => {
  it("measures width by display units, not character count", () => {
    expect(measureLineUnits("abc")).toBe(3); // 半角字符各占 1 单位
    expect(measureLineUnits("你好呀")).toBe(6); // 全角字符各占 2 单位
    expect(measureLineUnits("你好abc")).toBe(7); // 中英混排
    expect(measureLineUnits("，。！？")).toBe(8); // 全角标点按全角计宽
    expect(measureLineUnits("ＡＢＣ")).toBe(6); // 全角字母
    expect(measureLineUnits("ｱｲｳ")).toBe(3); // 半角假名仍按半角计
  });
  it("wraps a logical line by the safe-area capacity", () => {
    expect(wrappedLineCount("汉".repeat(21))).toBe(1);
    expect(wrappedLineCount("汉".repeat(22))).toBe(2);
    expect(wrappedLineCount("汉".repeat(42))).toBe(2);
    expect(wrappedLineCount("汉".repeat(43))).toBe(3);
    expect(wrappedLineCount("a".repeat(LINE_CAPACITY_UNITS))).toBe(1);
    expect(wrappedLineCount("a".repeat(LINE_CAPACITY_UNITS + 1))).toBe(2);
  });
  it("ignores blank segments that render invisibly in the preview", () => {
    expect(countVisualLines("第一行\n\n第二行")).toBe(2);
    expect(countVisualLines("第一行\n第二行\n")).toBe(2);
    expect(countVisualLines("  \n  ")).toBe(0);
    expect(countVisualLines("")).toBe(0);
  });
  it("sums wrapped lines across logical lines", () => {
    expect(countVisualLines(`${"汉".repeat(22)}\n短句`)).toBe(3);
    expect(countVisualLines("汉".repeat(42))).toBe(2);
  });
});
