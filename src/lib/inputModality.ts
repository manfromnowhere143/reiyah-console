/* Native focus-visible remains the default. Track actual pointer intent before
   dialog autofocus runs: WebKit can otherwise retain a keyboard-style ring
   when focus is restored or moved programmatically after a click. */
export function installInputModality(doc: Document = document): () => void {
  const root = doc.documentElement;
  root.dataset.inputModality = "keyboard";
  const pointer = () => {
    root.dataset.inputModality = "pointer";
  };
  const keyboard = (e: KeyboardEvent) => {
    if (e.isComposing || ["Shift", "Control", "Alt", "Meta"].includes(e.key))
      return;
    root.dataset.inputModality = "keyboard";
  };
  // Assistive activation can produce a trusted click without pointer events.
  // Scripted .click() must not reverse a preceding physical pointer choice.
  const click = (e: MouseEvent) => {
    if (e.isTrusted && e.detail === 0) root.dataset.inputModality = "keyboard";
  };
  doc.addEventListener("pointerdown", pointer, true);
  doc.addEventListener("keydown", keyboard, true);
  doc.addEventListener("click", click, true);
  return () => {
    doc.removeEventListener("pointerdown", pointer, true);
    doc.removeEventListener("keydown", keyboard, true);
    doc.removeEventListener("click", click, true);
    delete root.dataset.inputModality;
  };
}
