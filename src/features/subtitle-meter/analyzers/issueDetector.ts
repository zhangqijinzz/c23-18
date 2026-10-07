import type { SubtitleCue, SubtitleIssue } from "../models";
import {
  CAPACITY_EM_PER_LINE,
  compactCapacityEm,
  layoutCaption,
  visibleCharCount,
} from "../utils/textLayout";

export function detectIssues(
  cues: SubtitleCue[],
  capacityEm: number = CAPACITY_EM_PER_LINE,
): SubtitleIssue[] {
  const issues: SubtitleIssue[] = [];
  const add = (
    cue: SubtitleCue,
    type: SubtitleIssue["type"],
    severity: SubtitleIssue["severity"],
    message: string,
  ) =>
    issues.push({
      id: `${cue.id}-${type}-${issues.length}`,
      cueId: cue.id,
      type,
      severity,
      message,
    });
  const ordered = [...cues].sort((a, b) => a.startMs - b.startMs);
  ordered.forEach((cue, i) => {
    const duration = cue.endMs - cue.startMs,
      chars = visibleCharCount(cue.text);
    if (!cue.text.trim()) add(cue, "empty", "error", "字幕文本为空");
    if (duration <= 0)
      add(cue, "invalid-time", "error", "结束时间必须晚于开始时间");
    else {
      if (duration < 800)
        add(
          cue,
          "too-short",
          "warning",
          `显示仅 ${(duration / 1000).toFixed(1)} 秒`,
        );
      const cps = chars / (duration / 1000);
      if (cps > 18)
        add(cue, "too-fast", "warning", `阅读速度 ${cps.toFixed(1)} 字/秒`);
    }
    // 行数与宽度统一走排版规则：
    // 显式换行 + 超宽自动折行共同决定实际行数，宽度按中英/全角半角加权。
    const layout = layoutCaption(
      cue.text,
      capacityEm,
      compactCapacityEm(capacityEm),
    );
    if (layout.overLineLimit)
      add(
        cue,
        "too-long",
        "warning",
        `实际显示 ${layout.lineCount} 行，超过两行，画面占用较高`,
      );
    else if (layout.lineOverflow)
      add(
        cue,
        "too-long",
        "warning",
        "单行内容超过画面安全区宽度，建议手动换行或精简",
      );
    const next = ordered[i + 1];
    if (next && next.startMs < cue.endMs)
      add(
        next,
        "overlap",
        "error",
        `与第 ${cue.index} 条字幕重叠 ${((cue.endMs - next.startMs) / 1000).toFixed(1)} 秒`,
      );
    else if (next && next.startMs - cue.endMs < 120)
      add(next, "too-short", "info", "与上一条间隔不足 0.12 秒");
  });
  return issues;
}
