// Import every template module here for its registerTemplate() side effect.
// Anything that needs to resolve a template by id (API routes, app/auction/
// page.tsx) must import this file first.

import "./jcc";
import "./blank";

export { jccTemplate } from "./jcc";
export { blankTemplate } from "./blank";
