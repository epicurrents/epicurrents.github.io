/// <reference types="vite/client" />

interface ImportMetaEnv {
    // Add env variables here if needed
  }
  
  interface ImportMeta {
    readonly env: ImportMetaEnv
    readonly glob: (glob: string) => Record<string, () => Promise<unknown>>
  }