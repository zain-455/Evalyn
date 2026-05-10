import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useEB } from './ExamBuilderContext';

export default function DeleteConfirmationModal() {
  const { 
    deleteConfirmOpen, setDeleteConfirmOpen, deleteTargetId, setDeleteTargetId, 
    deleteQuestionMutation, setSkipDeleteConfirmation
  } = useEB();

  const [localSkip, setLocalSkip] = useState(false);

  if (!deleteConfirmOpen) return null;

  const handleClose = () => {
    if (deleteQuestionMutation.isPending) return;
    setDeleteConfirmOpen(false);
    setDeleteTargetId(null);
  };

  const handleConfirm = async () => {
    if (!deleteTargetId || deleteQuestionMutation.isPending) return;
    
    if (localSkip) {
      setSkipDeleteConfirmation(true);
      localStorage.setItem('evalyn_skip_delete_confirm', 'true');
    }

    try {
      await deleteQuestionMutation.mutateAsync(deleteTargetId);
      setDeleteConfirmOpen(false);
      setDeleteTargetId(null);
    } catch (err) {
      // toast is handled in mutation
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '1.5rem'
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        style={{
          background: '#1e1e1e',
          borderRadius: '16px',
          boxShadow: '0 12px 48px rgba(0,0,0,0.65)',
          width: '100%',
          maxWidth: '440px',
          padding: '2.25rem 2.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <h2 style={{ 
            margin: 0, 
            fontSize: '1.35rem', 
            fontWeight: 800, 
            color: '#ffffff',
            letterSpacing: '-0.01em',
            fontFamily: "'Poppins', sans-serif"
          }}>
            Delete question?
          </h2>
          <p style={{ 
            color: 'rgba(255,255,255,0.5)', 
            fontSize: '0.98rem', 
            lineHeight: 1.5, 
            margin: 0,
            fontFamily: "'Poppins', sans-serif"
          }}>
            This will permanently remove this question from this exam.
          </p>
        </div>

        {/* Skip confirmation checkbox */}
        <label style={{ 
          display: 'flex', alignItems: 'center', gap: '0.85rem', 
          cursor: 'pointer', userSelect: 'none',
          padding: '0.15rem 0',
          marginTop: '-0.75rem'
        }}>
          <div style={{ 
            width: '18px', height: '18px', borderRadius: '4px', 
            border: `2px solid ${localSkip ? '#d98f30' : 'rgba(255,255,255,0.15)'}`,
            background: localSkip ? '#d98f30' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s ease'
          }}>
            {localSkip && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            )}
            <input 
              type="checkbox" 
              checked={localSkip} 
              onChange={() => setLocalSkip(!localSkip)} 
              style={{ display: 'none' }}
            />
          </div>
          <span style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>
            Don't ask again
          </span>
        </label>

        <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', width: '100%', margin: '0.25rem 0' }} />

        <div style={{ display: 'flex', gap: '0.85rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            disabled={deleteQuestionMutation.isPending}
            onClick={handleClose}
            style={{
              background: '#333335',
              color: '#ffffff',
              border: 'none',
              borderRadius: '100px',
              padding: '0.75rem 1.75rem',
              fontSize: '0.92rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'filter 0.2s ease'
            }}
            onMouseOver={e => e.currentTarget.style.filter = 'brightness(1.15)'}
            onMouseOut={e => e.currentTarget.style.filter = 'brightness(1)'}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deleteQuestionMutation.isPending}
            onClick={handleConfirm}
            style={{
              background: '#a6283d',
              color: 'white',
              border: 'none',
              borderRadius: '100px',
              padding: '0.75rem 2rem',
              fontSize: '0.92rem',
              fontWeight: 700,
              cursor: deleteQuestionMutation.isPending ? 'not-allowed' : 'pointer',
              transition: 'filter 0.2s ease'
            }}
            onMouseOver={e => e.currentTarget.style.filter = 'brightness(1.1)'}
            onMouseOut={e => e.currentTarget.style.filter = 'brightness(1)'}
          >
            {deleteQuestionMutation.isPending ? 'Removing...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
