
import React from 'react';

interface PaginationProps {
  totalItems: number;
  itemsPerPage: number;
  currentPage: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ totalItems, itemsPerPage, currentPage, onPageChange }) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  if (totalPages <= 1) {
    return null;
  }

  const getPageNumbers = (): (string | number)[] => {
    // This logic creates a smart pagination with ellipses for large page counts.
    // e.g., [1, '...', 4, 5, 6, '...', 20]
    const pageNeighbours = 1; 
    const totalNumbers = (pageNeighbours * 2) + 3; // Numbers to show in the core (e.g., 4,5,6)
    const totalBlocks = totalNumbers + 2; // Including first page, last page, and ellipses

    if (totalPages <= totalBlocks) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const leftSiblingIndex = Math.max(currentPage - pageNeighbours, 1);
    const rightSiblingIndex = Math.min(
      currentPage + pageNeighbours,
      totalPages
    );

    const shouldShowLeftDots = leftSiblingIndex > 2;
    const shouldShowRightDots = rightSiblingIndex < totalPages - 1;

    const firstPageIndex = 1;
    const lastPageIndex = totalPages;

    if (!shouldShowLeftDots && shouldShowRightDots) {
      let leftItemCount = 3 + 2 * pageNeighbours;
      let leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
      return [...leftRange, '...', totalPages];
    }

    if (shouldShowLeftDots && !shouldShowRightDots) {
      let rightItemCount = 3 + 2 * pageNeighbours;
      let rightRange = Array.from({ length: rightItemCount }, (_, i) => totalPages - rightItemCount + i + 1);
      return [firstPageIndex, '...', ...rightRange];
    }

    if (shouldShowLeftDots && shouldShowRightDots) {
      let middleRange = Array.from({ length: (pageNeighbours * 2) + 1 }, (_, i) => leftSiblingIndex + i);
      return [firstPageIndex, '...', ...middleRange, '...', lastPageIndex];
    }
    
    // Fallback in case logic fails, though it shouldn't.
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  };

  const pageNumbers = getPageNumbers();

  return (
    <nav className="flex items-center justify-end space-x-1 mt-4" aria-label="Pagination">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Halaman Sebelumnya"
      >
        Sebelumnya
      </button>

      {pageNumbers.map((page, index) => {
        if (typeof page === 'string') {
          return (
            <span key={`dots-${index}`} className="px-3 py-2 text-sm font-medium text-gray-600">
              ...
            </span>
          );
        }

        return (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`px-3 py-2 text-sm font-medium border border-gray-300 rounded-md ${
              currentPage === page
                ? 'bg-pink-600 text-white border-pink-600 z-10'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
            aria-current={currentPage === page ? 'page' : undefined}
          >
            {page}
          </button>
        );
      })}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Halaman Berikutnya"
      >
        Berikutnya
      </button>
    </nav>
  );
};

export default Pagination;
