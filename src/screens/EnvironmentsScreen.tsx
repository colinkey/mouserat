import React from "react";
import { Box, Text } from "ink";
import type { Environment } from "../types/index.ts";

interface Props {
  environments: Environment[];
  selectedIndex: number;
  activeEnvironmentId: string | null;
}

export function EnvironmentsScreen({ environments, selectedIndex, activeEnvironmentId }: Props) {
  if (environments.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text dimColor>No environments. Press n to create one.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Environments</Text>
      <Box marginTop={1} flexDirection="column">
        {environments.map((env, i) => {
          const isSelected = i === selectedIndex;
          const isActive = env.id === activeEnvironmentId;
          return (
            <Box key={env.id}>
              <Text color={isSelected ? "cyan" : undefined}>
                {isSelected ? "> " : "  "}
                {env.name}
                {isActive ? <Text color="green">  ✓ active</Text> : null}
                {env.rootUrl ? <Text dimColor>  {env.rootUrl}</Text> : null}
              </Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
