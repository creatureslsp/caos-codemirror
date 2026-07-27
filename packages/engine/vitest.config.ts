import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        include: ["src/**/*.test.ts"],
    },
    optimizeDeps: {
        exclude: [
            '@creatureslsp/caos',
            '@creatureslsp/caos-kt',
            '@creatureslsp/catalogue',
            '@creatureslsp/extension-util'
        ],
    },
});
