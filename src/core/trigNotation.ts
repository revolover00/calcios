/** Normalize common written names for inverse trigonometric functions. */
export function normalizeInverseTrigNotation(source: string): string {
  return source
    .replace(/(^|[^A-Za-z_])arc(sin|cos|tan)(?=\s*\()/g, '$1a$2')
    .replace(
      /(^|[^A-Za-z_])(sin|cos|tan)(?:⁻¹|⁻1|[−‐‑‒–-]¹|\^\s*(?:\(\s*-1\s*\)|\{\s*-1\s*\}|-1))(?=\s*\()/g,
      '$1a$2',
    );
}
