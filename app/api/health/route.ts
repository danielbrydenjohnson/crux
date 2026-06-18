import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL;

  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "ANTHROPIC_API_KEY is not configured.",
      },
      { status: 500 },
    );
  }

  if (!model) {
    return NextResponse.json(
      {
        ok: false,
        error: "ANTHROPIC_MODEL is not configured.",
      },
      { status: 500 },
    );
  }

  try {
    const anthropic = new Anthropic({
      apiKey,
    });

    const message = await anthropic.messages.create({
      model,
      max_tokens: 20,
      messages: [
        {
          role: "user",
          content: "Reply with exactly: Crux connected",
        },
      ],
    });

    const textBlock = message.content.find(
      (block) => block.type === "text",
    );

    return NextResponse.json({
      ok: true,
      service: "anthropic",
      model,
      response: textBlock?.text ?? "",
    });
  } catch (error) {
    console.error("Claude health check failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Claude health check failed.",
      },
      { status: 500 },
    );
  }
}