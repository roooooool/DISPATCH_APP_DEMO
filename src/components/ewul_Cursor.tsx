import { useEffect, useState } from 'react';
import '../components/comp_css/ewul_Cursor.css';

interface EwulCursorProps {
  show?: boolean,
}


const EwulCursor = ({ show = false }: EwulCursorProps) => {

  const [position, setPosition] = useState({ x: 0, y: 0 });
  

  useEffect(() => {
    const moveCursor = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', moveCursor);
    return () => window.removeEventListener('mousemove', moveCursor);
  }, []);


  useEffect(() => {
    if (show) {
      document.body.classList.add('custom-cursor-active');
    } else {
      document.body.classList.remove('custom-cursor-active');
    }
    
    // Clean up if the component unmounts
    return () => document.body.classList.remove('custom-cursor-active');
  }, [show]);


  if (!show) return null;
  

  return (
    <div 
      className="ewul-custom-cursor"
      style={{ 
        left: `${position.x}px`, 
        top: `${position.y}px`,
        transform: `rotate(-20deg)`,
        // Using filter drop-shadow to outline the triangle shape specifically
        filter: 'drop-shadow(2px 2px 3px rgba(0, 0, 0, 0.4))'
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ overflow: 'visible' }}>
        {/* Left Side: Red (Accent) */}
        <path 
          d="M12 2L4 20L12 16V2Z" 
          fill="var(--color-accent, red)" 
          stroke="var(--color--accent-light)" 
          strokeWidth="1"
          strokeLinejoin="round"
        />
        {/* Right Side: Navy Blue (Primary) */}
        <path 
          d="M12 2V16L20 20L12 2Z" 
          fill="var(--color-primary, #3a4efc)" 
          stroke="var(--color--accent-light)" 
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

export default EwulCursor;