import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar } from './components/Calendar';
import { ShiftModal } from './components/ShiftModal';
import { SettingsPanel } from './components/SettingsPanel';
import { MenuPanel } from './components/MenuPanel';
import TabNavigation from './components/TabNavigation';
import { useScheduleCalculations } from './hooks/useScheduleCalculations';
import { useIndexedDB, useScheduleData } from './hooks/useIndexedDB';
import { DEFAULT_SHIFT_COMBINATIONS } from './constants';
import { AddToHomescreen } from './utils/addToHomescreen';
import { Settings } from './types';
import { gsap } from 'gsap';
import StaffOnboard from './components/StaffOnboard';
import StaffLogin from './components/StaffLogin';
import ProfileTab from './components/ProfileTab';
import { saveUserSession, getUserSession, removeUserSession, saveLastUsedIdNumber, getLastUsedIdNumber, workScheduleDB } from './utils/indexedDB';

type UserSession = { userId: string; idNumber: string; surname?: string; name?: string; isAdmin: boolean } | null
type UserProfile = { id: string; idNumber: string; surname: string; name: string; isAdmin: boolean } | null

// Root app orchestrator: onboarding -> login -> main UI
const App: React.FC = () => {
  const [phase, setPhase] = useState<'onboard'|'login'|'main'|null>(null)
  const [user, setUser] = useState<UserSession>(null)

  // Initialize phase on load
  useEffect(() => {
    // Always start with login screen - no session persistence
    setPhase('login');
  }, [])

  // Show nothing while initializing (prevents flash of wrong screen)
  if (phase === null) {
    return null;
  }

  const onOnboardComplete = async (userData: { id?: string; idNumber?: string; surname?: string; name?: string; isAdmin?: boolean }) => {
    // Store the user's ID Number for auto-fill on next login
    if (userData?.idNumber) {
      await saveLastUsedIdNumber(userData.idNumber);
    }
    // After successful registration, redirect to login screen
    // User must manually login with their credentials
    setPhase('login');
  }

  const onLoginSuccess = async (sess: { userId: string; idNumber: string; isAdmin: boolean; surname?: string; name?: string }) => {
    // Don't save session - require login on every refresh
    setUser({ 
      userId: sess.userId, 
      idNumber: sess.idNumber, 
      isAdmin: !!sess.isAdmin,
      surname: sess.surname,
      name: sess.name
    });
    setPhase('main');
  }

  if (phase === 'onboard') {
    return <StaffOnboard onComplete={onOnboardComplete} onBack={() => setPhase('login')} />
  }
  if (phase === 'login') {
    return <StaffLogin onLoginSuccess={onLoginSuccess} onRegister={() => setPhase('onboard')} showIdField={true} />
  }

  // Main app after authentication
  return <AuthenticatedApp user={user} onLoginSuccess={onLoginSuccess} />;
}

// Component for authenticated users
const AuthenticatedApp: React.FC<{ user: UserSession, onLoginSuccess: (sess: { userId: string; idNumber: string; isAdmin: boolean }) => void }> = ({ user, onLoginSuccess }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'calendar' | 'settings' | 'data' | 'profile'>('calendar');
  
  // Add artificial loading delay for better UX
  const [artificialLoading, setArtificialLoading] = useState(true);
  const [smoothProgress, setSmoothProgress] = useState(0);
  const [showMainApp, setShowMainApp] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Use IndexedDB hooks
  const { schedule, specialDates, setSchedule, setSpecialDates } = useScheduleData();
  const [dateNotes, setDateNotes] = useIndexedDB<Record<string, string>>('dateNotes', {});
  const [scheduleTitle, setScheduleTitle] = useIndexedDB<string>('scheduleTitle', 'Work Schedule', 'metadata');
  const [settings, setSettings] = useIndexedDB<Settings & { useManualMode?: boolean }>('workSettings', {
    basicSalary: 35000,
    hourlyRate: 201.92,
    shiftCombinations: DEFAULT_SHIFT_COMBINATIONS,
    useManualMode: false // Add manual mode flag to settings
  });
  
  // Add refreshKey state
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Force save on page close/refresh for Android reliability
  useEffect(() => {
    const handleBeforeUnload = async (e: BeforeUnloadEvent) => {
      // Modern browsers ignore custom messages but still trigger the event
      e.preventDefault();
      
      // Synchronously save critical data before unload
      try {
        console.log('💾 Force saving data before unload...');
        await workScheduleDB.init();
        await Promise.all([
          workScheduleDB.setSchedule(schedule),
          workScheduleDB.setSpecialDates(specialDates)
        ]);
        console.log('✅ Data saved successfully before unload');
      } catch (error) {
        console.error('❌ Error saving before unload:', error);
      }
      
      // Required for Chrome to show unload dialog
      e.returnValue = '';
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [schedule, specialDates]);

  // Pass specialDates to the calculation hook with refreshKey dependency
  const { totalAmount, monthToDateAmount } = useScheduleCalculations(schedule, settings, specialDates, currentDate, refreshKey);

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // Check if data is loading
  // Remove database dependency for initial load

  // Add artificial loading delay to ensure users can read the loading screen
  useEffect(() => {
    let animationFrame: number;
    let startTime: number;
    const duration = 3000; // 3 seconds
    
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Smooth easing function for natural progress
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const smoothedProgress = Math.round(easeOutQuart * 100);
      
      setSmoothProgress(smoothedProgress);
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setSmoothProgress(100);
        setTimeout(() => {
          setArtificialLoading(false);
          setShowMainApp(true);
        }, 100); // Small delay after reaching 100%
      }
    };
    
    animationFrame = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, []);

  // Only use artificial loading for initial screen
  const isLoading = artificialLoading;

  // Initialize Add to Home Screen functionality
  useEffect(() => {
    if (showMainApp) {
      // Create AddToHomescreen instance
      const addToHomescreenInstance = new AddToHomescreen({
        appName: 'X-ray MIT',
        appIconUrl: 'https://jarivatoi.github.io/mit/icon.png',
        maxModalDisplayCount: 1, // Only show once
        skipFirstVisit: false, // Show on first visit
        startDelay: 3000, // 3 second delay for first visit
        lifespan: 20000,
        mustShowCustomPrompt: false, // Use normal detection logic
        displayPace: 999999 // Very large number to prevent showing again
      });
      
      // Check if can prompt (now async)
      const checkAndShow = async () => {
        const canShow = await addToHomescreenInstance.canPrompt();
        
        if (canShow) {
          setTimeout(() => {
            addToHomescreenInstance.show();
          }, 3000); // 3 second delay
        }
      };
      
      checkAndShow();
    }
  }, [showMainApp]);

  // Listen for navigation to specific month
  useEffect(() => {
    const handleNavigateToMonth = (event: CustomEvent) => {
      const { month, year } = event.detail;
      setCurrentDate(new Date(year, month, 1));
    };

    window.addEventListener('navigateToMonth', handleNavigateToMonth as EventListener);
    return () => window.removeEventListener('navigateToMonth', handleNavigateToMonth as EventListener);
  }, [schedule, specialDates, dateNotes]);
  
  // Listen for tab switch requests
  useEffect(() => {
    const handleSwitchToCalendar = () => {
      setActiveTab('calendar');
      // Force refresh when switching to calendar after export
      setRefreshKey(prev => prev + 1);
    };

    const handleDebugCalendarState = () => {
    };
    window.addEventListener('switchToCalendarTab', handleSwitchToCalendar);
    window.addEventListener('debugCalendarState', handleDebugCalendarState);
    return () => {
      window.removeEventListener('switchToCalendarTab', handleSwitchToCalendar);
      window.removeEventListener('debugCalendarState', handleDebugCalendarState);
    };
  }, [schedule, specialDates, currentDate, dateNotes]);
  
  // Initialize content animation when component mounts
  useEffect(() => {
    if (contentRef.current && showMainApp) {
      gsap.fromTo(contentRef.current,
        {
          opacity: 0,
          y: 30,
          scale: 0.95,
          force3D: true
        },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.8,
          ease: "power2.out",
          force3D: true
        }
      );
    }
  }, [showMainApp]);

  const handleTabChange = (newTab: 'calendar' | 'settings' | 'data' | 'profile') => {
    // Immediately update the active tab state for instant UI feedback
    setActiveTab(newTab);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(new Date(currentYear, currentMonth + (direction === 'next' ? 1 : -1), 1));
  };

  const formatDateKey = (day: number) => {
    return `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  };

  const handleDateClick = (day: number) => {
    const dateKey = formatDateKey(day);
    setSelectedDate(dateKey);
    setShowModal(true);
  };

  const canSelectShift = (shiftId: string, dateKey: string) => {
    const currentShifts = schedule[dateKey] || [];
    
    // 9-4 and 12-10 cannot overlap
    if (shiftId === '9-4' && currentShifts.includes('12-10')) return false;
    if (shiftId === '12-10' && currentShifts.includes('9-4')) return false;
    
    // 12-10 and 4-10 cannot overlap
    if (shiftId === '12-10' && currentShifts.includes('4-10')) return false;
    if (shiftId === '4-10' && currentShifts.includes('12-10')) return false;
    
    return true;
  };

  const toggleShift = (shiftId: string) => {
    if (!selectedDate) return;
    
    const currentShifts = schedule[selectedDate] || [];
    
    if (currentShifts.includes(shiftId)) {
      // Remove shift
      const updatedShifts = currentShifts.filter(id => id !== shiftId);
      setSchedule(prev => ({
        ...prev,
        [selectedDate]: updatedShifts.length > 0 ? updatedShifts : []
      }));
    } else {
      // Add shift if allowed
      if (canSelectShift(shiftId, selectedDate)) {
        setSchedule(prev => ({
          ...prev,
          [selectedDate]: [...currentShifts, shiftId]
        }));
      }
    }
    
    // FIXED: Force refresh calculations when shifts change
    setRefreshKey(prev => prev + 1);
  };

  const handleUpdateNote = (dateKey: string, note: string) => {
    setDateNotes(prev => ({
      ...prev,
      [dateKey]: note
    }));
  };

  // Render the appropriate tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'calendar':
        // Use user's surname as schedule title if user is logged in
        const currentScheduleTitle = user?.surname ? `${user.surname}'s Schedule` : scheduleTitle;
        return (
          <Calendar
            currentDate={currentDate}
            schedule={schedule}
            specialDates={specialDates}
            dateNotes={dateNotes}
            onDateClick={handleDateClick}
            onNavigateMonth={navigateMonth}
            totalAmount={totalAmount}
            monthToDateAmount={monthToDateAmount}
            onDateChange={setCurrentDate}
            scheduleTitle={currentScheduleTitle}
            onTitleUpdate={setScheduleTitle}
            setSchedule={setSchedule}
            setSpecialDates={setSpecialDates}
            setDateNotes={setDateNotes}
            monthlySalary={0}
            globalSalary={settings.basicSalary}
          />
        );
      case 'settings':
        return (
          <SettingsPanel
            settings={settings}
            useManualMode={settings.useManualMode}
            onUpdateBasicSalary={(salary) => setSettings(prev => ({ ...prev, basicSalary: salary }))}
            onUpdateShiftHours={(combinationId, hours) => {
              setSettings(prev => ({
                ...prev,
                shiftCombinations: prev.shiftCombinations.map(comb => 
                  comb.id === combinationId ? { ...comb, hours } : comb
                )
              }));
            }}
            onToggleManualMode={(enabled) => setSettings(prev => ({ ...prev, useManualMode: enabled }))}
            onUpdateManualAmount={(combinationId, manualAmount) => {
              setSettings(prev => ({
                ...prev,
                shiftCombinations: prev.shiftCombinations.map(comb => 
                  comb.id === combinationId 
                    ? { ...comb, manualAmount, useManualAmount: true }
                    : comb
                )
              }));
            }}
          />
        );
      case 'data':
        return (
          <MenuPanel 
            onImportData={(data) => {
              // Handle data import
              if (data.schedule) setSchedule(data.schedule);
              if (data.specialDates) setSpecialDates(data.specialDates);
              if (data.dateNotes) setDateNotes(data.dateNotes);
              if (data.settings) setSettings(data.settings);
              if (data.scheduleTitle) setScheduleTitle(data.scheduleTitle);
              setRefreshKey(prev => prev + 1); // Force refresh calculations
            }}
            onExportData={async () => {
              // Export IndexedDB data
              try {
                // Get current user for filename (surname only, no ID number)
                const userName = user ? `${user.surname || 'User'}` : 'User';
                
                // Simple export of the schedule and settings data
                const exportData = {
                  schedule,
                  specialDates,
                  dateNotes,
                  settings,
                  scheduleTitle,
                  exportDate: new Date().toISOString(),
                  version: '1.0'
                };
                
                // Format filename: NARAYYA_Schedule_dd-mm-yyyy_HH-MM.json
                const now = new Date();
                const day = now.getDate().toString().padStart(2, '0');
                const month = (now.getMonth() + 1).toString().padStart(2, '0');
                const year = now.getFullYear();
                const hours = now.getHours().toString().padStart(2, '0');
                const minutes = now.getMinutes().toString().padStart(2, '0');
                
                const exportFileDefaultName = `${userName}_Schedule_${day}-${month}-${year}_${hours}-${minutes}.json`;
                
                const dataStr = JSON.stringify(exportData, null, 2);
                const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
                
                const linkElement = document.createElement('a');
                linkElement.setAttribute('href', dataUri);
                linkElement.setAttribute('download', exportFileDefaultName);
                linkElement.click();
                
                // Show success message via custom event or callback
                console.log('Export successful:', exportFileDefaultName);
              } catch (error: unknown) {
                console.error('Export failed:', error);
                alert('Export failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
              }
            }}
          />
        );
      case 'profile':
        // Convert user session to profile format for ProfileTab
        const userProfile: UserProfile = user ? {
          id: user.userId,
          idNumber: user.idNumber,
          surname: '', // Would need to fetch from backend
          name: '', // Would need to fetch from backend
          isAdmin: user.isAdmin
        } : null;
        return <ProfileTab user={userProfile} onLoginSuccess={onLoginSuccess} />;
      default:
        return (
          <Calendar
            currentDate={currentDate}
            schedule={schedule}
            specialDates={specialDates}
            dateNotes={dateNotes}
            onDateClick={handleDateClick}
            onNavigateMonth={navigateMonth}
            totalAmount={totalAmount}
            monthToDateAmount={monthToDateAmount}
            onDateChange={setCurrentDate}
            scheduleTitle={scheduleTitle}
            onTitleUpdate={setScheduleTitle}
            setSchedule={setSchedule}
            setSpecialDates={setSpecialDates}
            setDateNotes={setDateNotes}
            monthlySalary={0}
            globalSalary={settings.basicSalary}
          />
        );
    }
  };

  // Loading screen
  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Animated background elements */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.05) 0%, transparent 20%), radial-gradient(circle at 90% 80%, rgba(139, 92, 246, 0.05) 0%, transparent 20%)',
          zIndex: 0
        }}></div>
        
        <div style={{
          position: 'relative',
          zIndex: 1,
          textAlign: 'center',
          maxWidth: 400,
          padding: 20
        }}>
          {/* GIF Splash Screen */}
          <div style={{
            width: 200,
            height: 200,
            margin: '0 auto 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '20px',
            overflow: 'hidden'
          }}>
            {/* Animated Logo with Pulse Effect */}
            <div style={{
              position: 'relative',
              width: 120,
              height: 120,
              animation: 'pulse-bounce 1.5s ease-in-out infinite'
            }}>
              {/* Main logo container */}
              <div style={{
                width: '100%',
                height: '100%',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                borderRadius: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 20px 60px -20px rgba(99, 102, 241, 0.5)',
                animation: 'gradient-shift 3s ease infinite',
                backgroundSize: '200% 200%'
              }}>
                {/* Calendar Icon */}
                <svg width="60" height="60" viewBox="0 0 24 24" fill="none" style={{
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                }}>
                  <path d="M8 7V3M16 7V3M7 11H17M5 21H19C20.1046 21 21 20.1046 21 19V7C21 5.89543 20.1046 5 19 5H5C3.89543 5 3 5.89543 3 7V19C3 20.1046 3.89543 21 5 21Z" 
                        stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                
                {/* Rotating ring around logo */}
                <div style={{
                  position: 'absolute',
                  width: '140%',
                  height: '140%',
                  border: '3px solid transparent',
                  borderTop: '3px solid rgba(255,255,255,0.3)',
                  borderBottom: '3px solid rgba(255,255,255,0.3)',
                  borderRadius: '50%',
                  animation: 'spin 2s linear infinite'
                }}></div>
              </div>
              
              {/* Ripple effect */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                border: '2px solid rgba(99, 102, 241, 0.5)',
                animation: 'ripple 1.5s ease-out infinite'
              }}></div>
            </div>
            
            {/* Add CSS animations */}
            <style>{`
              @keyframes pulse-bounce {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
              }
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
              @keyframes ripple {
                0% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
                100% { transform: translate(-50%, -50%) scale(1.6); opacity: 0; }
              }
              @keyframes gradient-shift {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
              }
            `}</style>
          </div>
          
          <h1 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: '#1e293b',
            marginBottom: 8
          }}>
            Loading App
          </h1>
          
          <p style={{
            fontSize: '14px',
            color: '#64748b',
            marginBottom: 24
          }}>
            Preparing your calendar and settings...
          </p>
          
             <h1 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#1e293b',
            marginBottom: 8
          }}>
            Created By NARAYYA
          </h1>
          
          
          
          
          <div style={{
            width: '100%',
            height: 8,
            backgroundColor: '#e2e8f0',
            borderRadius: 4,
            overflow: 'hidden',
            marginBottom: 8
          }}>
            <div 
              style={{
                height: '100%',
                width: `${smoothProgress}%`,
                backgroundColor: '#6366f1',
                borderRadius: 4,
                transition: 'width 0.1s linear',
                minWidth: '1%'
              }}
            ></div>
          </div>
          
          <div style={{
            fontSize: '12px',
            color: '#94a3b8'
          }}>
            {smoothProgress}%
          </div>
        </div>
      </div>
    );
  }

  // Main app content
  return (
    <div ref={contentRef} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Tab Navigation */}
      <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} />
      
      {/* Main Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {renderTabContent()}
      </div>
      
      {/* Modals and Popups - Rendered via Portal to avoid scroll issues */}
      {showModal && selectedDate && typeof document !== 'undefined' && createPortal(
        <ShiftModal
          selectedDate={selectedDate}
          schedule={schedule}
          specialDates={specialDates}
          dateNotes={dateNotes}
          onClose={() => setShowModal(false)}
          onToggleShift={toggleShift}
          onUpdateNote={handleUpdateNote}
          onToggleSpecialDate={(dateKey: string, isSpecial: boolean) => {
            setSpecialDates(prev => ({
              ...prev,
              [dateKey]: isSpecial
            }));
            setRefreshKey(prev => prev + 1);
          }}
        />,
        document.body
      )}
    </div>
  );
}

export default App;
