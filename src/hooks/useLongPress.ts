import { useCallback, useRef } from 'react';

interface LongPressOptions {
  onLongPress: () => void;
  onPress?: () => void;
  onDoublePress?: () => void;
  delay?: number;
}

interface LongPressHandlers {
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onTouchCancel: () => void;
  onClick: (e: React.MouseEvent) => void;
}

/**
 * Custom hook for handling long-press interactions
 * @param options - Configuration options for long-press behavior
 * @returns Event handlers for mouse and touch events
 */
export const useLongPress = ({
  onLongPress,
  onPress,
  onDoublePress,
  delay = 1000
}: LongPressOptions): LongPressHandlers => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);
  const isMouseDownRef = useRef(false);
  const isTouchStartRef = useRef(false);
  const clickCountRef = useRef(0);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startLongPress = useCallback(() => {
    isLongPressRef.current = false;
    
    timeoutRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      console.log('🔥 Long press triggered!');
      onLongPress();
    }, delay);
  }, [onLongPress, delay]);

  const cancelLongPress = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    isMouseDownRef.current = false;
    isTouchStartRef.current = false;
  }, []);

  const handlePress = useCallback(() => {
    if (!isLongPressRef.current && onPress) {
      console.log('👆 Short press triggered!');
      onPress();
    }
    isLongPressRef.current = false;
    isMouseDownRef.current = false;
    isTouchStartRef.current = false;
  }, [onPress]);

  const handleDoubleClick = useCallback(() => {
    clickCountRef.current++;
    
    if (clickCountRef.current === 1) {
      clickTimeoutRef.current = setTimeout(() => {
        clickCountRef.current = 0;
      }, 300); // 300ms window for double click
    } else if (clickCountRef.current === 2) {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
      clickCountRef.current = 0;
      console.log('👆👆 Double click triggered!');
      if (onDoublePress) {
        onDoublePress();
      }
    }
  }, [onDoublePress]);
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (isTouchStartRef.current) return; // Prevent duplicate if touch already started
    console.log('🖱️ Mouse down - starting long press timer');
    isMouseDownRef.current = true;
    startLongPress();
  }, [startLongPress]);

  const onMouseUp = useCallback(() => {
    if (!isMouseDownRef.current) return;
    console.log('🖱️ Mouse up');
    cancelLongPress();
    handlePress();
  }, [cancelLongPress, handlePress]);

  const onMouseLeave = useCallback(() => {
    if (!isMouseDownRef.current) return;
    console.log('🖱️ Mouse leave - canceling');
    cancelLongPress();
  }, [cancelLongPress]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isMouseDownRef.current) return; // Prevent duplicate if mouse already started
    console.log('📱 Touch start - starting long press timer');
    isTouchStartRef.current = true;
    startLongPress();
  }, [startLongPress]);

  const onTouchEnd = useCallback(() => {
    if (!isTouchStartRef.current) return;
    console.log('📱 Touch end');
    cancelLongPress();
    handlePress();
  }, [cancelLongPress, handlePress]);

  const onTouchCancel = useCallback(() => {
    if (!isTouchStartRef.current) return;
    console.log('📱 Touch cancel');
    cancelLongPress();
  }, [cancelLongPress]);

  const onClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLongPressRef.current) {
      handleDoubleClick();
    }
  }, [handleDoubleClick]);
  return {
    onMouseDown,
    onMouseUp,
    onMouseLeave,
    onTouchStart,
    onTouchEnd,
    onTouchCancel,
    onClick
  };
};