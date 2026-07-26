/** Mobile-first app shell: full-screen editor, menu button + slide-over sheet, hidden-by-default log pane. */
import type { ComponentChildren, RefCallback } from "preact";
import type { Signal } from "@preact/signals";
import { useState } from "preact/hooks";

export type SheetSection = "files" | "settings";

export interface ShellProps {
  editorContainerRef: RefCallback<HTMLDivElement>;
  /** File/project browser + variant picker (Phase 03/04). */
  filesBody: Signal<ComponentChildren>;
  /** Settings tab container (Phase 06). */
  settingsBody: Signal<ComponentChildren>;
}

const SHEET_SECTIONS: { id: SheetSection; label: string }[] = [
  { id: "files", label: "Files" },
  { id: "settings", label: "Settings" },
];

export function Shell(props: ShellProps): ComponentChildren {
  const { editorContainerRef, filesBody, settingsBody } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<SheetSection>("files");

  return (
    <>
      <div ref={editorContainerRef} id="editor" class="shell-editor" />

      <button
        type="button"
        id="menu-button"
        class={logOpen ? "shell-menu-button shell-menu-button--log-open" : "shell-menu-button"}
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        ☰
      </button>

      {menuOpen && (
        <div class="shell-sheet-backdrop" onClick={() => setMenuOpen(false)}>
          <div class="shell-sheet" onClick={(event) => event.stopPropagation()}>
            <div class="shell-sheet-header">
              <h2>Menu</h2>
              <button type="button" onClick={() => setLogOpen((open) => !open)}>
                {logOpen ? "Hide log" : "Show log"}
              </button>
              <button type="button" class="shell-sheet-close" aria-label="Dismiss menu" onClick={() => setMenuOpen(false)}>
                ×
              </button>
            </div>
            <div class="segmented-control shell-sheet-nav" role="tablist">
              {SHEET_SECTIONS.map((section) => (
                <button
                  type="button"
                  role="tab"
                  key={section.id}
                  aria-selected={section.id === activeSection}
                  class={
                    section.id === activeSection
                      ? "segmented-control-segment segmented-control-segment--active"
                      : "segmented-control-segment"
                  }
                  onClick={() => setActiveSection(section.id)}
                >
                  {section.label}
                </button>
              ))}
            </div>
            {/* Both always mounted (only visibility toggles), like #log below --
                so FileBrowser/SettingsPanel's own internal state (and, for
                Settings, the live inlay-hint checkbox state) survives
                switching sections, instead of resetting to its initial
                value on every remount. */}
            <div class={activeSection === "files" ? "shell-sheet-body" : "shell-sheet-body shell-sheet-body-hidden"}>
              {filesBody.value}
            </div>
            <div class={activeSection === "settings" ? "shell-sheet-body" : "shell-sheet-body shell-sheet-body-hidden"}>
              {settingsBody.value}
            </div>
          </div>
        </div>
      )}

      {/* Always mounted (only visibility toggles) so main.ts's cached #log node/textContent
          survives across open/close — matches log()'s existing append-only behavior. */}
      <div id="log" class={logOpen ? "shell-log shell-log-open" : "shell-log"} />
    </>
  );
}
