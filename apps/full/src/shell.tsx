/** Mobile-first app shell: full-screen editor, menu button + slide-over sheet, hidden-by-default log pane. */
import type { ComponentChildren, RefCallback } from "preact";
import type { Signal } from "@preact/signals";
import { useState } from "preact/hooks";

export interface ShellProps {
  editorContainerRef: RefCallback<HTMLDivElement>;
  /** Menu-sheet content — empty placeholder in this phase; Phase 03/06 fill this in. */
  sheetBody: Signal<ComponentChildren>;
}

export function Shell(props: ShellProps): ComponentChildren {
  const { editorContainerRef, sheetBody } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

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
            <div class="shell-sheet-body">{sheetBody.value}</div>
          </div>
        </div>
      )}

      {/* Always mounted (only visibility toggles) so main.ts's cached #log node/textContent
          survives across open/close — matches log()'s existing append-only behavior. */}
      <div id="log" class={logOpen ? "shell-log shell-log-open" : "shell-log"} />
    </>
  );
}
