import React from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string | React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: 'info' | 'warning' | 'success';
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText,
  type = 'info'
}) => {
  if (!isOpen) return null;

  const getTypeStyles = () => {
    switch (type) {
      case 'warning':
        return {
          borderColor: '#f59e0b',
          iconColor: '#f59e0b',
          confirmBg: '#f59e0b',
          confirmHover: '#d97706'
        };
      case 'success':
        return {
          borderColor: '#10b981',
          iconColor: '#10b981',
          confirmBg: '#10b981',
          confirmHover: '#059669'
        };
      default:
        return {
          borderColor: '#3b82f6',
          iconColor: '#3b82f6',
          confirmBg: '#3b82f6',
          confirmHover: '#2563eb'
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 24px 16px 24px',
          borderBottom: `2px solid ${styles.borderColor}`
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 'bold',
            color: '#1f2937',
            margin: 0
          }}>
            {title}
          </h2>
        </div>

        {/* Body */}
        <div style={{
          padding: '24px',
          fontSize: '16px',
          color: '#4b5563',
          lineHeight: '1.6'
        }}>
          {message}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px 24px 24px',
          display: 'flex',
          gap: '12px',
          justifyContent: cancelText ? 'flex-end' : 'center'
        }}>
          {cancelText && (
            <button
              onClick={onCancel}
              style={{
                padding: '10px 20px',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={onConfirm}
            style={{
              padding: '10px 20px',
              backgroundColor: styles.confirmBg,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = styles.confirmHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = styles.confirmBg}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
