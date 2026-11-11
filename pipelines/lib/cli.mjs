import { pathToFileURL } from "node:url";

/** @param {string} url */
export function isMain(url) {
  return Boolean(process.argv[1]) && url === pathToFileURL(process.argv[1]).href;
}
