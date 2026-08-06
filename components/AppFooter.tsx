import React from 'react';

interface AppFooterProps {
  className?: string;
}

const AppFooter: React.FC<AppFooterProps> = ({ className = '' }) => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={`px-4 py-5 text-center text-[11px] leading-relaxed text-gray-500 ${className}`}>
      <p>&copy; 2025-{currentYear}. Leon NHS - Science Laboratory</p>
      <p>Developed by Fitz Jyro Calisnao, through the vision of Jong Bok Chun, KOICA Volunteer</p>
    </footer>
  );
};

export default AppFooter;
