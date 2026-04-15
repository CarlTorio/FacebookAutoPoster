// Temporary diagnostic. Gated behind DEBUG_CREDENTIALS=1. Logs head/tail and
// whitespace presence of a credential string — never the full value.
// Remove once the token-corruption bug is fixed.

export function traceCred(stage: string, value: unknown): void {
  if (process.env.DEBUG_CREDENTIALS !== "1") return;
  if (typeof value !== "string") {
    console.log(`[fb-trace:${stage}] non-string (${typeof value})`);
    return;
  }
  const head = value.slice(0, 8);
  const tail = value.slice(-8);
  const whitespace = /\s/.test(value);
  const trailingNewline = value.endsWith("\n") || value.endsWith("\r");
  console.log(
    `[fb-trace:${stage}] len=${value.length} head=${head}... tail=...${tail} whitespace=${whitespace} trailingNL=${trailingNewline}`,
  );
}
