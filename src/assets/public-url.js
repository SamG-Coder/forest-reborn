/** Resolve public assets under the same base path as the built application. */
export function publicUrl(path,base=import.meta.env?.BASE_URL??'/'){
  if(/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(path))return path;
  const root=base.endsWith('/')?base:base+'/';
  if(path.startsWith(root))return path;
  return root+path.replace(/^\/+/, '');
}
