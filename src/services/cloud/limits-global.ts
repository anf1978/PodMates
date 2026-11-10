// Publishes the shared size limits for the page's ordinary scripts. Loaded as its own module, ahead
// of the cloud module and without importing Firebase, so local deck analysis keeps its limits even
// if the cloud layer fails to load.
import { PM_LIMITS, type PmLimits } from "./limits";

declare global {
  interface Window {
    PM_LIMITS: PmLimits;
  }
}

window.PM_LIMITS = PM_LIMITS;
