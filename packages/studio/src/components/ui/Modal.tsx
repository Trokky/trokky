import React from 'react';
import { Dialog } from './Dialog.js';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  children: React.ReactNode;
  closeOnOverlayClick?: boolean;
}

/**
 * Modal - centred dialog with an optional title bar.
 *
 * Thin wrapper over the Dialog primitive; kept for its existing prop shape.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  size = 'md',
  children,
  closeOnOverlayClick = true
}: ModalProps) {
  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      variant="center"
      size={size}
      title={title}
      closeOnBackdrop={closeOnOverlayClick}
    >
      <Dialog.Body padded={false} className="p-6">
        {children}
      </Dialog.Body>
    </Dialog>
  );
}
