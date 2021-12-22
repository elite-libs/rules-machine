import type { Config } from "@jest/types";

// Sync object
const config: Config.InitialOptions = {
  rootDir: ".",
  preset: "ts-jest",
  verbose: true,
  // testPathIgnorePatterns: ["node_modules", "dist"],
  testPathIgnorePatterns: ["dist"],
  resetMocks: true,
  resetModules: true,
  globals: {
    "ts-jest": {
      useESM: true,
    },
  },
  testEnvironment: "jsdom",
  // testEnvironment: "node",
  transform: {
    // "\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$":
    //   "<rootDir>/src/jestFileTransformer.js",
  },
};

export default config;
