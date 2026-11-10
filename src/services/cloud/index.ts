// Entry point loaded by index.html as a module. Modules always run after every ordinary <script>,
// so the app's startup code cannot assume window.PodmatesCloud exists yet; it waits for the
// "podmates-cloud-init" event dispatched below instead.
import "./limits-global";
import { createCloudApi, type PodmatesCloudApi } from "./api";

declare global {
  interface Window {
    PodmatesCloud: PodmatesCloudApi;
  }
}

window.PodmatesCloud = createCloudApi();
window.dispatchEvent(new CustomEvent("podmates-cloud-init"));
