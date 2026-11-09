// Minimal OpenAI-compatible server used by the assistant e2e test.
// It scripts just enough behavior to exercise: a read tool call, a write tool
// call that needs approval, and the answer after the tool result.
//
// Run: node test/mock-openai.mjs [port]
import http from "node:http";

const PORT = Number(process.argv[2] ?? 8899);
const MODEL = "mock-model";

function tomorrowIso() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function textOf(message) {
  if (!message) return "";
  const content = message.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : (part?.text ?? "")))
      .join("\n");
  }
  return "";
}

function decide(messages) {
  const last = messages[messages.length - 1];
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const lastUserText = textOf(lastUser);

  // After a tool result: answer in text (or explain the pending approval).
  if (last?.role === "tool") {
    const toolText = textOf(last);
    if (/NOT EXECUTED/i.test(toolText)) {
      return {
        type: "text",
        text: "这个操作需要你先在审批卡片里点「批准」，我才会真正执行。批准后我会立即创建。",
      };
    }
    return { type: "text", text: `已经完成 ✅\n\n${toolText.slice(0, 400)}` };
  }

  const approved = /The user approved/i.test(lastUserText);
  if (
    /建.*任务|创建.*任务|加.*任务|create.*task/i.test(lastUserText) ||
    approved
  ) {
    const second = /再|第二次|Grace/i.test(lastUserText);
    // Reuse the text from an approval retry so the tool arguments (and thus the
    // approval hash) stay identical; otherwise generate a unique one.
    const approvedText =
      lastUserText.match(/跟进 张伟（AI 助手创建 \d+）/)?.[0];
    // Epoch-based so every provider process produces a fresh approval hash
    // instead of reusing a grant left over from an earlier test run.
    const adaText =
      approvedText ??
      `跟进 张伟（AI 助手创建 ${Math.floor(Date.now() / 1000)}）`;
    return {
      type: "toolcall",
      name: "crm_create_task",
      args: {
        contactId: second ? 2 : 1,
        text: second ? "二次跟进 李娜（AI 助手创建）" : adaText,
        type: "follow-up",
        dueDate: tomorrowIso(),
      },
    };
  }

  return {
    type: "toolcall",
    name: "crm_search_contacts",
    args: { query: "张伟", limit: 5 },
  };
}

function sseChunk(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function baseChunk(model, delta, finishReason = null) {
  return {
    id: `chatcmpl-mock-${Date.now()}`,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  };
}

function streamAnswer(res, decision, model) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  sseChunk(res, baseChunk(model, { role: "assistant", content: "" }));

  if (decision.type === "toolcall") {
    sseChunk(res, {
      ...baseChunk(model, {
        tool_calls: [
          {
            index: 0,
            id: `call_mock_${Date.now()}`,
            type: "function",
            function: { name: decision.name, arguments: "" },
          },
        ],
      }),
    });
    sseChunk(res, {
      ...baseChunk(model, {
        tool_calls: [
          {
            index: 0,
            function: { arguments: JSON.stringify(decision.args) },
          },
        ],
      }),
    });
    sseChunk(res, baseChunk(model, {}, "tool_calls"));
  } else {
    const words = decision.text.match(/.{1,12}/gsu) ?? [decision.text];
    for (const word of words) {
      sseChunk(res, baseChunk(model, { content: word }));
    }
    sseChunk(res, baseChunk(model, {}, "stop"));
  }
  sseChunk(res, {
    id: "chatcmpl-mock",
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [],
    usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
  });
  res.write("data: [DONE]\n\n");
  res.end();
}

function completeAnswer(res, decision, model) {
  const message =
    decision.type === "toolcall"
      ? {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: `call_mock_${Date.now()}`,
              type: "function",
              function: {
                name: decision.name,
                arguments: JSON.stringify(decision.args),
              },
            },
          ],
        }
      : { role: "assistant", content: decision.text };
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      id: "chatcmpl-mock",
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message,
          finish_reason: decision.type === "toolcall" ? "tool_calls" : "stop",
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
    }),
  );
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (req.method === "GET" && url.pathname === "/v1/models") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        object: "list",
        data: [{ id: MODEL, object: "model", owned_by: "mock" }],
      }),
    );
    return;
  }
  if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { message: "invalid JSON" } }));
        return;
      }
      const decision = decide(parsed.messages ?? []);
      const model = parsed.model ?? MODEL;
      if (parsed.stream) streamAnswer(res, decision, model);
      else completeAnswer(res, decision, model);
    });
    return;
  }
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: { message: "not found" } }));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(
    `[mock-openai] listening on http://127.0.0.1:${PORT}/v1 (model ${MODEL})`,
  );
});
