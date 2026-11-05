// Chrome's Capture Handle API (lets us keep focus on our tab after sharing another tab).
// Not yet part of TypeScript's DOM typings.
declare class CaptureController {
  constructor();
  setFocusBehavior(behavior: 'focus-captured-surface' | 'no-focus-change'): void;
}
