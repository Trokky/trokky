import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  children: React.ReactNode;
  closeOnOverlayClick?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  size = 'md',
  children,
  closeOnOverlayClick = true
}: ModalProps) {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-7xl'
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div 
        className="flex min-h-screen items-center justify-center p-4"
        onClick={handleOverlayClick}
      >
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" />
        
        {/* Modal */}
        <div className={cn(
          'relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full',
          'animate-in fade-in slide-in-from-bottom duration-200',
          sizeClasses[size]
        )}>
          {/* Header */}
          {title && (
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {title}
              </h2>
              <button
                onClick={onClose}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          )}
          
          {/* Content */}
          <div className={cn(title ? 'p-6' : 'p-6')}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}