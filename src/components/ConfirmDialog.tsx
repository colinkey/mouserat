import React from "react";
import { Box, Text } from "ink";

interface Props {
  message: string;
}

export function ConfirmDialog({ message }: Props) {
  return (
    <Box borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} paddingX={1} gap={2}>
      <Text color="red">{message}</Text>
      <Text><Text color="green" bold>y</Text> yes  <Text color="yellow" bold>n</Text> no</Text>
    </Box>
  );
}
