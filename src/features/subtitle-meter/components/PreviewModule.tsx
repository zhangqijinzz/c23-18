import { useLayoutEffect, useMemo, useRef } from "react";
import type { SubtitleCue } from "../models";
import type { SubtitleMeterViewModel } from "../viewmodels/subtitleMeterViewModel";
import {
  CAPACITY_EM_PER_LINE,
  compactCapacityEm,
  layoutCaption,
  visibleCharCount,
} from "../utils/textLayout";

// 与 .preview-caption 基础字号保持一致（rows-2/rows-3 仅缩小到 11px，
// 容量测量按 12px 基准取值，对两条硬换行的字幕只会更保守）。
const BASE_FONT_PX = 12;

export function PreviewModule({
  cue,
  vm,
  capacityEm = CAPACITY_EM_PER_LINE,
}: {
  cue?: SubtitleCue;
  vm: SubtitleMeterViewModel;
  capacityEm?: number;
}) {
  const frameRef = useRef<HTMLDivElement>(null),
    probeRef = useRef<HTMLSpanElement>(null);

  // 直接测量标题安全区中字幕的可用内容宽度，折行口径与浏览器实际渲染一致。
  useLayoutEffect(() => {
    const measure = () => {
      const available = probeRef.current?.clientWidth ?? 0;
      if (available > 0) vm.setLineCapacity(available / BASE_FONT_PX);
    };
    measure();
    const frame = frameRef.current;
    if (!frame) return;
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(measure);
      observer.observe(frame);
    } else {
      window.addEventListener("resize", measure);
    }
    if (document.fonts) void document.fonts.ready.then(measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [vm]);

  const hardLines = cue?.text.split("\n") ?? [];
  const layout = useMemo(
    () =>
      cue
        ? layoutCaption(cue.text, capacityEm, compactCapacityEm(capacityEm))
        : null,
    [cue, capacityEm],
  );

  return (
    <section className="module preview-module">
      <div className="module-head">
        <div>
          <span className="module-kicker">SAFE AREA</span>
          <h2>画面预览</h2>
        </div>
        <span className="safe-label">标题安全区</span>
      </div>
      <div className="preview-screen">
        <div className="safe-frame" ref={frameRef}>
          <span className="frame-label">90% SAFE</span>
          {/* 容量探针：不可见但占满字幕可用宽度，用于实测一行能放多少 em */}
          <span className="capacity-probe" ref={probeRef} aria-hidden="true" />
          <div
            className={`preview-caption rows-${Math.min(hardLines.length, 3)}`}
          >
            {hardLines.length ? (
              hardLines.map((line, index) => (
                <span key={`${index}-${line}`}>{line || " "}</span>
              ))
            ) : (
              <span className="preview-placeholder">字幕将在此显示</span>
            )}
          </div>
        </div>
      </div>
      <div className="preview-meta">
        <span>{layout?.lineCount ?? 0} 行字幕</span>
        <span>{cue ? visibleCharCount(cue.text) : 0} 字符</span>
        <span>底部居中</span>
      </div>
    </section>
  );
}
