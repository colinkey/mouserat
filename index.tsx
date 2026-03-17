import React from "react";
import { render } from "ink";
import { App } from "./src/App.tsx";

// Enter alternate screen buffer
process.stdout.write("\x1b[?1049h");

const { waitUntilExit } = render(<App />);

waitUntilExit().finally(() => {
  // Exit alternate screen buffer
  process.stdout.write("\x1b[?1049l");
});
