// Binds Export to the Deck Chart's current deck.
import { mount } from "./index";
import { currentChart } from "../../services/current-chart";

const button = document.getElementById("exportDeckBtn");
if (button)
  mount(button, () => {
    const { matched, commanders } = currentChart();
    return matched && commanders ? { matched, commanders } : null;
  });
