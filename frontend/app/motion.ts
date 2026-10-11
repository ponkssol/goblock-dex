export function m(type: string, delay = 0) {
  return { "data-m": type, style: { ["--d" as string]: `${delay}ms` } };
}
