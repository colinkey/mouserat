import React from "react";
import { Box, Text } from "ink";
import type { Request } from "../types/index.ts";

interface Props {
  request: Request;
  response: string | null;
  isLoading: boolean;
  jqFilter: string;
}

export function RequestScreen({ request, response, isLoading, jqFilter }: Props) {
  return (
    <Box flexGrow={1}>
      {/* Left pane: request details */}
      <Box flexDirection="column" width="50%" padding={1} borderStyle="single" borderRight borderTop={false} borderBottom={false} borderLeft={false}>
        <Text bold>{request.name}</Text>
        <Box marginTop={1}>
          <Text color="magenta">{request.method}</Text>
          <Text>{"  "}{request.url}</Text>
        </Box>

        {request.headers && Object.keys(request.headers).length > 0 ? (
          <Box flexDirection="column" marginTop={1}>
            <Text underline>Headers</Text>
            {Object.entries(request.headers).map(([k, v]) => (
              <Text key={k} dimColor>{k}: {v}</Text>
            ))}
          </Box>
        ) : null}

        {request.body != null ? (
          <Box flexDirection="column" marginTop={1}>
            <Text underline>Body</Text>
            <Text dimColor>{JSON.stringify(request.body, null, 2)}</Text>
          </Box>
        ) : null}

        {jqFilter ? (
          <Box marginTop={1}>
            <Text dimColor>jq: </Text>
            <Text color="yellow">{jqFilter}</Text>
          </Box>
        ) : null}
      </Box>

      {/* Right pane: response */}
      <Box flexDirection="column" width="50%" padding={1}>
        {isLoading ? (
          <Text color="yellow">Running...</Text>
        ) : response != null ? (
          <Text>{response}</Text>
        ) : (
          <Text dimColor>Press enter to execute request.</Text>
        )}
      </Box>
    </Box>
  );
}
