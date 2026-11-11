// The pod open on MyPods, for Chronicles, profiles and PriceScry's Spoiler Bait tab. MyPods
// provides it once mounted (src/app/pods.ts); until then there is none. No side effects.
let source: () => string | null = () => null;

export const activePodId = (): string | null => source();

export function provideActivePod(get: () => string | null): void {
  source = get;
}
