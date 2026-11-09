import { describe, expect, it } from "vitest";

import { createSseParser, type SseFrame } from "./sseParse";

const collect = () => {
  const frames: SseFrame[] = [];
  const parser = createSseParser((frame) => frames.push(frame));
  return { frames, parser };
};

describe("createSseParser", () => {
  it("parses a single complete frame", () => {
    const { frames, parser } = collect();
    parser.push('event: snapshot\ndata: {"entries":[]}\n\n');
    expect(frames).toEqual([{ event: "snapshot", data: '{"entries":[]}' }]);
  });

  it("defaults the event name to `message`", () => {
    const { frames, parser } = collect();
    parser.push("data: hello\n\n");
    expect(frames).toEqual([{ event: "message", data: "hello" }]);
  });

  it("ignores comments and field-less blocks", () => {
    const { frames, parser } = collect();
    parser.push(": keep-alive\n\nevent: ping\n\ndata: {}\n\n");
    expect(frames).toEqual([{ event: "ping", data: "{}" }]);
  });

  it("parses several frames from one chunk", () => {
    const { frames, parser } = collect();
    parser.push('event: events\ndata: []\n\nevent: ping\ndata: {"t":1}\n\n');
    expect(frames.map((frame) => frame.event)).toEqual(["events", "ping"]);
  });

  it("keeps a frame split across chunks", () => {
    const { frames, parser } = collect();
    parser.push("event: snap");
    parser.push("shot\nda");
    parser.push('ta: {"entries":[]}\n');
    expect(frames).toEqual([]);
    parser.push("\n");
    expect(frames).toEqual([{ event: "snapshot", data: '{"entries":[]}' }]);
  });

  it("joins multiple data lines with a newline", () => {
    const { frames, parser } = collect();
    parser.push('event: events\ndata: [{"a":1},\ndata: {"b":2}]\n\n');
    expect(frames[0].data).toBe('[{"a":1},\n{"b":2}]');
  });

  it("handles CRLF line endings split across chunks", () => {
    const { frames, parser } = collect();
    parser.push("event: ping\r");
    parser.push("\ndata: {}\r");
    parser.push("\n\r\n");
    expect(frames).toEqual([{ event: "ping", data: "{}" }]);
  });

  it("preserves the id field", () => {
    const { frames, parser } = collect();
    parser.push("id: 42\nevent: events\ndata: []\n\n");
    expect(frames).toEqual([{ event: "events", data: "[]", id: "42" }]);
  });

  it("flushes a final frame that lacks a trailing blank line", () => {
    const { frames, parser } = collect();
    parser.push('event: end\ndata: {"kind":"ended"}');
    expect(frames).toEqual([]);
    parser.flush();
    expect(frames).toEqual([{ event: "end", data: '{"kind":"ended"}' }]);
  });

  it("does not dispatch empty blocks on flush", () => {
    const { frames, parser } = collect();
    parser.push("");
    parser.flush();
    expect(frames).toEqual([]);
  });

  it("supports data values containing colons", () => {
    const { frames, parser } = collect();
    parser.push("data: https://example.com/a:b\n\n");
    expect(frames).toEqual([
      { event: "message", data: "https://example.com/a:b" },
    ]);
  });
});
