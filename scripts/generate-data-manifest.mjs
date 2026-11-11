// Bootstrap metadata for the extracted snapshots; subsequent refreshes preserve sibling dates.
import { fileURLToPath } from "node:url";
import { snapshotManifest } from "../pipelines/lib/dataset-manifest.mjs";

snapshotManifest(fileURLToPath(new URL("../public/data/", import.meta.url)));
