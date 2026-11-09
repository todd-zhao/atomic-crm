/**
 * Orchestrates one assistant panel session: load the BYOK settings, get (or
 * create) the user's default thread, subscribe to the SSE stream, send
 * messages / stop runs / resolve approvals.
 *
 * All state transitions on the conversation itself go through the pure
 * `assistantReducer`, so the hook only deals with fetching and reconnection.
 */
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useNotify, useTranslate } from "ra-core";

import {
  assistantApi,
  describeAssistantError,
  streamAssistantEvents,
  type AssistantErrorCode,
} from "./assistantApi";
import { assistantReducer, initialAssistantState } from "./eventReducer";
import type {
  AssistantContext,
  AssistantSettings,
  AssistantThread,
} from "./types";

export type AssistantLoadError = {
  code: AssistantErrorCode;
  message: string;
};

export type AssistantSession = {
  state: ReturnType<typeof assistantReducer>;
  settings: AssistantSettings | null;
  settingsError: AssistantLoadError | null;
  loading: boolean;
  threadId: string | null;
  threadError: AssistantLoadError | null;
  connectionError: AssistantLoadError | null;
  sending: boolean;
  creating: boolean;
  threads: AssistantThread[];
  resolvingHash: string | null;
  send: (input: string) => Promise<boolean>;
  stop: () => Promise<void>;
  newConversation: () => Promise<void>;
  openThread: (threadId: string) => void;
  reload: () => void;
  resolveApproval: (hash: string, approve: boolean) => Promise<void>;
};

const errorMessageKey = (code: AssistantErrorCode): string => {
  switch (code) {
    case "not_configured":
      return "crm.assistant.errors.not_configured";
    case "unauthorized":
      return "crm.assistant.errors.unauthorized";
    case "unreachable":
      return "crm.assistant.errors.unreachable";
    case "rate_limited":
      return "crm.assistant.errors.rate_limited";
    case "busy":
      return "crm.assistant.errors.busy";
    default:
      return "crm.assistant.errors.generic";
  }
};

const RECONNECT_BASE_DELAY_MS = 500;
const RECONNECT_MAX_DELAY_MS = 15000;

export const useAssistantSession = ({
  enabled,
  context,
}: {
  enabled: boolean;
  context: AssistantContext;
}): AssistantSession => {
  const translate = useTranslate();
  const notify = useNotify();
  const [state, dispatch] = useReducer(assistantReducer, initialAssistantState);
  const [settings, setSettings] = useState<AssistantSettings | null>(null);
  const [settingsError, setSettingsError] = useState<AssistantLoadError | null>(
    null,
  );
  const [threadId, setThreadId] = useState<string | null>(null);
  const [threadError, setThreadError] = useState<AssistantLoadError | null>(
    null,
  );
  const [connectionError, setConnectionError] =
    useState<AssistantLoadError | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [threads, setThreads] = useState<AssistantThread[]>([]);
  const [resolvingHash, setResolvingHash] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // The page context is sent with outgoing messages only, so it must not
  // reconnect the stream or reload the thread when the user navigates.
  const contextRef = useRef(context);
  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  const notifyError = useCallback(
    (error: unknown) => {
      const { code } = describeAssistantError(error);
      if (code === "not_configured") {
        setSettings((current) =>
          current ? { ...current, configured: false } : { configured: false },
        );
      }
      notify(translate(errorMessageKey(code)), { type: "error" });
    },
    [notify, translate],
  );

  const reload = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  // Refresh the conversation list (best effort; used by the history menu).
  const refreshThreads = useCallback(async () => {
    try {
      const list = await assistantApi.listThreads();
      setThreads(list.threads ?? []);
    } catch {
      // The list is a convenience: never break the chat because of it.
    }
  }, []);

  // Load settings + the conversation list, then open the most recent
  // conversation (or create the first one).
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let cancelled = false;

    dispatch({ type: "reset" });
    setLoading(true);
    setThreadId(null);
    setThreadError(null);
    setSettingsError(null);
    setConnectionError(null);

    const load = async () => {
      try {
        const result = await assistantApi.getSettings(controller.signal);
        if (!cancelled) setSettings(result);
      } catch (error) {
        if (!cancelled && !controller.signal.aborted) {
          setSettingsError(describeAssistantError(error));
        }
      }

      try {
        const list = await assistantApi.listThreads(controller.signal);
        if (!cancelled) setThreads(list.threads ?? []);

        const { thread } = await assistantApi.getDefaultThread(
          controller.signal,
        );
        if (cancelled) return;
        setThreadId(thread.id);
      } catch (error) {
        if (cancelled || controller.signal.aborted) return;
        setThreadError(describeAssistantError(error));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enabled, reloadKey]);

  // Load run state + pending approvals for the active conversation.
  useEffect(() => {
    if (!enabled || !threadId) return;
    const controller = new AbortController();
    let cancelled = false;

    dispatch({ type: "reset" });

    const load = async () => {
      try {
        const detail = await assistantApi.getThread(
          threadId,
          controller.signal,
        );
        if (cancelled) return;
        dispatch({ type: "busy", busy: Boolean(detail.busy) });
        if (detail.usage) dispatch({ type: "usage", usage: detail.usage });
        if (detail.configured === false) {
          setSettings((current) =>
            current ? { ...current, configured: false } : { configured: false },
          );
        }

        const approvals = await assistantApi.listApprovals(
          threadId,
          controller.signal,
        );
        if (cancelled) return;
        dispatch({ type: "approvals", pending: approvals.pending ?? [] });
      } catch (error) {
        if (cancelled || controller.signal.aborted) return;
        setThreadError(describeAssistantError(error));
      }
    };

    void load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enabled, threadId, reloadKey]);

  // Subscribe to the event stream while the panel is open. Reconnection uses
  // exponential backoff; every reconnect starts with a full snapshot, so no
  // delta has to be replayed manually.
  useEffect(() => {
    if (!enabled || !threadId) return;
    let cancelled = false;
    let controller: AbortController | null = null;
    let reconnectTimer: number | undefined;
    let attempt = 0;

    const connect = async () => {
      controller = new AbortController();
      const streamController = controller;
      let endedByServer = false;
      try {
        await streamAssistantEvents(
          threadId,
          (frame) => {
            attempt = 0;
            if (frame.event === "end") endedByServer = true;
            dispatch({ type: "frame", frame });
            setConnectionError((current) => (current ? null : current));
          },
          streamController.signal,
        );
      } catch (error) {
        if (cancelled || streamController.signal.aborted) return;
        const described = describeAssistantError(error);
        setConnectionError(described);
        if (described.code === "unauthorized") {
          // A 401 will not fix itself: stop reconnecting until the user reloads.
          return;
        }
      }
      if (cancelled || endedByServer) return;
      attempt = Math.min(attempt + 1, 6);
      const delay =
        Math.min(
          RECONNECT_BASE_DELAY_MS * 2 ** (attempt - 1),
          RECONNECT_MAX_DELAY_MS,
        ) +
        Math.random() * 500;
      reconnectTimer = window.setTimeout(() => {
        void connect();
      }, delay);
    };

    void connect();

    return () => {
      cancelled = true;
      controller?.abort();
      if (reconnectTimer !== undefined) {
        window.clearTimeout(reconnectTimer);
      }
    };
  }, [enabled, threadId, reloadKey]);

  const newConversation = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    dispatch({ type: "reset" });
    setThreadError(null);
    try {
      const { thread } = await assistantApi.createThread();
      setThreads((current) => [
        thread,
        ...current.filter((item) => item.id !== thread.id),
      ]);
      setThreadId(thread.id);
    } catch (error) {
      notifyError(error);
    } finally {
      setCreating(false);
    }
  }, [creating, notifyError]);

  const openThread = useCallback(
    (id: string) => {
      if (!id || id === threadId) return;
      setThreadId(id);
    },
    [threadId],
  );

  const send = useCallback(
    async (input: string) => {
      const trimmed = input.trim();
      if (!threadId || !trimmed || sending) return false;
      setSending(true);
      dispatch({ type: "error", error: undefined });
      try {
        await assistantApi.sendMessage(threadId, trimmed, contextRef.current);
        dispatch({ type: "busy", busy: true });
        // The server names the conversation after its first message.
        void refreshThreads();
        return true;
      } catch (error) {
        notifyError(error);
        return false;
      } finally {
        setSending(false);
      }
    },
    [threadId, sending, notifyError, refreshThreads],
  );

  const stop = useCallback(async () => {
    if (!threadId) return;
    try {
      await assistantApi.abort(threadId);
      dispatch({ type: "busy", busy: false });
    } catch (error) {
      notifyError(error);
    }
  }, [threadId, notifyError]);

  const resolveApproval = useCallback(
    async (hash: string, approve: boolean) => {
      if (!threadId || resolvingHash) return;
      setResolvingHash(hash);
      dispatch({ type: "approval_resolved", hash, approved: approve });
      try {
        await assistantApi.resolveApproval(threadId, hash, approve);
        notify(
          translate(
            approve
              ? "crm.assistant.approval.approved"
              : "crm.assistant.approval.rejected",
          ),
        );
      } catch (error) {
        notifyError(error);
        try {
          const approvals = await assistantApi.listApprovals(threadId);
          dispatch({ type: "approvals", pending: approvals.pending ?? [] });
        } catch {
          // Keep the optimistic state: the next snapshot will reconcile it.
        }
      } finally {
        setResolvingHash(null);
      }
    },
    [threadId, resolvingHash, notify, notifyError, translate],
  );

  return {
    state,
    settings,
    settingsError,
    loading,
    threadId,
    threadError,
    connectionError,
    sending,
    creating,
    threads,
    resolvingHash,
    send,
    stop,
    newConversation,
    openThread,
    resolveApproval,
    reload,
  };
};
