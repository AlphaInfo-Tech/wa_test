import OpenAI from "openai";
import { executeToolCall } from "./tool-handlers";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are a WhatsApp support assistant for [Business Name].
Only answer using information from the knowledge base (file_search) or by calling
the tools provided. If you don't find a clear answer, say you're not sure and
offer to connect the user with a team member — do not make up information.

Keep replies short and conversational (2-4 sentences), suitable for WhatsApp.

If you are not confident the knowledge base fully answers the question, start
your reply with the exact marker [LOW_CONFIDENCE] followed by your best attempt
at an answer or a hand-off message. Only use this marker when genuinely unsure.`;

const MODEL_DEFAULT = "gpt-5-mini";
const MODEL_ESCALATED = "gpt-5";
const MAX_TOOL_HOPS = 4; // safety cap to avoid infinite tool-call loops

/**
 * conversationHistory: array of { role: "user" | "assistant", content: string }
 *   pulled from Firestore, most recent last, already trimmed to a reasonable window.
 */
export async function generateReply({
  userMessage,
  conversationHistory = [],
  vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID,
  useEscalatedModel = false,
}) {
  const model = useEscalatedModel ? MODEL_ESCALATED : MODEL_DEFAULT;

  const tools = [
    { type: "file_search", vector_store_ids: [vectorStoreId] },
    {
      type: "function",
      name: "lookup_order_status",
      description: "Look up the current status of a customer order by order ID.",
      parameters: {
        type: "object",
        properties: { order_id: { type: "string" } },
        required: ["order_id"],
      },
    },
    {
      type: "function",
      name: "check_appointment_slots",
      description: "Check available appointment slots for a given date.",
      parameters: {
        type: "object",
        properties: { date: { type: "string", description: "YYYY-MM-DD" } },
        required: ["date"],
      },
    },
    // add more tools here as your business logic grows
  ];

  const input = [
    { role: "system", content: SYSTEM_PROMPT },
    ...conversationHistory,
    { role: "user", content: userMessage },
  ];

  let response = await openai.responses.create({ model, input, tools });

  const toolCallsLog = [];
  let hops = 0;

  // Tool-call loop: keep resolving function calls until the model
  // returns plain text, or we hit the safety cap.
  while (hasFunctionCall(response) && hops < MAX_TOOL_HOPS) {
    hops += 1;
    const calls = getFunctionCalls(response);

    const toolOutputs = [];
    for (const call of calls) {
      let args = {};
      try {
        args = JSON.parse(call.arguments || "{}");
      } catch {
        args = {};
      }

      const result = await executeToolCall(call.name, args);

      toolCallsLog.push({ name: call.name, arguments: args, output: result });

      toolOutputs.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: JSON.stringify(result),
      });
    }

    response = await openai.responses.create({
      model,
      previous_response_id: response.id,
      input: toolOutputs,
      tools,
    });
  }

  const rawText = extractText(response);
  const citations = extractCitations(response);

  const confidenceFlag = rawText.startsWith("[LOW_CONFIDENCE]") ? "low" : "high";
  const cleanText = rawText.replace("[LOW_CONFIDENCE]", "").trim();

  return {
    text: cleanText,
    confidenceFlag,
    citations,
    toolCalls: toolCallsLog,
    modelUsed: model,
    responseId: response.id,
  };
}

// ---- helpers for parsing the Responses API output shape ----

function hasFunctionCall(response) {
  return (response.output || []).some((o) => o.type === "function_call");
}

function getFunctionCalls(response) {
  return (response.output || []).filter((o) => o.type === "function_call");
}

function extractText(response) {
  // output_text is a convenience field on the Responses API;
  // fall back to manual extraction if not present.
  if (response.output_text) return response.output_text;

  const textBlock = (response.output || [])
    .flatMap((o) => o.content || [])
    .find((c) => c.type === "output_text");

  return textBlock?.text || "";
}

function extractCitations(response) {
  const annotations = (response.output || [])
    .flatMap((o) => o.content || [])
    .flatMap((c) => c.annotations || [])
    .filter((a) => a.type === "file_citation");

  return annotations.map((a) => ({
    file_name: a.filename || a.file_id,
    snippet: a.quote || null,
  }));
}
