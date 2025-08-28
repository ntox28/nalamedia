import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange, totalItems, itemsPerPage }) => {
  if (totalPages <= 1) {
    return null;
  }

  const getPageNumbers = () => {
    const pageNumbers: (number | string)[] = [];
    const maxPagesToShow = 5;
    const halfPagesToShow = Math.floor(maxPagesToShow / 2);

    if (totalPages <= maxPagesToShow + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      pageNumbers.push(1);
      if (currentPage > halfPagesToShow + 2) {
        pageNumbers.push('...');
      }

      let start = Math.max(2, currentPage - halfPagesToShow);
      let end = Math.min(totalPages - 1, currentPage + halfPagesToShow);
      
      if (currentPage <= halfPagesToShow + 1) {
          end = maxPagesToShow;
      }
      
      if (currentPage >= totalPages - halfPagesToShow) {
          start = totalPages - maxPagesToShow + 1;
      }

      for (let i = start; i <= end; i++) {
        pageNumbers.push(i);
      }
      
      if (currentPage < totalPages - halfPagesToShow - 1) {
        pageNumbers.push('...');
      }
      pageNumbers.push(totalPages);
    }
    return pageNumbers;
  };

  const pages = getPageNumbers();
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <nav className="flex flex-col sm:flex-row items-center justify-between mt-4 text-sm">
      <div className="text-gray-600 mb-2 sm:mb-0">
        Menampilkan {startItem} - {endItem} dari {totalItems} hasil
      </div>
      <div className="flex items-center space-x-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1.5 font-medium text-gray-600 bg-white border rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          Sebelumnya
        </button>
        {pages.map((page, index) => (
          <button
            key={index}
            onClick={() => typeof page === 'number' && onPageChange(page)}
            disabled={typeof page !== 'number'}
            className={`px-3 py-1.5 rounded-md ${
              page === currentPage
                ? 'bg-pink-600 text-white font-bold'
                : typeof page === 'number'
                ? 'bg-white text-gray-600 border hover:bg-gray-50'
                : 'text-gray-500 px-1'
            }`}
          >
            {page}
          </button>
        ))}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1.5 font-medium text-gray-600 bg-white border rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          Berikutnya
        </button>
      </div>
    </nav>
  );
};

export default Pagination;
