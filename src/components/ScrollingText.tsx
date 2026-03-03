import React, { useRef, useEffect, useState } from 'react';
import { ScrollingTextAnimator } from '../utils/scrollingTextAnimator';

interface ScrollingTextProps {
  text?: string;
  className?: string;
  children?: React.ReactNode;
  pauseDuration?: number;
  scrollDuration?: number;
  easing?: string;
}

export const ScrollingText: React.FC<ScrollingTextProps> = ({ 
  text, 
  className = '', 
  children,
  pauseDuration = 1,
  scrollDuration = 2.5,
  easing = 'power2.inOut'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [needsScrolling, setNeedsScrolling] = useState(false);
  const animatorRef = useRef<ScrollingTextAnimator | null>(null);
  const scrollListenerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const checkAndAnimate = () => {
      if (!containerRef.current || !textRef.current) return;

      const container = containerRef.current;
      const textElement = textRef.current;
      
      // Stop any existing animation
      if (animatorRef.current) {
        animatorRef.current.stop();
        animatorRef.current = null;
      }
      
      // Remove existing scroll listener
      if (scrollListenerRef.current) {
        window.removeEventListener('scroll', scrollListenerRef.current, { passive: true } as any);
        document.removeEventListener('scroll', scrollListenerRef.current, { passive: true } as any);
        scrollListenerRef.current = null;
      }
      
      // Force layout recalculation
      container.offsetWidth;
      textElement.offsetWidth;
      
      // Check if text overflows container
      const containerWidth = container.offsetWidth;
      const textWidth = textElement.scrollWidth;
      
      const currentText = text || 'children content';
      const hasSpaces = currentText.includes(' ');
      const isLongText = currentText.length > 30;
      
      if (textWidth > containerWidth) {
        setNeedsScrolling(true);
        
        // Use enhanced timing for longer text with spaces
        const enhancedPauseDuration = (hasSpaces && isLongText) ? 3 : pauseDuration;
        const enhancedScrollDuration = (hasSpaces && isLongText) ? 7 : scrollDuration;
        const enhancedEasing = (hasSpaces && isLongText) ? 'power1.inOut' : easing;
        
        // Create animator with TweenMax-style enhanced timing
        animatorRef.current = ScrollingTextAnimator.create({
          container,
          textElement,
          text: currentText,
          pauseDuration: enhancedPauseDuration,
          scrollDuration: enhancedScrollDuration,
          easing: enhancedEasing
        });
        
        console.log('🎬 Started enhanced TweenMax animation for text:', currentText);
        
        // Add scroll detection
        const handleScroll = () => {
          if (animatorRef.current) {
            animatorRef.current.handleScrollStart();
          }
        };
        
        // Listen to both window and document scroll events
        window.addEventListener('scroll', handleScroll, { passive: true });
        document.addEventListener('scroll', handleScroll, { passive: true });
        
        // Also listen to scroll events on scrollable parents
        let parent = container.parentElement;
        while (parent) {
          if (parent.scrollHeight > parent.clientHeight || parent.scrollWidth > parent.clientWidth) {
            parent.addEventListener('scroll', handleScroll, { passive: true });
          }
          parent = parent.parentElement;
        }
        
        scrollListenerRef.current = handleScroll;
      } else {
        setNeedsScrolling(false);
        console.log('✅ Text fits in container, no animation needed');
      }
    };

    // Initial check
    checkAndAnimate();
    
    // Recheck on window resize
    const handleResize = () => {
      setTimeout(checkAndAnimate, 100);
    };
    
    window.addEventListener('resize', handleResize);
    
    // Recheck when content changes
    const observer = new MutationObserver(() => {
      setTimeout(checkAndAnimate, 50);
    });
    
    if (containerRef.current) {
      observer.observe(containerRef.current, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }
    
    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
      
      // Clean up scroll listener
      if (scrollListenerRef.current) {
        window.removeEventListener('scroll', scrollListenerRef.current, { passive: true } as any);
        document.removeEventListener('scroll', scrollListenerRef.current, { passive: true } as any);
        scrollListenerRef.current = null;
      }
      
      if (animatorRef.current) {
        animatorRef.current.stop();
        animatorRef.current = null;
      }
    };
  }, [text, children, pauseDuration, scrollDuration, easing]);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      // Clean up scroll listener on unmount
      if (scrollListenerRef.current) {
        window.removeEventListener('scroll', scrollListenerRef.current, { passive: true } as any);
        document.removeEventListener('scroll', scrollListenerRef.current, { passive: true } as any);
        scrollListenerRef.current = null;
      }
      
      if (animatorRef.current) {
        animatorRef.current.stop();
        animatorRef.current = null;
      }
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className={`w-full ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '100%',
        overflow: 'hidden' // Contain text within parent boundaries
      }
      }
    >
      <div 
        ref={textRef}
        className="whitespace-nowrap"
        style={{
          display: 'inline-block',
          minWidth: '100%',
          maxWidth: 'none',
          overflow: 'hidden' // Prevent text from escaping container
        }
        }
      >
        {children || text}
      </div>
    </div>
  );
};