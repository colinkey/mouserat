import React from "react";
import { Box, Text } from "ink";
import type { RequestLog } from "../types/index.ts";

interface Props {
  log: RequestLog;
}

function formatTimestamp(iso: string): string {
  return iso.slice(0, 19).replace("T", " ");
}

export function LogScreen({ log }: Props) {
  const { request, execution, response, collection, environment, timestamp, durationMs } = log;

  return (
    <Box flexGrow={1}>
      {/* Left pane: execution details */}
      <Box flexDirection="column" width="50%" padding={1} borderStyle="single" borderRight borderTop={false} borderBottom={false} borderLeft={false}>
        <Text bold>{request.name}</Text>
        <Text dimColor>{formatTimestamp(timestamp)}  {durationMs}ms</Text>

        <Box marginTop={1}>
          <Text color="magenta">{execution.method}</Text>
          <Text>{"  "}{execution.url}</Text>
        </Box>

        <Box marginTop={1}>
          <Text dimColor>collection: </Text>
          <Text>{collection.name}</Text>
        </Box>

        {environment ? (
          <Box>
            <Text dimColor>environment: </Text>
            <Text>{environment.name}</Text>
          </Box>
        ) : null}

        {execution.headers && Object.keys(execution.headers).length > 0 ? (
          <Box flexDirection="column" marginTop={1}>
            <Text underline>Headers</Text>
            {Object.entries(execution.headers).map(([k, v]) => (
              <Text key={k} dimColor>{k}: {v}</Text>
            ))}
          </Box>
        ) : null}

        {execution.body != null ? (
          <Box flexDirection="column" marginTop={1}>
            <Text underline>Body</Text>
            <Text dimColor>{JSON.stringify(execution.body, null, 2)}</Text>
          </Box>
        ) : null}

        {execution.jqFilter ? (
          <Box marginTop={1}>
            <Text dimColor>jq: </Text>
            <Text color="yellow">{execution.jqFilter}</Text>
          </Box>
        ) : null}
      </Box>

      {/* Right pane: response */}
      <Box flexDirection="column" width="50%" padding={1}>
        {response.stderr && !response.stdout ? (
          <Text color="red">{response.stderr}</Text>
        ) : (
          <Text>{response.stdout}</Text>
        )}
      </Box>
    </Box>
  );
}
