// Open-from-disk / download helpers for the current editor document.
// No storage-layer calls here — callers decide what to do with the text
// (e.g. `createFile`) once it's been read.

/**
 * Opens a native file picker restricted to `.cos` files and resolves with
 * the chosen file's name and text content. If the user dismisses the picker
 * without choosing a file, the returned promise simply never settles (no
 * `change` event fires) — callers only await this in response to an explicit
 * "Open" tap, so an abandoned picker has no observable effect.
 */
export function pickCosFileFromDisk(): Promise<{ name: string; text: string }> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".cos";
    input.style.display = "none";

    input.addEventListener("change", () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, text: String(reader.result ?? "") });
      reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
      reader.readAsText(file);
    });

    document.body.appendChild(input);
    input.click();
  });
}

function withCosExtension(name: string): string {
  return name.toLowerCase().endsWith(".cos") ? name : `${name}.cos`;
}

/** Triggers a browser download of `text` named after `name` (`.cos` appended if missing). */
export function downloadAsCosFile(name: string, text: string): void {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = withCosExtension(name);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
