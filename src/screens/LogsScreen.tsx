import React from "react";
import { Box, Text } from "ink";
import type { RequestLog } from "../types/index.ts";

interface Props {
  logs: RequestLog[];
  selectedIndex: number;
}

function formatTimestamp(iso: string): string {
  return iso.slice(0, 19).replace("T", " ");
}

export function LogsScreen({ logs, selectedIndex }: Props) {
  if (logs.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text dimColor>No request logs yet.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Request History</Text>
      <Box marginTop={1} flexDirection="column">
        {logs.map((log, i) => {
          const isSelected = i === selectedIndex;
          const exitOk = log.response.exitCode === 0;
          return (
            <Box key={`${log.timestamp}-${log.request.id}-${i}`}>
              <Text color={isSelected ? "cyan" : undefined}>
                {isSelected ? "> " : "  "}
                <Text dimColor>{formatTimestamp(log.timestamp)}  </Text>
                <Text color="magenta">{log.request.method.padEnd(7)}</Text>
                {"  "}
                {log.request.name}
                <Text dimColor>  {log.request.url}</Text>
                {"  "}
                <Text color={exitOk ? "green" : "red"}>[{log.response.exitCode}]</Text>
                <Text dimColor>  {log.durationMs}ms</Text>
              </Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
