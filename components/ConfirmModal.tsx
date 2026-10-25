import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { Card } from './ui/Surface';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen, title, message, onConfirm, onCancel, confirmText = 'Confirm', cancelText = 'Cancel', isDestructive = false
}) => {
  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen min-h-screen z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 overflow-y-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <Card className="shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in duration-200 border-gray-100">
        <div className="p-6 text-center">
          <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${isDestructive ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">{message}</p>
          
          <div className="flex gap-3 justify-center">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 px-4 py-2 rounded-md text-white font-medium shadow-md transition-colors ${isDestructive ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};

export default ConfirmModal;
