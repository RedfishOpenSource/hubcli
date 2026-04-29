export function coerceNumberOptions(options, keys) {
  for (const key of keys) {
    if (options[key] != null) {
      options[key] = Number(options[key]);
    }
  }

  return options;
}
