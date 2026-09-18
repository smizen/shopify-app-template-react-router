interface PageIndicatorProps {
  currentPage: number;
  totalPages: number;
}

/**
 * Renders the page indicator on a packing slip (Story 3.3, FR-8).
 * Pure 1-bit black on white, minimal height.
 */
export function PageIndicator({ currentPage, totalPages }: PageIndicatorProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="slip-page-indicator" aria-label={`Page ${currentPage} of ${totalPages}`}>
      Page {currentPage}/{totalPages}
    </div>
  );
}
