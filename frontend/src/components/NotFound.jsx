import React from 'react';

function NotFound() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: '#f7fafc',
      padding: '20px'
    }}>
      <div style={{
        width: '60%',
        maxWidth: '800px',
        textAlign: 'center'
      }}>
        <div style={{
          border: '4px solid #2d3748',
          borderRadius: '8px',
          padding: '40px',
          backgroundColor: '#ffffff',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          <img
            src="https://i.imgflip.com/4/1bij.jpg"
            alt="404 Not Found"
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
              borderRadius: '4px'
            }}
          />
          <div style={{
            marginTop: '32px',
            color: '#2d3748'
          }}>
            <h1 style={{
              fontSize: '2.5em',
              fontWeight: '700',
              margin: '0 0 16px 0'
            }}>
              404 - Page Not Found
            </h1>
            <p style={{
              fontSize: '1.2em',
              color: '#4a5568',
              margin: '0 0 24px 0'
            }}>
              Oops! The page you're looking for doesn't exist.
            </p>
            <button
              onClick={() => window.location.href = '/'}
              style={{
                padding: '12px 24px',
                background: '#2166e8',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '1em',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.target.style.background = '#1c4fd6'}
              onMouseOut={(e) => e.target.style.background = '#2166e8'}
            >
              Go Back Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NotFound;
