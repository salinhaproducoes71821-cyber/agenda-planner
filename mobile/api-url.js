export function normalizeHttpsBase(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('Configure uma URL HTTPS sem credenciais, parâmetros ou fragmentos.');
  }
  return url.href.replace(/\/+$/, '');
}
