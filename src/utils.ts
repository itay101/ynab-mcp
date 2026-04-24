type ContentBlock = { type: "text"; text: string };
type ToolResult = { content: ContentBlock[] };
type ErrorResult = { content: ContentBlock[]; isError: true };

export function toToolResult(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

export function toErrorResult(error: unknown): ErrorResult {
  let message: string;
  if (typeof error === "object" && error !== null && "error" in error) {
    const e = error as { error: { detail?: string; name?: string } };
    message = `YNAB API error: ${e.error?.detail ?? e.error?.name ?? "Unknown error"}`;
  } else if (error instanceof Error) {
    message = error.message;
  } else {
    message = String(error);
  }
  return { content: [{ type: "text", text: message }], isError: true };
}

export async function wrapHandler<T>(handler: () => Promise<T>): Promise<ToolResult | ErrorResult> {
  try {
    return toToolResult(await handler());
  } catch (error) {
    return toErrorResult(error);
  }
}
