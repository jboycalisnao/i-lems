import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { RegistrarLearner } from '../services/usisRoster';
import { CheckCircle2, User, Mail, Hash, BookOpen, AlertCircle, ArrowRight, X, Phone } from 'lucide-react';

interface LearnerConfirmModalProps {
  isOpen: boolean;
  learner: RegistrarLearner | null;
  onConfirm: (confirmedLearner: RegistrarLearner, email: string) => void;
  onCancel: () => void;
  inline?: boolean;
}

export const LearnerConfirmModal: React.FC<LearnerConfirmModalProps> = ({
  isOpen,
  learner,
  onConfirm,
  onCancel,
  inline = false
}) => {
  const [isVerifying, setIsVerifying] = useState(true);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Trigger USIS circle animation sequence whenever modal opens with a learner
  useEffect(() => {
    if (isOpen && learner) {
      setIsVerifying(true);
      const timer = setTimeout(() => {
        setIsVerifying(false);
      }, 1300);
      return () => clearTimeout(timer);
    } else {
      setIsVerifying(true);
    }
  }, [isOpen, learner]);

  // When learner changes, smart-initialize email field
  useEffect(() => {
    if (!learner) {
      setEmail('');
      setEmailError('');
      return;
    }

    const rawContact = learner.contact_number?.trim() || '';
    const rawEmail = ((learner as any).email as string | undefined)?.trim() || '';

    // Only prefill if it is genuinely an email (contains '@')
    if (rawEmail && rawEmail.includes('@') && rawEmail.includes('.')) {
      setEmail(rawEmail);
    } else if (rawContact && rawContact.includes('@') && rawContact.includes('.')) {
      setEmail(rawContact);
    } else if (learner.lrn) {
      setEmail(`${learner.lrn}@deped.gov.ph`);
    } else {
      setEmail('');
    }
    setEmailError('');
  }, [learner]);

  const submitWithEmail = (targetEmail: string) => {
    if (!learner) return;
    const cleanEmail = targetEmail.trim();

    if (!cleanEmail) {
      setEmailError('Please enter an email address to receive equipment loan receipts.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setEmailError('Please enter a valid email address (e.g., student@example.com). Phone numbers cannot receive email receipts.');
      return;
    }

    setEmailError('');
    onConfirm(learner, cleanEmail);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    submitWithEmail(email);
  };

  // Keyboard shortcut listener: Enter to Confirm & Proceed, Escape to Cancel
  useEffect(() => {
    if (!isOpen || isVerifying || !learner) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitWithEmail(email);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isVerifying, learner, email, onConfirm, onCancel]);

  // Auto-focus the Confirm button when verification finishes
  useEffect(() => {
    if (isOpen && !isVerifying) {
      const timer = setTimeout(() => {
        if (confirmButtonRef.current) {
          confirmButtonRef.current.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isVerifying]);

  if (!isOpen || !learner) return null;

  const formattedName = learner.full_name || learner.name || 'Learner Borrower';
  const hasPhoneFromUsis = learner.contact_number && !learner.contact_number.includes('@');

  // Step 1: Clean Circle Animation on Light White Background before showing modal
  if (isVerifying) {
    const loadingView = (
      <div className="flex-1 flex flex-col items-center justify-center text-center my-8 max-w-md mx-auto w-full animate-in fade-in duration-300">
        {/* Simple Clean Circle Animation */}
        <div className="relative flex items-center justify-center w-40 h-40">
          <div className="absolute inset-0 rounded-full border-2 border-gray-200 border-t-blue-600 animate-spin"></div>
          <div className="w-36 h-36 rounded-full bg-white border border-gray-200 flex items-center justify-center p-4 shadow-xs">
            <img
              src="/img/USIS%20-%20Typemark.png"
              alt="USIS Typemark"
              className="w-32 max-h-20 object-contain animate-in zoom-in-95 duration-300"
            />
          </div>
        </div>

        <p className="mt-5 text-sm font-semibold text-gray-800 tracking-tight">
          Connecting to Leon NHS - Unified School Information System (USIS)
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Verifying learner identity & checking loan authorization...
        </p>
      </div>
    );

    if (inline) {
      return loadingView;
    }

    return createPortal(
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-white/95 backdrop-blur-xs animate-in fade-in duration-200"
        role="dialog"
        aria-modal="true"
        aria-label="Verifying Learner Record"
      >
        {loadingView}
      </div>,
      document.body
    );
  }

  // Step 2: Confirmation Box Modal / View
  const confirmContent = (
    <div className={`bg-white rounded-lg border border-gray-300 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 text-left ${inline ? 'my-2 shadow-xs' : 'shadow-2xl my-8'}`}>
      {/* USIS Header with Typemark */}
      <div className="p-5 sm:p-6 bg-white border-b border-gray-200 text-center relative">
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
          title="Cancel (Esc)"
        >
          <X className="w-5 h-5" />
        </button>

        {/* USIS Typemark Banner */}
        <div className="flex items-center justify-center mb-2">
          <img
            src="/img/USIS%20-%20Typemark.png"
            alt="USIS Typemark"
            className="h-10 max-w-[240px] object-contain animate-in zoom-in-95 duration-200"
          />
        </div>

        <p className="text-xs text-gray-600 font-medium">
          Learner Identity Verification & Loan Confirmation
        </p>
      </div>

      {/* Verification Form */}
      <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 bg-white">
        {/* Identity Question */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-900 font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-blue-700 flex-shrink-0" />
          <span>RFID scan matched an active registrar record. Please verify that this information is correct:</span>
        </div>

        {/* Learner Information Box */}
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-md space-y-2.5 text-xs">
          <div className="flex items-start gap-2.5">
            <User className="w-4 h-4 text-maroon-600 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">Learner Full Name</span>
              <span className="text-base font-bold text-gray-900 leading-snug">{formattedName}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <Hash className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
              <div>
                <span className="text-[10px] text-gray-500 block">Learner Reference No. (LRN)</span>
                <span className="font-mono font-bold text-gray-800">{learner.lrn || 'Not Indexed'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
              <div>
                <span className="text-[10px] text-gray-500 block">Grade & Section</span>
                <span className="font-semibold text-gray-800">
                  {learner.section_name || 'Section Unassigned'} {learner.grade_level ? `(${learner.grade_level})` : ''}
                </span>
              </div>
            </div>
          </div>

          {hasPhoneFromUsis && (
            <div className="pt-2 border-t border-gray-200 flex items-center gap-2 text-gray-600">
              <Phone className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
              <div>
                <span className="text-[10px] text-gray-500 block">USIS Contact Number (On File)</span>
                <span className="font-mono font-medium text-gray-700">{learner.contact_number}</span>
              </div>
            </div>
          )}
        </div>

        {/* Email Address Input - Highlighted Action Area */}
        <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-md space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-gray-900">
              Notification Email Address <span className="text-red-500">*</span>
            </label>
            <span className="text-[10px] font-semibold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-300">
              Action Required
            </span>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="w-4 h-4 text-amber-600" />
            </div>
            <input
              ref={emailInputRef}
              type="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError('');
              }}
              placeholder="e.g., student@gmail.com or LRN@deped.gov.ph"
              className={`w-full pl-9 pr-3 py-2 text-xs border rounded-md bg-white focus:outline-hidden focus:ring-2 transition-colors ${
                emailError
                  ? 'border-red-500 focus:border-red-600 focus:ring-red-100'
                  : 'border-amber-300 focus:border-blue-600 focus:ring-blue-100 shadow-xs'
              }`}
            />
          </div>
          {emailError ? (
            <p className="text-[11px] text-red-600 font-medium flex items-center gap-1 mt-1">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{emailError}</span>
            </p>
          ) : (
            <p className="text-[11px] text-amber-900/80 leading-relaxed">
              Provide an active email address to receive equipment checkout confirmation, release receipts, and return reminders.
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-md transition-colors cursor-pointer"
          >
            Not You? Cancel
          </button>

          <button
            ref={confirmButtonRef}
            type="submit"
            className="px-5 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 focus:ring-2 focus:ring-blue-500 focus:outline-none rounded-md transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
            title="Press Enter (↵) to Confirm & Proceed"
          >
            <span>Confirm & Proceed to Borrow</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );

  if (inline) {
    return confirmContent;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      {confirmContent}
    </div>,
    document.body
  );
};

export default LearnerConfirmModal;
