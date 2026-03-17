import React from "react";
import { Box, Text } from "ink";
import type { Environment } from "../types/index.ts";

interface Props {
  activeEnvironment: Environment | null;
  hints: string[];
}

export function StatusBar({ activeEnvironment, hints }: Props) {
  const envLabel = activeEnvironment ? activeEnvironment.name : "No environment";

  return (
    <Box borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} paddingX={1} justifyContent="space-between">
      <Text dimColor>
        {hints.map((hint, i) => {
          const spaceIdx = hint.indexOf(" ");
          const key = spaceIdx === -1 ? hint : hint.slice(0, spaceIdx);
          const label = spaceIdx === -1 ? "" : hint.slice(spaceIdx);
          return (i > 0 ? "  " : "") + `[${key}]${label}`;
        }).join("")}
      </Text>
      <Text color={activeEnvironment ? "green" : "yellow"}>{envLabel}</Text>
    </Box>
  );
}
