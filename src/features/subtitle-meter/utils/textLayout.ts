// 预览与检查共用的一套「行数 / 宽度」排版规则。
// 宽度以 em 计：1em = 当前字号下一个全角字符的宽度，半角字符约 0.5em。
// 这样中英混排、标点与全角字符不会被简单按个数计算，
// 行数也不只是数 "\n"，而是按一行实际能放下多少宽度做折行。

export const MAX_VISUAL_LINES = 2;

// 检查口径下每行可用宽度（em）。
// 42 个全角字符分两行的历史上限，即每行约 21 个全角字。
export const CAPACITY_EM_PER_LINE = 21;

// 两行及以上字幕在预览里会降到 11px（单行时为 12px），
// 同一像素宽度下可容纳的 em 数按字号比例放宽。
export const CAPACITY_EM_COMPACT =
  Math.round(CAPACITY_EM_PER_LINE * (12 / 11) * 10) / 10;

export interface CaptionLayout {
  /** 实际显示出来的行数（显式换行 + 超宽自动折行） */
  lineCount: number;
  /** 每一行视觉行的宽度（em） */
  lineWidths: number[];
  /** 最宽一行的宽度（em） */
  maxLineWidth: number;
  /** 按宽度折行后的视觉行文本 */
  lines: string[];
  /** 是否超过允许的最大行数 */
  overLineLimit: boolean;
  /** 是否存在某一行（超宽折出的视觉行）放不下的情况 */
  lineOverflow: boolean;
}

const inRange = (code: number, start: number, end: number) =>
  code >= start && code <= end;

// 组合附加符号（如声调符）本身不占前进宽度。
const isCombiningMark = (code: number) =>
  inRange(code, 0x0300, 0x036f) ||
  inRange(code, 0x1ab0, 0x1aff) ||
  inRange(code, 0x1dc0, 0x1dff) ||
  inRange(code, 0x20d0, 0x20ff) ||
  inRange(code, 0xfe20, 0xfe2f);

// 行首禁则：不能出现在一行开头的结束类标点。
const isClosingPunctuation = (code: number) =>
  /[）】》」』｝〉？！，。、；：．…—·.,!?;:)%\]}‰′～℃々]/.test(
    String.fromCodePoint(code),
  );

// 行尾禁则：不能出现在一行结尾的开始类标点。
const isOpeningPunctuation = (code: number) =>
  /[（【《「『｛〈([{]/.test(String.fromCodePoint(code));

// 单个码位的前进宽度（em）。全角 1，半角约 0.5，组合符号 0。
export function charWidthEm(codePoint: number): number {
  if (isCombiningMark(codePoint)) return 0;
  // ASCII：控制字符与空白按半角处理（空格在折行时另有规则）。
  if (codePoint < 0x80) {
    if (/\s/.test(String.fromCodePoint(codePoint))) return 0.3;
    return 0.55;
  }
  // 拉丁补充、拉丁扩展等窄字形。
  if (
    inRange(codePoint, 0x80, 0x24f) ||
    inRange(codePoint, 0x1e00, 0x1eff) ||
    inRange(codePoint, 0x2c60, 0x2c7f)
  )
    return 0.55;
  // 变体选择符、零宽类不占宽。
  if (
    inRange(codePoint, 0xfe00, 0xfe0f) ||
    inRange(codePoint, 0xe0100, 0xe01ef) ||
    inRange(codePoint, 0x200b, 0x200f)
  )
    return 0;
  // CJK 标点（全角）、表意文字、全角符号与假名等按 1em。
  if (
    inRange(codePoint, 0x1100, 0x115f) || // 谚文兼容字母
    inRange(codePoint, 0x2e80, 0x31ff) || // CJK 部首/标点/假名/注音
    inRange(codePoint, 0x3200, 0x4dbf) || // 全角符号、CJK 扩展A
    inRange(codePoint, 0x4e00, 0x9fff) || // CJK 统一表意文字
    inRange(codePoint, 0xa000, 0xa4cf) || // 彝文
    inRange(codePoint, 0xac00, 0xd7a3) || // 谚文音节
    inRange(codePoint, 0xf900, 0xfaff) || // CJK 兼容表意
    inRange(codePoint, 0xfe30, 0xfe6f) || // CJK 兼容标点（含半角标点形式）
    inRange(codePoint, 0xff00, 0xff60) || // 全角 ASCII
    inRange(codePoint, 0xffe0, 0xffe6) || // 全角符号
    inRange(codePoint, 0x1f300, 0x1faff) || // 符号与 emoji
    inRange(codePoint, 0x20000, 0x3fffd) // CJK 扩展 B 以后
  )
    return 1;
  // 常见全角破折号、省略号、间隔号等。
  if (codePoint === 0x2014 || codePoint === 0x2026 || codePoint === 0x2027)
    return 1;
  // 其余字符（含大量普通符号）按半角保守估算。
  return 0.55;
}

interface Segment {
  text: string;
  width: number;
  /** CJK 类段：前后几乎都可断行 */
  cjk: boolean;
  space: boolean;
}

// 把一行文本拆成折行最小单元：空格、连续半角词、单个 CJK 字符。
function segmentize(text: string): Segment[] {
  const segments: Segment[] = [];
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (/\s/.test(ch)) {
      segments.push({
        text: ch,
        width: charWidthEm(code),
        cjk: false,
        space: true,
      });
    } else {
      const full = charWidthEm(code) >= 1;
      segments.push({
        text: ch,
        width: charWidthEm(code),
        cjk: full,
        space: false,
      });
    }
  }
  // 合并相邻半角字符为一个「词」，词内不断行（与浏览器 white-space: normal 一致）。
  const merged: Segment[] = [];
  for (const seg of segments) {
    const prev = merged.at(-1);
    if (prev && !seg.cjk && !seg.space && !prev.cjk && !prev.space) {
      prev.text += seg.text;
      prev.width += seg.width;
    } else merged.push({ ...seg });
  }
  return merged;
}

// 模拟浏览器 normal 折行：返回一行硬换行内折出的视觉行。
function wrapHardLine(text: string, capacityEm: number): string[] {
  if (text === "") return [""];
  const segments = segmentize(text);
  const visualLines: Segment[][] = [[]];
  let currentWidth = 0;

  const pushLine = (segs: Segment[]) => {
    visualLines.push(segs);
    currentWidth = segs.reduce((sum, seg) => sum + seg.width, 0);
  };

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const line = visualLines[visualLines.length - 1];

    // 行尾空格直接折叠，不参与排版宽度。
    if (seg.space && line.length === 0) continue;

    if (line.length === 0) {
      // 行首禁则：结束类标点挂到上一行，当前行仍为空。
      const code = seg.text.codePointAt(0) ?? 0;
      if (!seg.space && visualLines.length > 1 && isClosingPunctuation(code)) {
        visualLines[visualLines.length - 2].push(seg);
        continue;
      }
      line.push(seg);
      currentWidth = seg.width;
      continue;
    }

    const next = segments[i + 1];
    // 行尾禁则：开始类标点必须和后续字符同行，先收进当前行。
    const code = seg.text.codePointAt(0) ?? 0;
    const glueOpening =
      !seg.space && isOpeningPunctuation(code) && next && !next.space;

    if (glueOpening || currentWidth + seg.width <= capacityEm + 1e-9) {
      line.push(seg);
      currentWidth += seg.width;
      continue;
    }

    // 空格处可断：丢弃该空格换行。
    if (seg.space) {
      pushLine([]);
      continue;
    }
    // CJK 段：行内任意位置可断，直接另起一行。
    // 半角词：词内不断（过长则溢出），整体另起一行。
    pushLine([seg]);
  }

  return visualLines.map((line) =>
    line
      .map((seg) => seg.text)
      .join("")
      .replace(/\s+$/g, ""),
  );
}

// 一条字幕文本的完整排版：先按显式换行切段，再对每段做宽度折行。
// 容量按硬换行数选择，与预览里 rows-1（12px）/rows-2+（11px）字号规则一致。
export function layoutCaption(
  text: string,
  capacityEm: number = CAPACITY_EM_PER_LINE,
  compactCapacityEm: number = CAPACITY_EM_COMPACT,
): CaptionLayout {
  const hardLines = text.split("\n");
  const capacity = hardLines.length >= 2 ? compactCapacityEm : capacityEm;
  const lines = hardLines.flatMap((hard) => wrapHardLine(hard, capacity));
  const lineWidths = lines.map((line) =>
    [...line].reduce((sum, ch) => sum + charWidthEm(ch.codePointAt(0) ?? 0), 0),
  );
  const maxLineWidth = lineWidths.reduce((max, w) => Math.max(max, w), 0);
  return {
    lineCount: lines.length,
    lineWidths,
    maxLineWidth,
    lines,
    overLineLimit: lines.length > MAX_VISUAL_LINES,
    lineOverflow: lineWidths.some((w) => w > capacity + 1e-9),
  };
}

// 非空白字符数（阅读速度等仍按字符计，与排版宽度口径分离）。
export function visibleCharCount(text: string): number {
  return [...text.replace(/\s/g, "")].length;
}

// 由实测的单行容量（12px 基准）换算两行字幕（11px）容量。
export function compactCapacityEm(baseCapacityEm: number): number {
  return Math.round(baseCapacityEm * (12 / 11) * 10) / 10;
}
