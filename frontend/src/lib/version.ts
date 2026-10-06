import { version } from "../../package.json"

// Single source of truth: package.json's own version field, not a second
// hardcoded constant that could drift from it on a release bump.
export const APP_VERSION: string = version
