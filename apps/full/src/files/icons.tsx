/** Small inline icon set for the files toolbar's icon buttons (no icon library dependency). */

export function NewFileIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <path d="M5 2.5h6l3 3v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1z" stroke-linejoin="round" />
      <path d="M11 2.5v3h3" stroke-linejoin="round" />
      <path d="M10 10.5v5M7.5 13h5" stroke-linecap="round" />
    </svg>
  );
}

export function OpenFileIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <path
        d="M2.5 5.5a1 1 0 0 1 1-1h3.5l1.5 2H16a1 1 0 0 1 1 1v7.5a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1v-9.5z"
        stroke-linejoin="round"
      />
      <path d="M10 12.5v-5M7.8 9.7 10 7.5l2.2 2.2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

export function DownloadIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <path d="M10 3v8.5M7.5 9l2.5 2.5L12.5 9" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M3.5 13v2.5a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V13" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}
