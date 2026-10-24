// Ручные декларации для импортов Vite, которые TypeScript сам не резолвит.
// «?raw» возвращает содержимое файла как строку.

declare module '*.md?raw' {
  const src: string;
  export default src;
}
