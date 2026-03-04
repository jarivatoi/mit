import React from 'react';

type ConfirmationModalProps = {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
};

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDanger = false
}) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      overflow: 'auto',
      WebkitOverflowScrolling: 'touch',
      touchAction: 'pan-y'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 24,
        maxWidth: '400px',
        width: '90%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        margin: '16px',
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y'
      }}>
        <h3 style={{ 
          marginTop: 0, 
          marginBottom: 16, 
          fontSize: 18, 
          fontWeight: 600,
          color: '#1f2937'
        }}>
          {title}
        </h3>
        <p style={{ 
          marginBottom: 24, 
          color: '#6b7280',
          lineHeight: 1.5
        }}>
          {message}
        </p>
        <div style={{ 
          display: 'flex', 
          gap: 12, 
          justifyContent: 'flex-end' 
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 16px',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              background: 'white',
              color: '#6b7280',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '10px 16px',
              borderRadius: 6,
              border: 'none',
              background: isDanger ? '#ef4444' : '#2563eb',
              color: 'white',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;