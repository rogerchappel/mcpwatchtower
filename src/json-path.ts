export function propertyPath(parent: string, key: string): string {
  const property = /^[A-Za-z_$][\w$]*$/.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`;
  return `${parent}${property}`;
}
