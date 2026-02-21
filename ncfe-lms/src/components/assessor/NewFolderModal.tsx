'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';

interface NewFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string) => void;
}

export default function NewFolderModal({ isOpen, onClose, onConfirm }: NewFolderModalProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleClose = () => {
    setName('');
    setError('');
    onClose();
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      setError('Folder name is required');
      return;
    }
    onConfirm(name.trim());
    handleClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="New Folder" size="sm">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Folder Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
            }}
            placeholder="e.g. Unit 3 Documents"
            autoFocus
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
          {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
        <button
          onClick={handleClose}
          className="px-4 py-2 border border-gray-200 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          Create
        </button>
      </div>
    </Modal>
  );
}
