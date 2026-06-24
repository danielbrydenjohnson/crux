import type { BriefStreamEvent } from "@/lib/stream";

type BriefStreamEventHandler = (
  event: BriefStreamEvent,
) => void;

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function readErrorMessage(
  response: Response,
): Promise<string> {
  try {
    const payload = (await response.json()) as unknown;

    if (
      isRecord(payload) &&
      typeof payload.error === "string"
    ) {
      return payload.error;
    }
  } catch {
    // Fall through to the generic message.
  }

  return `Brief request failed with status ${response.status}.`;
}

function parseEventBlock(
  block: string,
): BriefStreamEvent | null {
  const lines = block.split(/\r?\n/);

  let eventName: string | null = null;
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(":")) {
      continue;
    }

    if (line.startsWith("event:")) {
      eventName = line.slice("event:".length).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(
        line.slice("data:".length).trimStart(),
      );
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  const parsed = JSON.parse(
    dataLines.join("\n"),
  ) as unknown;

  if (
    !isRecord(parsed) ||
    typeof parsed.type !== "string"
  ) {
    throw new Error(
      "The brief stream returned an invalid event.",
    );
  }

  if (eventName && eventName !== parsed.type) {
    throw new Error(
      "The brief stream returned a mismatched event type.",
    );
  }

  return parsed as BriefStreamEvent;
}

export async function readBriefStream(
  response: Response,
  onEvent: BriefStreamEventHandler,
): Promise<void> {
  const contentType =
    response.headers.get("content-type") ?? "";

  if (
    !response.ok ||
    !contentType.includes("text/event-stream")
  ) {
    throw new Error(
      await readErrorMessage(response),
    );
  }

  if (!response.body) {
    throw new Error(
      "The brief stream did not contain a response body.",
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      buffer += decoder.decode();
      break;
    }

    buffer += decoder.decode(value, {
      stream: true,
    });

    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const event = parseEventBlock(block);

      if (event) {
        onEvent(event);
      }
    }
  }

  const finalBlock = buffer.trim();

  if (finalBlock) {
    const event = parseEventBlock(finalBlock);

    if (event) {
      onEvent(event);
    }
  }
}