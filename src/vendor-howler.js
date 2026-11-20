/**
 * ESM shim over the vendored Howler.js UMD build (loaded by a classic script
 * tag in index.html so it is available before any module runs).
 */
const H = globalThis.Howler;
const Howl = globalThis.Howl;
if (!H || !Howl) throw new Error('Howler failed to load from vendor/howler.min.js');
export { H as Howler, Howl };
export default { Howler: H, Howl };
