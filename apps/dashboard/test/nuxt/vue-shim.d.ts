// Minimal SFC shim for the plain `tsc` pass over test/**: `vue-tsc` understands .vue imports,
// but `tsc --project tsconfig.e2e.json` does not.
declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent<object, object, unknown>;
  export default component;
}
