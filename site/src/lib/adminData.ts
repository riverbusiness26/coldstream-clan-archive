type Result<T> = { data: T[] | null; error: { message: string } | null };

// A failed later page must not turn a partial queue into a successful empty one.
export async function readAdminRows<T>(page: (from: number, to: number) => PromiseLike<Result<T>>, size = 250): Promise<Result<T>> {
  const rows: T[] = [];
  try {
    for (let from = 0; ; from += size) {
      const result = await page(from, from + size - 1);
      if (result.error) return { data: null, error: result.error };
      if (!Array.isArray(result.data)) return { data: null, error: { message: 'The server returned no records response.' } };
      rows.push(...result.data);
      if (result.data.length < size) return { data: rows, error: null };
    }
  } catch (error) {
    return { data: null, error: { message: error instanceof Error ? error.message : 'The request failed.' } };
  }
}

export async function loadAdminSections(jobs: Array<{ name: string; run: () => PromiseLike<{ error: { message: string } | null }> }>): Promise<Record<string, string>> {
  const errors: Record<string, string> = {};
  await Promise.all(jobs.map(async ({ name, run }) => {
    try {
      const result = await run();
      if (result.error) errors[name] = result.error.message;
    } catch (error) {
      errors[name] = error instanceof Error ? error.message : 'The request failed.';
    }
  }));
  return errors;
}

export function mergeDetachmentDrafts(drafts: Record<string, string>, previous: Array<{ id: string; company_id: string | null }>, next: Array<{ id: string; company_id: string | null }>) {
  const before = new Map(previous.map((member) => [member.id, member.company_id ?? '']));
  return Object.fromEntries(next.map((member) => [member.id,
    Object.hasOwn(drafts, member.id) && drafts[member.id] !== before.get(member.id)
      ? drafts[member.id] : member.company_id ?? '',
  ]));
}

export function parseRoundCount(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const count = Number(value);
  return Number.isSafeInteger(count) && count <= 2147483647 ? count : null;
}
