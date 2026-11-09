/**
 * A small, dependency-free Server-Sent Events parser.
 *
 * `EventSource` cannot send an `Authorization` header, so the assistant client
 * reads the body of a plain `fetch` response instead and feeds the decoded
 * chunks to this parser. The parser is pure (no DOM, no timers) so it can be
 * unit tested in isolation.
 */

export type SseFrame = {
  /** The `event:` field, or `"message"` when the server did not set one. */
  event: string;
  /** The `data:` lines, joined with `\n` as mandated by the SSE spec. */
  data: string;
  /** The optional `id:` field. */
  id?: string;
};

export type SseParser = {
  /** Feed a decoded chunk of the response body. */
  push: (chunk: string) => void;
  /** Flush the internal buffer and dispatch any pending frame. */
  flush: () => void;
};

/**
 * Creates a streaming SSE parser. Frames are dispatched as soon as the blank
 * line that terminates them arrives, even when a chunk boundary splits a frame
 * (or a `\r\n` pair) in the middle.
 */
export const createSseParser = (
  onFrame: (frame: SseFrame) => void,
): SseParser => {
  let buffer = "";
  let eventName = "";
  let dataLines: string[] = [];
  let id: string | undefined;

  const dispatch = () => {
    // Per the SSE spec, a block without any `data:` line does not dispatch an
    // event — and the event type / id buffers are then left untouched.
    if (dataLines.length === 0) {
      return;
    }
    const frame: SseFrame = {
      event: eventName || "message",
      data: dataLines.join("\n"),
    };
    if (id !== undefined) {
      frame.id = id;
    }
    eventName = "";
    dataLines = [];
    id = undefined;
    onFrame(frame);
  };

  const processLine = (rawLine: string) => {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    if (line === "") {
      dispatch();
      return;
    }
    if (line.startsWith(":")) {
      // Comment / keep-alive.
      return;
    }
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) {
      value = value.slice(1);
    }
    switch (field) {
      case "event":
        eventName = value;
        break;
      case "data":
        dataLines.push(value);
        break;
      case "id":
        id = value;
        break;
      default:
        // `retry:` and unknown fields are ignored.
        break;
    }
  };

  const drain = (flushAll: boolean) => {
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      processLine(line);
      newline = buffer.indexOf("\n");
    }
    if (flushAll && buffer.length > 0) {
      const line = buffer;
      buffer = "";
      processLine(line);
    }
  };

  return {
    push(chunk) {
      buffer += chunk;
      drain(false);
    },
    flush() {
      drain(true);
      dispatch();
    },
  };
};
