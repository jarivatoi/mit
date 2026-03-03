import React, { useState, useEffect } from 'react';
import { gsap } from 'gsap';
import { Calendar, Settings, Database, User } from 'lucide-react';

interface Tab {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tabId: 'calendar' | 'settings' | 'data' | 'profile') => void;
}

const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange }) => {
  // Add CSS animations for icons
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes iconPulse {
        0%, 100% {
          transform: scale(1);
          opacity: 0.7;
        }
        50% {
          transform: scale(1.05);
          opacity: 1;
        }
      }
      
      @keyframes iconBounce {
        0%, 20%, 50%, 80%, 100% {
          transform: translateY(0);
        }
        40% {
          transform: translateY(-2px);
        }
        60% {
          transform: translateY(-1px);
        }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, []);

  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [localActiveTab, setLocalActiveTab] = useState<string>(activeTab);
  
  // Update local state when prop changes
  useEffect(() => {
    setLocalActiveTab(activeTab);
  }, [activeTab]);
  
  const handleTabClick = (tabId: string) => {
    // Always allow tab changes for instant responsiveness
    if (tabId === localActiveTab) return;
    
    // Add click animation to the clicked tab icon
    const clickedTabButton = document.querySelector(`[data-tab-id="${tabId}"] .tab-icon`);
    if (clickedTabButton) {
      gsap.to(clickedTabButton, {
        scale: 1.2,
        duration: 0.15,
        ease: "power2.out",
        yoyo: true,
        repeat: 1,
        force3D: true
      });
    }
    
    // Animate background transition
    const background = document.querySelector('.tab-background');
    if (background) {
      gsap.to(background, {
        scale: 0.95,
        opacity: 0.7,
        duration: 0.1,
        ease: "power2.out",
        force3D: true,
        onComplete: () => {
          // Update state after brief animation
          setLocalActiveTab(tabId);
          
          // Animate background back
          gsap.to(background, {
            scale: 1,
            opacity: 1,
            duration: 0.2,
            ease: "power2.out",
            force3D: true
          });
        }
      });
    } else {
      // Fallback if background not found
      setLocalActiveTab(tabId);
    }
    
    // Call parent handler with slight delay for smoother UX
    // Remove delay for instant response
    onTabChange(tabId);
  };
  
  const handleTouchStart = (tabId: string) => {
    // Always allow tab changes for instant responsiveness
    if (tabId === localActiveTab) return;
    
    // Mobile-optimized touch animation
    const touchedTabButton = document.querySelector(`[data-tab-id="${tabId}"] .tab-icon`);
    if (touchedTabButton) {
      gsap.to(touchedTabButton, {
        scale: 1.15,
        duration: 0.1,
        ease: "power2.out",
        force3D: true,
        onComplete: () => {
          gsap.to(touchedTabButton, {
            scale: 1,
            duration: 0.15,
            ease: "power2.out",
            force3D: true
          });
        }
      });
    }
    
    // Update state immediately for mobile responsiveness
    setLocalActiveTab(tabId);
    onTabChange(tabId);
  };
  
const tabs: Tab[] = [
  { id: 'calendar', icon: Calendar, label: 'Calendar' },
  { id: 'settings', icon: Settings, label: 'Settings' },
  { id: 'data', icon: Database, label: 'Data' },
  { id: 'profile', icon: User, label: 'Profile' }
];

  const getTabIndex = (tabId: string) => tabs.findIndex(tab => tab.id === tabId);
  const activeIndex = getTabIndex(activeTab);
  
  // Show background only for active tab
  const backgroundIndex = activeIndex;
  const showBackground = backgroundIndex !== -1;

  return (
    <div className="w-full">
      <div className="relative bg-white/90 backdrop-blur-md shadow-lg border-b border-gray-200/50 p-2" style={{
        width: '100vw',
        marginLeft: 'calc(-50vw + 50%)',
        marginRight: 'calc(-50vw + 50%)',
        borderRadius: '0px'
      }}>
        {/* Tab buttons container */}
        <div className="relative grid grid-cols-4 w-full max-w-6xl mx-auto">
          {/* Single background that moves between tabs */}
          {showBackground && (
            <div 
              className="tab-background absolute inset-y-0 bg-blue-500/10 rounded-xl transition-all duration-300 ease-out"
              style={{
                width: 'calc(25% - 8px)',
                left: `calc(${backgroundIndex * 25}% + 4px)`,
                top: '0px',
                bottom: '0px'
              }}
            />
          )}
          
          {/* Top indicator line - only for active tab */}
          {activeIndex !== -1 && (
            <div 
              className="absolute top-1 h-0.5 bg-blue-500 rounded-full transition-all duration-300 ease-out"
              style={{
                width: 'calc(25% - 48px)',
                left: `calc(${activeIndex * 25}% + 24px)`
              }}
            />
          )}

          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTab;
            const isHovered = hoveredTab === tab.id;
            const showText = isActive || isHovered;
            
            return (
              <button
                key={tab.id}
                data-tab-id={tab.id}
                onClick={() => handleTabClick(tab.id)}
                onTouchStart={() => handleTouchStart(tab.id)}
                onMouseEnter={() => setHoveredTab(tab.id)}
                onMouseLeave={() => setHoveredTab(null)}
                className="relative h-12 flex items-center transition-all duration-200 rounded-xl overflow-hidden px-2 pt-2"
                style={{
                  // Critical: Fix touch events for mobile
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent'
                }}
              >
                {/* Container for icon and text with dynamic justification */}
                <div className={`flex items-center h-full w-full transition-all duration-300 ${
                  showText ? 'justify-center space-x-1' : 'justify-center'
                }`}>
                  {/* Icon - always visible */}
                  <Icon 
                    className="tab-icon w-5 h-5 transition-all duration-300 flex-shrink-0 hover:scale-[1.4] active:scale-95"
                    style={{
                      color: isActive ? '#2563eb' : isHovered ? '#3b82f6' : '#4b5563',
                      // Add subtle pulse animation for inactive icons to show they're clickable
                      animation: !isActive ? 'iconPulse 2s ease-in-out infinite' : 'none'
                    }}
                  />
                  
                  {/* Text - slides in horizontally with width animation */}
                  <div className={`overflow-hidden transition-all duration-300 ${
                    showText ? 'max-w-[70px] opacity-100' : 'max-w-0 opacity-0'
                  }`}>
                    <span 
                      className={`text-[10px] font-medium whitespace-nowrap block transition-all duration-300 ${
                        isActive ? 'text-blue-600' : isHovered ? 'text-blue-500' : 'text-gray-600'
                      }`}
                    >
                      {tab.label}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TabNavigation;
