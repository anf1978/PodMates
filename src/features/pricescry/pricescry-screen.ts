// The lazy chunk's single entry: index.ts imports only this file, with import(), so the gate, screen and views
// load together on first open as the `pricescry-screen` chunk.
export { requestAccess } from "./access";
export { setTab } from "./screen";
