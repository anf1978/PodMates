// Refreshes the Chronicles journal whenever the signed-in account changes: fresh from Firebase for
// a real user, back to empty otherwise. Imported after Saved Decks so the listeners keep their order.
import { refreshCloudChroniclesCache } from "../features/chronicles";
import { onAuthChange } from "../services/cloud/session";

onAuthChange(() => void refreshCloudChroniclesCache());
