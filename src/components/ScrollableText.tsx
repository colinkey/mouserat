import React, { useRef, useState, useEffect } from "react";
import { Box, Text, measureElement } from "ink";
import type { DOMElement } from "ink";

export function computeScrollWindow(lines: string[], offset: number, height: number): string[] {
  if (height <= 0) return [];
  const maxOffset = Math.max(0, lines.length - height);
  const clamped = Math.max(0, Math.min(offset, maxOffset));
  return lines.slice(clamped, clamped + height);
}

interface Props {
  text: string;
  scrollOffset: number;
  onHeightChange?: (height: number) => void;
}

export function ScrollableText({ text, scrollOffset, onHeightChange }: Props) {
  const boxRef = useRef<DOMElement>(null);
  const [visibleHeight, setVisibleHeight] = useState(0);

  useEffect(() => {
    if (!boxRef.current) return;
    const { height } = measureElement(boxRef.current);
    setVisibleHeight(height);
    onHeightChange?.(height);
  });

  const lines = text.split("\n");
  const visible = computeScrollWindow(lines, scrollOffset, visibleHeight);
  const maxOffset = Math.max(0, lines.length - visibleHeight);
  const clamped = Math.max(0, Math.min(scrollOffset, maxOffset));
  const canScrollUp = clamped > 0;
  const canScrollDown = clamped < maxOffset;

  return (
    <Box ref={boxRef} flexGrow={1} flexDirection="column" overflow="hidden">
      {visible.map((line, i) => (
        <Text key={i}>{line}</Text>
      ))}
      {(canScrollUp || canScrollDown) && (
        <Box>
          {canScrollUp && <Text dimColor>↑ </Text>}
          {canScrollDown && <Text dimColor>↓ </Text>}
          <Text dimColor>({clamped + 1}–{Math.min(clamped + visibleHeight, lines.length)}/{lines.length})</Text>
        </Box>
      )}
    </Box>
  );
}
