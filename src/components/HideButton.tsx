import React from 'react';

interface HideButtonProps {
  isHidden: boolean;
  onToggle: () => void;
}

const HideButton: React.FC<HideButtonProps> = ({ isHidden, onToggle }) => {
  return (
    <button
      onClick={onToggle}
      style={{
        position: 'fixed',
        bottom: '30px',
        right: '30px',
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        backgroundColor: '#4CAF50',
        color: 'white',
        border: 'none',
        cursor: 'pointer',
        fontSize: '30px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        transition: 'all 0.2s ease',
        zIndex: 1000
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.1)';
        e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.25)';
        e.currentTarget.style.backgroundColor = '#45a049';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        e.currentTarget.style.backgroundColor = '#4CAF50';
      }}
      title={isHidden ? 'Show words' : 'Hide words'}
      aria-label={isHidden ? 'Show words' : 'Hide words'}
    >
      {isHidden ? '👁️' : '👁️‍🗨️'}
    </button>
  );
};

export default HideButton;
