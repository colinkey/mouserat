import React from "react";
import { Box, Text } from "ink";
import type { Collection } from "../types/index.ts";

interface Props {
  collections: Collection[];
  selectedIndex: number;
}

export function CollectionsScreen({ collections, selectedIndex }: Props) {
  if (collections.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text dimColor>No collections. Press n to create one.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Collections</Text>
      <Box marginTop={1} flexDirection="column">
        {collections.map((col, i) => (
          <Box key={col.id}>
            <Text color={i === selectedIndex ? "cyan" : undefined}>
              {i === selectedIndex ? "> " : "  "}
              {col.name}
              {col.rootUrl ? <Text dimColor>  {col.rootUrl}</Text> : null}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
