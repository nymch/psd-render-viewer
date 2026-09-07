import {defineConfig} from "vitest/config";

// 拡張子が.mtsなのは、.tsだとCommonJSとして読まれてESM構文が警告になるため
export default defineConfig({
  // tsconfig.jsonのpaths（@/*）をViteが解決する。以前は vite-tsconfig-paths が要ったが本体に入った
  resolve: {tsconfigPaths: true},
  test: {
    // lib/の純関数だけを見る。Reactコンポーネントの単体テストは書かないのでjsdomは要らない
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    include: ["**/*.test.ts"],
    // Playwrightの*.spec.tsをVitestが拾わないようにする
    exclude: ["node_modules/**", ".next/**", "e2e/**"],
  },
});
