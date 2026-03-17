import React, { useState, useEffect, useCallback } from "react";
import { Box, useInput, useApp } from "ink";
import { StatusBar } from "./components/StatusBar.tsx";
import { ConfirmDialog } from "./components/ConfirmDialog.tsx";
import { CollectionsScreen } from "./screens/CollectionsScreen.tsx";
import { CollectionScreen } from "./screens/CollectionScreen.tsx";
import { EnvironmentsScreen } from "./screens/EnvironmentsScreen.tsx";
import { RequestScreen } from "./screens/RequestScreen.tsx";
import { LogsScreen } from "./screens/LogsScreen.tsx";
import { LogScreen } from "./screens/LogScreen.tsx";
import type { Collection, Environment, Execution, Request, RequestLog, Screen } from "./types/index.ts";
import * as storage from "./storage/index.ts";
import { openInEditor, openExecutionInEditor } from "./utils/editor.ts";
import { executeRequest } from "./utils/curl.ts";

export function App() {
  const { exit } = useApp();

  const [screen, setScreen] = useState<Screen>("collections");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [collections, setCollections] = useState<Collection[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);

  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [activeEnvironmentId, setActiveEnvironmentId] = useState<string | null>(null);

  const [logs, setLogs] = useState<RequestLog[]>([]);

  const [response, setResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [executionContext, setExecutionContext] = useState<Omit<Execution, "url"> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const activeEnvironment = environments.find((e) => e.id === activeEnvironmentId) ?? null;
  const activeCollection = collections.find((c) => c.id === activeCollectionId) ?? null;
  const activeRequest = requests.find((r) => r.id === activeRequestId) ?? null;

  const loadCollections = useCallback(async () => {
    setCollections(await storage.listCollections());
  }, []);

  const loadEnvironments = useCallback(async () => {
    setEnvironments(await storage.listEnvironments());
  }, []);

  const loadRequests = useCallback(async (collectionId: string) => {
    setRequests(await storage.listRequests(collectionId));
  }, []);

  const loadLogs = useCallback(async () => {
    setLogs(await storage.listLogs());
  }, []);

  useEffect(() => {
    storage.init().then(() => {
      loadCollections();
      loadEnvironments();
    });
  }, [loadCollections, loadEnvironments]);

  const moveUp = () => setSelectedIndex((i) => Math.max(0, i - 1));
  const moveDown = (max: number) => setSelectedIndex((i) => Math.min(max - 1, i + 1));

  useInput((input, key) => {
    // Confirmation dialog intercepts all input
    if (confirmDelete) {
      if (input === "y") {
        confirmDelete.onConfirm();
        setConfirmDelete(null);
      } else if (input === "n" || key.escape) {
        setConfirmDelete(null);
      }
      return;
    }

    // Global navigation
    if (input === "q" && screen !== "request") {
      exit();
      return;
    }
    if (input === "1") {
      setScreen("collections");
      setSelectedIndex(0);
      return;
    }
    if (input === "2") {
      setScreen("environments");
      setSelectedIndex(0);
      return;
    }
    if (input === "3") {
      loadLogs();
      setScreen("logs");
      setSelectedIndex(0);
      return;
    }

    // Vim + arrow navigation
    if (key.upArrow || input === "k") moveUp();
    if (key.downArrow || input === "j") {
      if (screen === "collections") moveDown(collections.length);
      if (screen === "environments") moveDown(environments.length);
      if (screen === "collection") moveDown(requests.length);
      if (screen === "logs") moveDown(logs.length);
    }

    // Back
    if (key.escape || input === "h") {
      if (screen === "collection") {
        setScreen("collections");
        setSelectedIndex(0);
      } else if (screen === "request") {
        setScreen("collection");
        setResponse(null);
        setExecutionContext(null);
        setSelectedIndex(requests.findIndex((r) => r.id === activeRequestId));
      } else if (screen === "log") {
        setScreen("logs");
      }
      return;
    }

    // Enter
    if (key.return) {
      if (screen === "collections") {
        const col = collections[selectedIndex];
        if (!col) return;
        setActiveCollectionId(col.id);
        loadRequests(col.id);
        setScreen("collection");
        setSelectedIndex(0);
      } else if (screen === "environments") {
        const env = environments[selectedIndex];
        if (!env) return;
        setActiveEnvironmentId(env.id);
      } else if (screen === "collection") {
        const req = requests[selectedIndex];
        if (!req) return;
        setActiveRequestId(req.id);
        setScreen("request");
        setResponse(null);
        setExecutionContext(null);
      } else if (screen === "logs") {
        const log = logs[selectedIndex];
        if (!log) return;
        setScreen("log");
      } else if (screen === "request" && activeRequest && activeCollection) {
        setIsLoading(true);
        executeRequest(activeRequest, activeCollection, activeEnvironment, executionContext)
          .then((result) => {
            setResponse(result.stdout || result.stderr);
          })
          .finally(() => setIsLoading(false));
      }
      return;
    }

    // Edit
    if (input === "e") {
      if (screen === "collection" || screen === "request") {
        if (!activeCollectionId) return;
        storage.getCollectionFilePath(activeCollectionId).then((path) => {
          openInEditor(path);
          if (activeCollectionId) loadRequests(activeCollectionId);
          loadCollections();
        });
      } else if (screen === "collections") {
        const col = collections[selectedIndex];
        if (!col) return;
        storage.getCollectionFilePath(col.id).then((path) => {
          openInEditor(path);
          loadCollections();
        });
      } else if (screen === "environments") {
        const env = environments[selectedIndex];
        if (!env) return;
        storage.getEnvironmentFilePath(env.id).then((path) => {
          openInEditor(path);
          loadEnvironments();
        });
      }
      return;
    }

    // Configure execution context for this run
    if (input === "f" && screen === "request" && activeRequest) {
      openExecutionInEditor(activeRequest, executionContext).then((updated) => {
        if (updated !== null) setExecutionContext(updated);
      });
      return;
    }

    // Clear execution context
    if (input === "x" && screen === "request") {
      setExecutionContext(null);
      return;
    }

    // Reload
    if (input === "r") {
      loadCollections();
      loadEnvironments();
      if (activeCollectionId) loadRequests(activeCollectionId);
      if (screen === "logs") loadLogs();
      return;
    }

    // Delete item
    if (input === "d") {
      if (screen === "collections") {
        const col = collections[selectedIndex];
        if (!col) return;
        setConfirmDelete({
          message: `Delete collection "${col.name}"?`,
          onConfirm: () => {
            storage.deleteCollection(col.id).then(() => {
              loadCollections();
              setSelectedIndex((i) => Math.max(0, i - 1));
            });
          },
        });
      } else if (screen === "collection") {
        const req = requests[selectedIndex];
        if (!req || !activeCollectionId) return;
        setConfirmDelete({
          message: `Delete request "${req.name}"?`,
          onConfirm: () => {
            storage.deleteRequest(activeCollectionId, req.id).then(() => {
              loadRequests(activeCollectionId);
              setSelectedIndex((i) => Math.max(0, i - 1));
            });
          },
        });
      } else if (screen === "environments") {
        const env = environments[selectedIndex];
        if (!env) return;
        setConfirmDelete({
          message: `Delete environment "${env.name}"?`,
          onConfirm: () => {
            storage.deleteEnvironment(env.id).then(() => {
              if (activeEnvironmentId === env.id) setActiveEnvironmentId(null);
              loadEnvironments();
              setSelectedIndex((i) => Math.max(0, i - 1));
            });
          },
        });
      } else if (screen === "request") {
        if (!activeRequest || !activeCollectionId) return;
        setConfirmDelete({
          message: `Delete request "${activeRequest.name}"?`,
          onConfirm: () => {
            storage.deleteRequest(activeCollectionId, activeRequest.id).then(() => {
              loadRequests(activeCollectionId);
              setScreen("collection");
              setSelectedIndex(0);
            });
          },
        });
      }
      return;
    }

    // New item
    if (input === "n") {
      if (screen === "collections") {
        storage.createCollection().then(({ id, filePath }) => {
          openInEditor(filePath);
          loadCollections().then(() => {
            const idx = collections.findIndex((c) => c.id === id);
            if (idx !== -1) setSelectedIndex(idx);
          });
        });
      } else if (screen === "collection" && activeCollectionId) {
        storage.createRequest(activeCollectionId).then(({ filePath }) => {
          openInEditor(filePath);
          loadRequests(activeCollectionId);
        });
      } else if (screen === "environments") {
        storage.createEnvironment().then(({ filePath }) => {
          openInEditor(filePath);
          loadEnvironments();
        });
      }
      return;
    }
  });

  const statusHints = (): string[] => {
    const base = ["q quit", "1 collections", "2 environments", "3 logs"];
    if (screen === "collections") return [...base, "↑↓/jk navigate", "enter open", "n new", "e edit", "d delete"];
    if (screen === "environments") return [...base, "↑↓/jk navigate", "enter activate", "n new", "e edit", "d delete"];
    if (screen === "collection") return [...base, "↑↓/jk navigate", "enter open", "esc back", "n new", "e edit", "d delete"];
    if (screen === "request") return ["enter execute", "f execution context", "x clear context", "e edit collection", "d delete", "esc back", "r reload"];
    if (screen === "logs") return [...base, "↑↓/jk navigate", "enter view", "r reload"];
    if (screen === "log") return ["esc back"];
    return base;
  };

  return (
    <Box flexDirection="column" height="100%">
      <Box flexGrow={1}>
        {screen === "collections" && (
          <CollectionsScreen collections={collections} selectedIndex={selectedIndex} />
        )}
        {screen === "environments" && (
          <EnvironmentsScreen
            environments={environments}
            selectedIndex={selectedIndex}
            activeEnvironmentId={activeEnvironmentId}
          />
        )}
        {screen === "collection" && activeCollection && (
          <CollectionScreen
            collection={activeCollection}
            requests={requests}
            selectedIndex={selectedIndex}
          />
        )}
        {screen === "request" && activeRequest && (
          <RequestScreen
            request={activeRequest}
            response={response}
            isLoading={isLoading}
            executionContext={executionContext}
          />
        )}
        {screen === "logs" && (
          <LogsScreen logs={logs} selectedIndex={selectedIndex} />
        )}
        {screen === "log" && logs[selectedIndex] && (
          <LogScreen log={logs[selectedIndex]} />
        )}
      </Box>
      {confirmDelete ? (
        <ConfirmDialog message={confirmDelete.message} />
      ) : (
        <StatusBar activeEnvironment={activeEnvironment} hints={statusHints()} />
      )}
    </Box>
  );
}
