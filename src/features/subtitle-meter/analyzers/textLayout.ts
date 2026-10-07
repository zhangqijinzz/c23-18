// 预览安全区的行数与宽度标准：问题检查、画面预览与导出统计共用同一套口径。
// 行宽按半角单位计算：全角字符（汉字、全角标点等）占 2 个单位，半角字符占 1 个。
export const LINE_CAPACITY_UNITS = 42; // 一行约容纳 21 个全角字符
export const MAX_VISUAL_LINES = 2;

// 全角 / 宽字符区间（East Asian Wide 与 Fullwidth）
const WIDE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x1100, 0x115f], // 谚文字母
  [0x2329, 0x232a], // 全角尖括号
  [0x2e80, 0x303e], // CJK 部首、表意文字符号与标点（含全角空格、。、「」等）
  [0x3041, 0x33ff], // 假名、注音符号、CJK 兼容符号
  [0x3400, 0x4dbf], // CJK 统一表意文字扩展 A
  [0x4e00, 0x9fff], // CJK 统一表意文字
  [0xa000, 0xa4cf], // 彝文音节
  [0xa960, 0xa97f], // 谚文扩展字母
  [0xac00, 0xd7a3], // 谚文音节
  [0xf900, 0xfaff], // CJK 兼容表意文字
  [0xfe10, 0xfe19], // 竖排标点
  [0xfe30, 0xfe6f], // CJK 兼容形式、小写变体
  [0xff00, 0xff60], // 全角 ASCII 与全角标点
  [0xffe0, 0xffe6], // 全角货币等符号
  [0x1f300, 0x1f64f], // 表情符号
  [0x1f900, 0x1f9ff], // 补充表情符号
  [0x20000, 0x3fffd], // CJK 扩展 B 及以后
];

// 组合附加符号等零宽字符不占宽度
const ZERO_WIDTH_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0300, 0x036f],
  [0x1ab0, 0x1aff],
  [0x1dc0, 0x1dff],
  [0x20d0, 0x20ff],
  [0xfe20, 0xfe2f],
];

function inRanges(
  codePoint: number,
  ranges: ReadonlyArray<readonly [number, number]>,
): boolean {
  return ranges.some(([start, end]) => codePoint >= start && codePoint <= end);
}

export function charWidthUnits(char: string): 0 | 1 | 2 {
  const codePoint = char.codePointAt(0);
  if (codePoint === undefined || inRanges(codePoint, ZERO_WIDTH_RANGES))
    return 0;
  return inRanges(codePoint, WIDE_RANGES) ? 2 : 1;
}

// 单行文本的显示宽度（半角单位），按码点遍历以正确处理代理对
export function measureLineUnits(line: string): number {
  let units = 0;
  for (const char of line) units += charWidthUnits(char);
  return units;
}

// 一个逻辑行（不含换行）折行后占用的视觉行数；空白行在预览中不可见，不计入行数
export function wrappedLineCount(line: string): number {
  const units = measureLineUnits(line.trim());
  return units === 0 ? 0 : Math.ceil(units / LINE_CAPACITY_UNITS);
}

// 整条字幕在安全区内的视觉行数：既考虑换行符，也考虑一行实际能放下的内容
export function countVisualLines(text: string): number {
  return text
    .split("\n")
    .reduce((total, line) => total + wrappedLineCount(line), 0);
}
