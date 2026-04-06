import React from "react";
import { Box, Text } from "ink";
import type { Collection, Environment, Execution, Request } from "../types/index.ts";
import { ScrollableText } from "../components/ScrollableText.tsx";

interface Props {
  request: Request;
  collection: Collection;
  environment: Environment | null;
  response: string | null;
  isLoading: boolean;
  isJson: boolean;
  executionContext: Omit<Execution, "url"> | null;
  lastExecutionContext: Omit<Execution, "url"> | null;
  responseJqFilter: string | null;
  scrollOffset: number;
}

export function RequestScreen({ request, collection, environment, response, isLoading, isJson, executionContext, lastExecutionContext, responseJqFilter, scrollOffset }: Props) {
  const method = executionContext?.method ?? request.method;
  const body = executionContext?.body !== undefined ? executionContext.body : request.body;
  const jqFilter = executionContext?.jqFilter !== undefined ? executionContext.jqFilter : request.jqFilter;
  const overrideHeaders = executionContext?.headers && Object.keys(executionContext.headers).length > 0
    ? executionContext.headers
    : null;

  const effectiveUrl = request.rootUrl
    ? `${request.rootUrl}${request.relativeUrl ?? ""}`
    : `${collection.rootUrl ?? environment?.rootUrl ?? ""}${collection.relativeUrl ?? ""}${request.relativeUrl ?? ""}`;

  const activeVariables = executionContext?.variables && Object.keys(executionContext.variables).length > 0
    ? executionContext.variables
    : null;

  const lastVariables = lastExecutionContext?.variables && Object.keys(lastExecutionContext.variables).length > 0
    ? lastExecutionContext.variables
    : null;

  return (
    <Box flexGrow={1} flexDirection="column">
      {/* Top pane: request details */}
      <Box flexDirection="column" padding={1} borderStyle="single" borderBottom borderTop={false} borderLeft={false} borderRight={false}>
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

        {activeVariables ? (
          <Box flexDirection="column" marginTop={1}>
            <Text underline color="yellow">Variables</Text>
            {Object.entries(activeVariables).map(([k, v]) => (
              <Text key={k} color="yellow">{k}: {v}</Text>
            ))}
          </Box>
        ) : null}

        {executionContext !== null ? (
          <Box marginTop={1}>
            <Text color="yellow" dimColor>* execution context active</Text>
          </Box>
        ) : lastExecutionContext !== null ? (
          <Box marginTop={1}>
            <Text dimColor>last: </Text>
            {lastVariables
              ? Object.entries(lastVariables).map(([k, v]) => (
                  <Text key={k} dimColor>{k}={v}  </Text>
                ))
              : null}
            <Text dimColor>(l to apply)</Text>
          </Box>
        ) : null}
      </Box>

      {/* Bottom pane: response */}
      <Box flexDirection="column" flexGrow={1} padding={1}>
        {isLoading ? (
          <Text color="yellow">Running...</Text>
        ) : response != null ? (
          <>
            {isJson && responseJqFilter ? (
              <Box marginBottom={1}>
                <Text dimColor>jq filter: </Text>
                <Text color="cyan">{responseJqFilter}</Text>
                <Text dimColor>  x clear  c copy to request</Text>
              </Box>
            ) : null}
            <ScrollableText text={response} scrollOffset={scrollOffset} />
          </>
        ) : (
          <Text dimColor>Press enter to execute request.</Text>
        )}
      </Box>
    </Box>
  );
}
