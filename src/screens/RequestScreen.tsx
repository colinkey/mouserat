import React from "react";
import { Box, Text } from "ink";
import type { Collection, Environment, Execution, Request } from "../types/index.ts";

interface Props {
  request: Request;
  collection: Collection;
  environment: Environment | null;
  response: string | null;
  isLoading: boolean;
  executionContext: Omit<Execution, "url"> | null;
}

export function RequestScreen({ request, collection, environment, response, isLoading, executionContext }: Props) {
  const method = executionContext?.method ?? request.method;
  const body = executionContext?.body !== undefined ? executionContext.body : request.body;
  const jqFilter = executionContext?.jqFilter !== undefined ? executionContext.jqFilter : request.jqFilter;
  const overrideHeaders = executionContext?.headers && Object.keys(executionContext.headers).length > 0
    ? executionContext.headers
    : null;

  const effectiveUrl = request.rootUrl
    ? `${request.rootUrl}${request.relativeUrl ?? ""}`
    : `${collection.rootUrl ?? environment?.rootUrl ?? ""}${collection.relativeUrl ?? ""}${request.relativeUrl ?? ""}`;

  return (
    <Box flexGrow={1}>
      {/* Left pane: request details */}
      <Box flexDirection="column" width="50%" padding={1} borderStyle="single" borderRight borderTop={false} borderBottom={false} borderLeft={false}>
        <Text bold>{request.name}</Text>
        <Box marginTop={1}>
          <Text color={executionContext?.method ? "yellow" : "magenta"}>{method}</Text>
          <Text>{"  "}{effectiveUrl}</Text>
        </Box>

        {request.headers && Object.keys(request.headers).length > 0 ? (
          <Box flexDirection="column" marginTop={1}>
            <Text underline>Headers</Text>
            {Object.entries(request.headers).map(([k, v]) => (
              <Text key={k} dimColor>{k}: {v}</Text>
            ))}
          </Box>
        ) : null}

        {overrideHeaders ? (
          <Box flexDirection="column" marginTop={1}>
            <Text underline color="yellow">Execution Headers</Text>
            {Object.entries(overrideHeaders).map(([k, v]) => (
              <Text key={k} color="yellow">{k}: {v}</Text>
            ))}
          </Box>
        ) : null}

        {body != null ? (
          <Box flexDirection="column" marginTop={1}>
            <Text underline color={executionContext?.body !== undefined ? "yellow" : undefined}>Body</Text>
            <Text dimColor>{JSON.stringify(body, null, 2)}</Text>
          </Box>
        ) : null}

        {jqFilter ? (
          <Box marginTop={1}>
            <Text dimColor>jq: </Text>
            <Text color="yellow">{jqFilter}</Text>
          </Box>
        ) : null}

        {executionContext !== null ? (
          <Box marginTop={1}>
            <Text color="yellow" dimColor>* execution context active</Text>
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
