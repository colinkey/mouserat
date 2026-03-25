import React from "react";
import { Box, Text } from "ink";
import type { Collection, Request } from "../types/index.ts";

interface Props {
  collection: Collection;
  requests: Request[];
  selectedIndex: number;
}

export function CollectionScreen({ collection, requests, selectedIndex }: Props) {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>{collection.name}</Text>
      {collection.rootUrl ? <Text dimColor>{collection.rootUrl}</Text> : null}
      <Box marginTop={1} flexDirection="column">
        {requests.length === 0 ? (
          <Text dimColor>No requests. Press n to create one.</Text>
        ) : (
          requests.map((req, i) => {
            const isSelected = i === selectedIndex;
            return (
              <Box key={req.id}>
                <Text color={isSelected ? "cyan" : undefined}>
                  {isSelected ? "> " : "  "}
                  <Text color="magenta">{req.method.padEnd(7)}</Text>
                  {"  "}
                  {req.name}
                  <Text dimColor>  {req.relativeUrl}</Text>
                </Text>
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
}
