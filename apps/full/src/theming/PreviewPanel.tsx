/**
 * Live, read-only color/inlay-hint preview for the Theme tab, per
 * `../../../plan-webapp/09-color-preview-panel.md`: a second `EditorView`
 * running only Layer 1/2 highlighting + inlay hints (no lint/completion/
 * hover) against `tokens.cos`, a fixed sample exercising every empirically-
 * reachable semantic type/modifier (see that file's header comment and the
 * phase doc for how "reachable" was verified against the real engine's
 * output, not the full declared legend in `semantics-legend.ts`).
 *
 * Reuses `main.ts`'s already-initialized `CaosEngineClient` rather than
 * spinning up a second Worker/engine load -- `fullAnalysis`/`inlayHints`
 * requests carry their own `variant` per call (the worker's ambient
 * `currentVariant` is never read by either handler), so sharing the client
 * is safe *except* for `bumpRevision()`: the main editor calls it on every
 * keystroke, which cancels every in-flight request on the client, including
 * this panel's one-shot analysis if it's unlucky enough to be in flight at
 * that moment. `retryOnCancellation` below papers over exactly that race --
 * safe to retry indefinitely since this panel's request is always for the
 * same static `tokens.cos` text, so a retry is never wasted work beyond the
 * round trip itself.
 */
import { useEffect, useRef, useState } from "preact/hooks";
import { EditorView } from "codemirror";
import { Compartment, EditorState } from "@codemirror/state";
import { CancelledError, type CaosEngineClient, type GameVariant } from "@creatures-codemirror/engine";
import {
  caosLanguageSupport,
  inlayHints,
  inlayHintTheme,
  semanticTokenClassesAt,
  semanticTokens,
  semanticTokensTheme,
  type SemanticTokensLegend,
} from "@creatures-codemirror/editor";
import tokensCos from "./tokens.cos?raw";
import { TokenColorControl } from "../settings/TokenColorControl.js";
import { findTokenKey } from "./token-keys.js";
import type { ThemeMode } from "./theme-store.js";

/**
 * Maps a `semanticTokenClassesAt()` class back to its `TOKEN_KEYS` key --
 * the inverse of `decode-semantic-tokens.ts`'s `classNamesFor` naming
 * convention (`cm-caos-sem-<type>` / `cm-caos-mod-<modifier>`), which
 * `token-keys.ts` mirrors exactly (modifier keys are stored as `mod-<name>`).
 */
function tokenKeyForClass(cls: string): string | null {
  if (cls.startsWith("cm-caos-sem-")) return cls.slice("cm-caos-sem-".length);
  if (cls.startsWith("cm-caos-mod-")) return `mod-${cls.slice("cm-caos-mod-".length)}`;
  return null;
}

// `tokens.cos` deliberately includes a C1/C2-only construct (`new: simp`'s
// command-prefix/suffix split) to exercise those modifiers -- fixing the
// preview's analysis variant to "C1" is what makes that construct classify
// as a real command instead of falling back to a generic/unresolved token.
// Semantic classification for every other construct in the file is
// identical across all seven variants (verified empirically while writing
// this phase), so this choice doesn't cost coverage of anything else.
const PREVIEW_VARIANT: GameVariant = "C1";

/** Wraps `client.fullAnalysis` so a request cancelled by the *main* editor's own edits (shared client, shared revision counter) gets silently retried instead of leaving this panel's decorations empty forever. */
function retryOnCancellation(client: CaosEngineClient): CaosEngineClient {
  async function fullAnalysis(
    ...args: Parameters<CaosEngineClient["fullAnalysis"]>
  ): ReturnType<CaosEngineClient["fullAnalysis"]> {
    for (;;) {
      try {
        return await client.fullAnalysis(...args);
      } catch (err) {
        if (!(err instanceof CancelledError)) throw err;
      }
    }
  }
  return { fullAnalysis } as unknown as CaosEngineClient;
}

export interface PreviewPanelProps {
  client: CaosEngineClient;
  legend: SemanticTokensLegend;
  mode: ThemeMode;
}

/** CM6's `&dark` base-theme selector only activates per-EditorView, driven by this style-less marker extension -- mirrors `main.ts`'s `darkModeCompartment`. */
function darkModeExtension(mode: ThemeMode) {
  return mode === "dark" ? EditorView.theme({}, { dark: true }) : [];
}

export function PreviewPanel({ client, legend, mode }: PreviewPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const darkCompartmentRef = useRef(new Compartment());
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;
    const retryingClient = retryOnCancellation(client);
    const darkCompartment = darkCompartmentRef.current;

    const view = new EditorView({
      state: EditorState.create({
        doc: tokensCos,
        extensions: [
          caosLanguageSupport(),
          EditorView.lineWrapping,
          EditorView.editable.of(false),
          EditorState.readOnly.of(true),
          // Read only for its initial value here -- `mode` toggling after
          // mount is handled by the effect below via the same compartment,
          // without tearing down/re-fetching this view.
          darkCompartment.of(darkModeExtension(mode)),
          semanticTokens({
            client: retryingClient,
            legend,
            getVariant: () => PREVIEW_VARIANT,
            debounceMs: 0,
          }),
          semanticTokensTheme,
          inlayHints({ client: retryingClient, getVariant: () => PREVIEW_VARIANT }),
          inlayHintTheme,
          EditorView.domEventHandlers({
            click: (event, editorView) => {
              const pos = editorView.posAtCoords({ x: event.clientX, y: event.clientY });
              if (pos == null) return;
              setSelectedClasses(semanticTokenClassesAt(editorView.state, pos));
            },
          }),
        ],
      }),
      parent: containerRef.current,
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Sample text/variant are fixed; only `client`/`legend` identity could
    // plausibly change (they don't, in practice, across this component's
    // lifetime) -- re-run if they ever do rather than assuming.
  }, [client, legend]);

  // `mode` ("editing colors for" Light/Dark, not the app's own display mode
  // -- see PreviewPanelProps) can change on its own after mount; reconfigure
  // the dark-mode marker in place rather than rebuilding the whole view
  // (which would needlessly re-run analysis against the unchanged text).
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: darkCompartmentRef.current.reconfigure(darkModeExtension(mode)),
    });
  }, [mode]);

  const editableClasses = selectedClasses
    .map((cls) => tokenKeyForClass(cls))
    .filter((key): key is string => key !== null)
    .map((key) => findTokenKey(key))
    .filter((def): def is NonNullable<typeof def> => def !== undefined);

  return (
    <div class="theme-preview-panel">
      <div class="theme-preview-editor" ref={containerRef} />
      {editableClasses.length > 0 ? (
        <div class="theme-preview-token-bar">
          {editableClasses.map((def) => (
            <div class="theme-token-row" data-token-key={def.key} key={def.key}>
              <TokenColorControl mode={mode} tokenKey={def.key} />
              <span class="theme-token-label">{def.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <p class="theme-token-hint">Tap any token above to edit its color.</p>
      )}
    </div>
  );
}
