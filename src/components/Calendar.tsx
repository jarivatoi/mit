import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Calculator, Edit3, TrendingUp, Trash2, AlertTriangle, X } from 'lucide-react';
import { gsap } from 'gsap';
import { SHIFTS } from '../constants';
import { DaySchedule, SpecialDates } from '../types';
import { ClearDateModal } from './ClearDateModal';
import { DeleteMonthModal } from './DeleteMonthModal';
import { MonthClearModal } from './MonthClearModal';
import { formatMauritianRupees } from '../utils/currency';
import { useLongPress } from '../hooks/useLongPress';

interface CalendarProps {
  currentDate: Date;
  schedule: DaySchedule;
  specialDates: SpecialDates;
  settings: any; // Add settings prop to access custom shifts
  onDateClick: (day: number) => void;
  onNavigateMonth: (direction: 'prev' | 'next') => void;
  totalAmount: number;
  monthToDateAmount: number;
  onDateChange: (date: Date) => void;
  scheduleTitle: string;
  onTitleUpdate: (title: string) => void;
  onResetMonth?: (year: number, month: number) => void;
  setSchedule: React.Dispatch<React.SetStateAction<DaySchedule>>;
  setSpecialDates: React.Dispatch<React.SetStateAction<SpecialDates>>;
}

export const Calendar: React.FC<CalendarProps> = ({
  currentDate,
  schedule,
  specialDates,
  settings,
  onDateClick,
  onNavigateMonth,
  totalAmount,
  monthToDateAmount,
  onDateChange,
  scheduleTitle,
  onTitleUpdate,
  setSchedule,
  setSpecialDates
}) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(scheduleTitle);
  const [showClearDateModal, setShowClearDateModal] = useState(false);
  const [showClearMonthModal, setShowClearMonthModal] = useState(false);
  const [showMonthClearModal, setShowMonthClearModal] = useState(false);
  const [dateToDelete, setDateToDelete] = useState<string | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [isLongPressActive, setIsLongPressActive] = useState(false);
  const calendarGridRef = useRef<HTMLDivElement>(null);
  
  const today = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
  const firstDayWeekday = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Prevent body scroll when date picker modal is open - EXACTLY LIKE OTHER MODALS
  useEffect(() => {
    if (showDatePicker) {
      // Disable body scroll
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = '0';
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.bottom = '0';
    }

    return () => {
      // Re-enable body scroll
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.bottom = '';
    };
  }, [showDatePicker]);

  // Mobile-optimized sequential animation - smoother for iOS
  useEffect(() => {
    if (calendarGridRef.current) {
      // Get all day boxes and sort them by day number for sequential animation
      const dayBoxes = Array.from(calendarGridRef.current.querySelectorAll('.day-box'))
        .filter(box => box.getAttribute('data-day') !== null)
        .sort((a, b) => {
          const dayA = parseInt(a.getAttribute('data-day') || '0');
          const dayB = parseInt(b.getAttribute('data-day') || '0');
          return dayA - dayB;
        });
      
      // Force hardware acceleration and set initial state - iOS optimized
      gsap.set(dayBoxes, {
        opacity: 0,
        x: 80,  // Reduced distance for smoother mobile performance
        scale: 0.9,
        force3D: true,  // Force hardware acceleration
        transformOrigin: "center center"
      });

      // Set initial state for shift texts - optimized for mobile
      const shiftTexts = calendarGridRef.current.querySelectorAll('.shift-text');
      gsap.set(shiftTexts, {
        opacity: 0,
        y: 8,   // Reduced movement for smoother animation
        scale: 0.8,
        force3D: true
      });

      // Set initial state for special text
      const specialTexts = calendarGridRef.current.querySelectorAll('.special-text');
      gsap.set(specialTexts, {
        opacity: 0,
        scale: 0.7,
        y: -8,
        force3D: true
      });

      // Create master timeline with mobile-optimized settings
      const masterTl = gsap.timeline({
        defaults: {
          ease: "power2.out",  // Smoother easing for mobile
          force3D: true
        }
      });

      // Phase 1: Animate boxes sequentially - optimized timing for mobile
      dayBoxes.forEach((box, index) => {
        const dayNumber = parseInt(box.getAttribute('data-day') || '0');
        const shiftElements = box.querySelectorAll('.shift-text');
        const specialElements = box.querySelectorAll('.special-text');
        
        // Faster sequence for mobile - reduced delay
        const delay = (dayNumber - 1) * 0.05; // 50ms between each day (faster)
        
        // Animate the box - smoother for mobile
        masterTl.to(box, {
          opacity: 1,
          x: 0,
          scale: 1,
          duration: 0.4,  // Shorter duration
          ease: "power2.out",  // Simpler easing
          force3D: true
        }, delay);

        // Animate shift texts - simplified for mobile
        if (shiftElements.length > 0) {
          masterTl.to(shiftElements, {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.3,
            ease: "power1.out",  // Gentler easing
            stagger: 0.03,  // Faster stagger
            force3D: true
          }, delay + 0.15);
        }

        // Animate special text - simplified
        if (specialElements.length > 0) {
          masterTl.to(specialElements, {
            opacity: 1,
            scale: 1,
            y: 0,
            duration: 0.25,
            ease: "power1.out",
            force3D: true
          }, delay + 0.2);
        }
      });
    }
  }, [currentMonth, currentYear]);

  // Close modal on escape key - EXACTLY LIKE SHIFT MODAL
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowDatePicker(false);
      }
    };

    if (showDatePicker) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [showDatePicker]);

  // Close date picker when clicking outside - EXACTLY LIKE OTHER MODALS
  const handleDatePickerBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setShowDatePicker(false);
    }
  };

  const formatDateKey = (day: number) => {
    return `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  };

  const isToday = (day: number) => {
    return today.getDate() === day && 
           today.getMonth() === currentMonth && 
           today.getFullYear() === currentYear;
  };

  const isPastDate = (day: number) => {
    const dateToCheck = new Date(currentYear, currentMonth, day);
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return dateToCheck < todayDate;
  };

  const getDayOfWeek = (day: number) => {
    const date = new Date(currentYear, currentMonth, day);
    return date.getDay(); // 0 = Sunday, 6 = Saturday
  };

  const isSunday = (day: number) => {
    return getDayOfWeek(day) === 0;
  };

  const isSpecialDate = (day: number) => {
    const dateKey = formatDateKey(day);
    return specialDates[dateKey] === true;
  };

  const getDayShifts = (day: number) => {
    const dateKey = formatDateKey(day);
    const shifts = schedule[dateKey] || [];
    
    // Sort shifts in the desired display order: 9-4, 4-10, 12-10, N
    const shiftOrder = ['9-4', '4-10', '12-10', 'N'];
    return shifts.sort((a, b) => {
      const indexA = shiftOrder.indexOf(a);
      const indexB = shiftOrder.indexOf(b);
      
      // If shift not found in order array, put it at the end
      const orderA = indexA === -1 ? 999 : indexA;
      const orderB = indexB === -1 ? 999 : indexB;
      
      return orderA - orderB;
    });
  };

  const getShiftDisplay = (shiftId: string) => {
    // First check if it's a predefined shift
    const predefinedShift = SHIFTS.find(shift => shift.id === shiftId);
    if (predefinedShift) {
      return predefinedShift;
    }
    
    // Then check if it's a custom shift
    const customShift = settings?.customShifts?.find(shift => shift.id === shiftId);
    if (customShift) {
      return {
        id: customShift.id,
        label: customShift.label,
        time: customShift.label,
        color: 'bg-purple-100 text-purple-800 border-purple-200',
        displayColor: 'text-purple-600'
      };
    }
    
    return null;
  };

  const getDateTextColor = (day: number) => {
    if (isToday(day)) {
      return 'text-green-700 font-bold'; // Current date in green
    } else if (isSunday(day) || isSpecialDate(day)) {
      return 'text-red-600 font-bold'; // Sunday and special dates in red
    } else {
      return 'text-gray-900'; // Regular dates
    }
  };

  const formatCurrency = (amount: number) => {
    const result = formatMauritianRupees(amount);
    return result.formatted;
  };

  // Calculate month statistics for the modal
  const getMonthStatistics = () => {
    let totalShifts = 0;
    let totalAmount = 0;
    
    Object.entries(schedule).forEach(([dateKey, dayShifts]) => {
      const workDate = new Date(dateKey);
      if (workDate.getMonth() === currentMonth && workDate.getFullYear() === currentYear) {
        totalShifts += dayShifts.length;
      }
    });
    
    return {
      month: currentMonth,
      year: currentYear,
      totalShifts,
      totalAmount: totalAmount
    };
  };

  // Long-press handlers for month header
  const longPressHandlers = useLongPress({
    onLongPress: () => {
      setIsLongPressActive(true);
      // Only show modal if month has data to clear
      if (hasMonthData()) {
        setShowMonthClearModal(true);
      }
      // Reset flag after a delay
      setTimeout(() => setIsLongPressActive(false), 500);
    },
    onPress: () => {
      // Only trigger single press if long press wasn't active
      if (!isLongPressActive) {
        setTimeout(() => {
          if (!isLongPressActive) {
            setShowDatePicker(true);
          }
        }, 50);
      }
    },
    delay: 500
  });

  // Fallback click handler for Android devices
  const handleMonthYearFallbackClick = (e: React.MouseEvent) => {
    // Only handle if it's a mouse click (not touch) and no long press is active
    if (e.type === 'click' && !isLongPressActive) {
      setTimeout(() => {
        if (!isLongPressActive && !showDatePicker) {
          setShowDatePicker(true);
        }
      }, 100);
    }
  };

  // Check if current month has any data (shifts or special dates)
  const hasMonthData = () => {
    // Check for shifts in current month
    const hasShifts = Object.entries(schedule).some(([dateKey, dayShifts]) => {
      const workDate = new Date(dateKey);
      return workDate.getMonth() === currentMonth && 
             workDate.getFullYear() === currentYear && 
             dayShifts.length > 0 && 
             dayShifts.some(shiftId => shiftId.trim() !== '');
    });
    
    // Check for special dates in current month
    const hasSpecialDates = Object.entries(specialDates).some(([dateKey, isSpecial]) => {
      const workDate = new Date(dateKey);
      return workDate.getMonth() === currentMonth && 
             workDate.getFullYear() === currentYear && 
             isSpecial === true;
    });
    
    return hasShifts || hasSpecialDates;
  };

  const handleMonthYearClick = () => {
    setShowDatePicker(true);
  };

  const handleDatePickerChange = (year: number, month: number) => {
    onDateChange(new Date(year, month, 1));
    setShowDatePicker(false);
  };

  const handleTitleClick = () => {
    setIsEditingTitle(true);
    setTempTitle(scheduleTitle);
  };

  const handleTitleSave = () => {
    onTitleUpdate(tempTitle.trim() || 'Work Schedule');
    setIsEditingTitle(false);
  };

  const handleTitleCancel = () => {
    setTempTitle(scheduleTitle);
    setIsEditingTitle(false);
  };

  const handleTitleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      handleTitleCancel();
    }
  };

  const handleDateClick = (day: number) => {
    // Simplified click animation for mobile - no complex transforms
    const clickedElement = document.querySelector(`[data-day="${day}"]`);
    
    if (clickedElement) {
      // Simple, smooth scale animation
      gsap.to(clickedElement, {
        scale: 0.95,
        duration: 0.1,
        ease: "power2.out",
        force3D: true,
        yoyo: true,
        repeat: 1,
        onComplete: () => {
          gsap.set(clickedElement, { scale: 1 });
        }
      });
    }
    onDateClick(day);
  };

  // Long press handlers for date clearing
  const handleDateLongPressStart = (day: number, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const dateKey = formatDateKey(day);
    
    // Check if date has content before showing modal
    const hasShifts = schedule[dateKey] && schedule[dateKey].length > 0;
    const isSpecial = specialDates[dateKey] === true;
    const hasContent = hasShifts || isSpecial;
    
    // Only show modal if date has content to clear
    if (!hasContent) {
      return;
    }
    
    const timer = setTimeout(() => {
      setDateToDelete(dateKey);
      setShowClearDateModal(true);
      setLongPressTimer(null);
    }, 800); // 800ms long press
    
    setLongPressTimer(timer);
  };

  const handleDateLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  // Clear date function
  const handleClearDate = async (dateKey: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        // Clear schedule data for this specific date
        setSchedule(prev => {
          const newSchedule = { ...prev };
          delete newSchedule[dateKey];
          return newSchedule;
        });
        
        // Clear special date marking for this specific date
        setSpecialDates(prev => {
          const newSpecialDates = { ...prev };
          delete newSpecialDates[dateKey];
          return newSpecialDates;
        });
        
        console.log(`✅ Successfully cleared date ${dateKey}`);
        resolve();
      } catch (error) {
        console.error(`❌ Error clearing date ${dateKey}:`, error);
        reject(error);
      }
    });
  };

  // Clear month function
  const handleClearMonth = async (year: number, month: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        // Create date keys for the entire month
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const monthDateKeys: string[] = [];
        
        for (let day = 1; day <= daysInMonth; day++) {
          const dateKey = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
          monthDateKeys.push(dateKey);
        }
        
        // Clear schedule data for the month
        setSchedule(prev => {
          const newSchedule = { ...prev };
          monthDateKeys.forEach(dateKey => {
            delete newSchedule[dateKey];
          });
          return newSchedule;
        });
        
        // Clear special dates for the month
        setSpecialDates(prev => {
          const newSpecialDates = { ...prev };
          monthDateKeys.forEach(dateKey => {
            delete newSpecialDates[dateKey];
          });
          return newSpecialDates;
        });
        
        console.log(`✅ Successfully cleared month ${month + 1}/${year}`);
        resolve();
      } catch (error) {
        console.error(`❌ Error clearing month ${month + 1}/${year}:`, error);
        reject(error);
      }
    });
  };

  const handleMonthNavigation = (direction: 'prev' | 'next') => {
    // Simplified month navigation for mobile
    if (calendarGridRef.current) {
      const slideDirection = direction === 'next' ? 30 : -30;
      
      gsap.to(calendarGridRef.current, {
        x: slideDirection,
        opacity: 0.5,
        duration: 0.2,
        ease: "power2.out",
        force3D: true,
        onComplete: () => {
          onNavigateMonth(direction);
          gsap.set(calendarGridRef.current, { 
            x: direction === 'next' ? -30 : 30
          });
          gsap.to(calendarGridRef.current, {
            x: 0,
            opacity: 1,
            duration: 0.3,
            ease: "power2.out",
            force3D: true
          });
        }
      });
    } else {
      onNavigateMonth(direction);
    }
  };

  // Check if current month/year matches today's month/year for month-to-date display
  const isCurrentMonth = today.getMonth() === currentMonth && today.getFullYear() === currentYear;

  // Generate calendar days
  const calendarDays = [];
  
  // Empty cells for days before the first day of the month
  for (let i = 0; i < firstDayWeekday; i++) {
    calendarDays.push(null);
  }
  
  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  // Calculate number of rows needed
  const totalCells = calendarDays.length;
  const numberOfRows = Math.ceil(totalCells / 7);

  // Calculate dynamic row heights based on content
  const calculateRowHeights = () => {
    const rowHeights: string[] = [];
    
    for (let row = 0; row < numberOfRows; row++) {
      let maxContentLines = 0;
      
      // Check each day in this row (7 days per row)
      for (let col = 0; col < 7; col++) {
        const dayIndex = row * 7 + col;
        if (dayIndex < calendarDays.length) {
          const day = calendarDays[dayIndex];
          if (day) {
            const dayShifts = getDayShifts(day);
            const hasSpecial = isSpecialDate(day);
            
            // Count content lines: shifts + special text (if present)
            // Maximum possible: SPECIAL (1 line) + 3 shifts (3 lines) = 4 total
            let contentLines = dayShifts.length;
            if (hasSpecial) contentLines += 1; // Add 1 line for "SPECIAL" text
            
            // Cap at maximum possible content (should never exceed 4)
            contentLines = Math.min(contentLines, 4);
            
            maxContentLines = Math.max(maxContentLines, contentLines);
          }
        }
      }
      
      // Calculate height based on maximum content lines in the row
      const baseHeight = window.innerWidth >= 640 ? 60 : 50; // Base height for date number
      const lineHeight = window.innerWidth >= 640 ? 16 : 12; // Reduced height per content line
      const padding = window.innerWidth >= 640 ? 16 : 12; // Top/bottom padding
      
      const calculatedHeight = baseHeight + (maxContentLines * lineHeight) + padding;
      const minHeight = window.innerWidth >= 640 ? 70 : 55; // Reduced minimum height
      
      const finalHeight = Math.max(calculatedHeight, minHeight);
      rowHeights.push(`${finalHeight}px`);
    }
    
    return rowHeights;
  };

  const rowHeights = calculateRowHeights();

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden select-none max-w-4xl mx-auto" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-gray-200">
        <div className="flex items-center justify-center space-x-3 mb-4">
          <CalendarIcon className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-600" />
          {isEditingTitle ? (
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onKeyDown={handleTitleKeyPress}
                onBlur={handleTitleSave}
                className="text-xl sm:text-3xl font-bold text-gray-900 text-center bg-transparent border-b-2 border-indigo-500 focus:outline-none min-w-[250px] sm:min-w-[300px]"
                autoFocus
              />
            </div>
          ) : (
            <button
              onClick={handleTitleClick}
              className="flex items-center space-x-2 text-xl sm:text-3xl font-bold text-gray-900 text-center hover:text-indigo-600 transition-colors duration-200 group select-none"
              style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
            >
              <span className="select-none">{scheduleTitle}</span>
              <Edit3 className="w-4 h-4 sm:w-5 sm:h-5 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            </button>
          )}
        </div>
        
        {/* Month/Year Navigation */}
        <div className="flex items-center justify-center space-x-3 sm:space-x-4">
          <button
            onClick={() => handleMonthNavigation('prev')}
            className="w-10 h-10 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-600 transition-colors duration-200 active:scale-95 select-none"
            style={{ 
              userSelect: 'none', 
              WebkitUserSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0',
              margin: '0',
              border: 'none',
              outline: 'none'
            }}
          >
            <ChevronLeft 
              className="w-5 h-5" 
              style={{
                display: 'block',
                margin: '0 auto'
              }}
            />
          </button>
          
          {/* Month/Year Button */}
          <div className="flex-1 flex justify-center">
            <button
              {...longPressHandlers}
              onClick={handleMonthYearFallbackClick}
             className="text-lg sm:text-xl font-bold text-gray-900 select-none"
              style={{ 
                userSelect: 'none', 
                WebkitUserSelect: 'none',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              <span className="select-none">{monthNames[currentMonth]} {currentYear}</span>
            </button>
          </div>
          
          <button
            onClick={() => handleMonthNavigation('next')}
            className="w-10 h-10 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-600 transition-colors duration-200 active:scale-95 select-none"
            style={{ 
              userSelect: 'none', 
              WebkitUserSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0',
              margin: '0',
              border: 'none',
              outline: 'none'
            }}
          >
            <ChevronRight 
              className="w-5 h-5" 
              style={{
                display: 'block',
                margin: '0 auto'
              }}
            />
          </button>
        </div>
      </div>

      {/* Date Picker Modal - NOW CENTERED VERTICALLY LIKE OTHER MODALS */}
      {showDatePicker && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={(e) => {
            console.log('📱 Backdrop clicked');
            handleDatePickerBackdropClick(e);
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            pointerEvents: 'auto',
            // CRITICAL: Enable touch scrolling on the backdrop
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y' // Allow vertical panning (scrolling)
          }}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full select-none" 
            style={{ 
              userSelect: 'none', 
              WebkitUserSelect: 'none'
            }}
            onClick={(e) => {
              console.log('📱 Modal content clicked - preventing close');
              // Prevent modal from closing when clicking inside
              e.stopPropagation();
            }}
          >
            {/* Header with close button */}
            <div className="relative p-6 pb-4 border-b border-gray-200">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('📱 Close button clicked');
                  setShowDatePicker(false);
                }}
                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors duration-200 select-none"
                style={{ 
                  userSelect: 'none', 
                  WebkitUserSelect: 'none',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent'
                }}
              >
                <X className="w-5 h-5" />
              </button>
              
              {/* Title - centered */}
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900 mb-1 select-none">
                  Select Month & Year
                </h3>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 text-center select-none">Year</label>
                  <select
                    value={currentYear}
                    onChange={(e) => handleDatePickerChange(Number(e.target.value), currentMonth)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center transition-colors duration-200"
                  >
                    {Array.from({ length: 10 }, (_, i) => currentYear - 5 + i).map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 text-center select-none">Month</label>
                  <select
                    value={currentMonth}
                    onChange={(e) => handleDatePickerChange(currentYear, Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center transition-colors duration-200"
                  >
                    {monthNames.map((month, index) => (
                      <option key={index} value={index}>{month}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('📱 Close modal button clicked');
                  setShowDatePicker(false);
                }}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors duration-200 active:scale-95 select-none"
                style={{ 
                  userSelect: 'none', 
                  WebkitUserSelect: 'none',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent'
                }}
              >
                <span className="select-none">Close</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Body */}
      <div className="p-3 sm:p-6">
        {/* Week day headers */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-3 sm:mb-4">
          {weekDays.map((day, index) => (
            <div key={day} className={`p-2 sm:p-3 text-center font-semibold text-xs sm:text-sm select-none ${
              index === 0 ? 'text-red-600' : 'text-gray-600'
            }`} style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid - MOBILE OPTIMIZED ANIMATIONS */}
        <div 
          ref={calendarGridRef} 
          className="mb-4 sm:mb-6 select-none w-full mx-auto"
          style={{
            transform: 'translate3d(0,0,0)', // Force hardware acceleration
            backfaceVisibility: 'hidden',     // Prevent flickering
            userSelect: 'none',
            WebkitUserSelect: 'none',
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: window.innerWidth >= 640 ? '8px' : '4px',
            // Center the grid in portrait mode
            justifyContent: 'center',
            alignContent: 'start',
            maxWidth: '100%',
            margin: '0 auto'
          }}
        >
          {calendarDays.map((day, index) => {
            const rowIndex = Math.floor(index / 7);
            const dayShifts = day ? getDayShifts(day) : [];
            const hasSpecialDate = day ? isSpecialDate(day) : false;
            const todayDate = day ? isToday(day) : false;
            const pastDate = day ? isPastDate(day) : false;

            return (
              <div
                key={index}
                data-day={day}
                className={`day-box p-1 sm:p-2 rounded-lg border-2 transition-colors duration-200 overflow-hidden relative select-none ${
                  day 
                    ? todayDate
                      ? `cursor-pointer border-indigo-400 shadow-lg bg-yellow-100 hover:bg-yellow-200 active:bg-yellow-200` // TODAY: Permanent hover state
                      : `cursor-pointer hover:border-indigo-400 hover:shadow-lg bg-yellow-50 border-yellow-200 hover:bg-yellow-100 active:bg-yellow-200`
                    : 'border-transparent'
                }`}
                style={{
                  height: rowHeights[rowIndex], // All cells in same row have same height
                  transform: 'translate3d(0,0,0)',
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  WebkitTransform: 'translate3d(0,0,0)',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  display: 'flex',
                  flexDirection: 'column'
                }}
                onClick={() => day && handleDateClick(day)}
                onMouseDown={(e) => day && handleDateLongPressStart(day, e)}
                onMouseUp={handleDateLongPressEnd}
                onMouseLeave={handleDateLongPressEnd}
                onTouchStart={(e) => day && handleDateLongPressStart(day, e)}
                onTouchEnd={handleDateLongPressEnd}
              >
                {day && (
                  <div className="flex flex-col select-none h-full">
                    {/* BIG X WATERMARK for past dates */}
                    {pastDate && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                        <div className="text-gray-300 text-4xl sm:text-5xl font-bold opacity-30 select-none">
                          ✕
                        </div>
                      </div>
                    )}
                    
                    {/* Date header with special indicator and TODAY CIRCLE */}
                    <div className={`flex-shrink-0 mb-1.5 sm:mb-2 relative ${pastDate ? 'z-30' : ''}`}>
                      <div className={`text-sm sm:text-base text-center font-semibold ${getDateTextColor(day)} relative select-none`}>
                        {/* TODAY CIRCLE - PERFECT SIZE FOR 2-DIGIT DATES */}
                        {todayDate && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div 
                              className="w-6 h-6 sm:w-7 sm:h-7 border-2 border-green-500 rounded-full animate-pulse"
                              style={{
                                boxShadow: '0 0 0 1px rgba(34, 197, 94, 0.2), 0 0 10px rgba(34, 197, 94, 0.3)',
                                animation: 'todayPulse 2s ease-in-out infinite'
                              }}
                            />
                          </div>
                        )}
                        <span className="relative z-10 select-none">{day}</span>
                        
                        {/* TICK INDICATOR for dates with shifts */}
                        {dayShifts.length > 0 && dayShifts.some(shiftId => shiftId.trim() !== '') && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-green-500 rounded-full flex items-center justify-center">
                            <svg 
                              className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-white" 
                              fill="currentColor" 
                              viewBox="0 0 20 20"
                            >
                              <path 
                                fillRule="evenodd" 
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
                                clipRule="evenodd" 
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Content container - grows to fill available space */}
                    <div className={`flex flex-col items-center justify-start space-y-0.5 sm:space-y-1 px-0.5 select-none min-w-0 flex-1 ${pastDate ? 'z-30' : ''}`}>
                      {/* Special date indicator */}
                      {hasSpecialDate && (
                        <div 
                          className="special-text text-[8px] sm:text-[9px] text-red-500 font-bold leading-none mt-0.5 flex justify-center select-none"
                          style={{
                            transform: 'translate3d(0,0,0)',
                            backfaceVisibility: 'hidden',
                            userSelect: 'none',
                            WebkitUserSelect: 'none'
                          }}
                        >
                          <div className="text-center select-none">SPECIAL</div>
                        </div>
                      )}
                      
                      {/* All shifts displayed with labels */}
                      {dayShifts.map((shiftId, idx) => {
                        const shift = getShiftDisplay(shiftId);
                        return shift ? (
                          <div
                            key={`${shiftId}-${idx}`}
                            className={`shift-text text-[8px] sm:text-[11px] font-bold leading-tight text-black flex-shrink-0 w-full select-none whitespace-nowrap overflow-hidden ${pastDate ? 'opacity-50' : ''}`}
                            style={{
                              transform: 'translate3d(0,0,0)',
                              backfaceVisibility: 'hidden',
                              WebkitBackfaceVisibility: 'hidden',
                              WebkitTransform: 'translate3d(0,0,0)',
                              userSelect: 'none',
                              WebkitUserSelect: 'none'
                            }}
                          >
                            <div className="text-center select-none truncate px-0.5">{shift.time}</div>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Amount Display Section - NO ANIMATION */}
        <div 
          className={`space-y-3 sm:space-y-4 select-none ${isCurrentMonth ? 'mt-4 sm:mt-6' : 'mt-4 sm:mt-6'}`}
          style={{ 
            userSelect: 'none', 
            WebkitUserSelect: 'none',
            // FIXED: Dynamic padding based on content
            paddingBottom: isCurrentMonth ? '30px' : '20px', // Extra padding when Month-to-Date is shown
            marginBottom: '10px'
          }}
        >
          {/* Month to Date Total - Only show if viewing current month */}
          {isCurrentMonth && (
            <div 
              className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4 mb-4"
              style={{
                // FIXED: Ensure proper touch scrolling
                WebkitOverflowScrolling: 'touch',
                touchAction: 'pan-y'
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                  <span className="text-base sm:text-lg font-semibold text-green-800 select-none">Month to Date</span>
                </div>
                <span className="text-lg sm:text-2xl font-bold text-green-900 select-none">
                  {formatCurrency(monthToDateAmount)}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-green-600 mt-2 text-center select-none">
                Amount earned from start of month to today ({today.getDate()}/{currentMonth + 1}/{currentYear})
              </p>
            </div>
          )}

          {/* Monthly Total */}
          <div 
            className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 sm:p-4"
            style={{
              // FIXED: Ensure proper touch scrolling
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y'
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Calculator className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                <span className="text-base sm:text-lg font-semibold text-indigo-800 select-none">Monthly Total</span>
              </div>
              <span className="text-lg sm:text-2xl font-bold text-indigo-900 select-none">
                {formatCurrency(totalAmount)}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-indigo-600 mt-2 text-center select-none">
              Total amount for all scheduled shifts in {monthNames[currentMonth]} {currentYear}
            </p>
          </div>
        </div>
      </div>

      {/* Clear Date Modal */}
      <ClearDateModal
        isOpen={showClearDateModal}
        selectedDate={dateToDelete}
        schedule={schedule}
        specialDates={specialDates}
        onConfirm={handleClearDate}
        onCancel={() => {
          setShowClearDateModal(false);
          setDateToDelete(null);
        }}
      />

      {/* Clear Month Modal */}
      <DeleteMonthModal
        isOpen={showClearMonthModal}
        month={currentMonth}
        year={currentYear}
        onConfirm={async () => {
          await handleClearMonth(currentYear, currentMonth);
          setShowClearMonthModal(false);
        }}
        onClose={() => setShowClearMonthModal(false)}
      />

      {/* Month Clear Modal (Long-press triggered) */}
      <MonthClearModal
        isOpen={showMonthClearModal}
        monthData={getMonthStatistics()}
        onConfirm={handleClearMonth}
        onCancel={() => setShowMonthClearModal(false)}
      />

      {/* Custom CSS for today's circle animation */}
      <style jsx>{`
        @keyframes todayPulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.8;
          }
        }
      `}</style>
    </div>
  );
};
