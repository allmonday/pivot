import { useCallback } from "react";

interface ResizableConfig {
  /** "horizontal" = 左右拖拽调整宽度, "vertical" = 上下拖拽调整高度 */
  direction: "horizontal" | "vertical";
  /** 当前尺寸值 */
  size: number;
  /** 尺寸更新回调 */
  onSizeChange: (size: number) => void;
  /** 最小值 */
  min: number;
  /** 最大值 */
  max: number;
}

/**
 * 封装鼠标拖拽 resize 逻辑。
 * 返回可直接传给 ResizeHandle 的 onMouseDown。
 */
export function useResizable(config: ResizableConfig) {
  const { direction, size, onSizeChange, min, max } = config;

  return useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const isHorizontal = direction === "horizontal";
      const startPos = isHorizontal ? e.clientX : e.clientY;
      const startSize = size;

      const onMove = (ev: MouseEvent) => {
        const delta = isHorizontal ? startPos - ev.clientX : startPos - ev.clientY;
        onSizeChange(Math.max(min, Math.min(max, startSize + delta)));
      };

      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [direction, size, onSizeChange, min, max],
  );
}
