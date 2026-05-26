import React, { useState, useEffect, useRef } from 'react'
import { supabase, supabaseAdmin } from '../lib/supabase'
import { saveLastUsedIdNumber, getLastUsedIdNumber } from '../utils/indexedDB';
import { gsap } from 'gsap';
import SplitText from '../utils/SplitText';

// Animated Registration Button Component
const AnimatedRegistrationButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const text1Ref = useRef<HTMLSpanElement>(null);
  const text2Ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (text1Ref.current && text2Ref.current) {
      SplitText.register(gsap);

      // Create SplitText instances for both texts
      const split1 = new SplitText(text1Ref.current, {
        type: 'chars',
        wordsClass: 'split-word',
        charsClass: 'split-char'
      });

      const split2 = new SplitText(text2Ref.current, {
        type: 'chars',
        wordsClass: 'split-word',
        charsClass: 'split-char'
      });

      // Set initial states - both texts start hidden off to the right
      gsap.set(split1.chars, {
        opacity: 0,
        x: 50, // Start positioned to the right
        y: 0,
        scale: 1,
        display: 'inline-block'
      });

      gsap.set(split2.chars, {
        opacity: 0,
        x: 50, // Start positioned to the right
        y: 0,
        scale: 1,
        display: 'inline-block'
      });

      // Ensure only Registration is visible initially by making chars inline-block
      gsap.set(split1.chars, {
        opacity: 1,
        x: 0,
        display: 'inline-block'
      });

      // Create timeline for seamless loop
      const tl = gsap.timeline({
        repeat: -1,
        repeatDelay: 0.5
      });

      // Animate "Registration" in - slide from right to left
      tl.to(split1.chars, {
        opacity: 1,
        x: 0, // Slide to original position from right
        duration: 0.5,
        stagger: 0.03,
        ease: 'power2.out'
      });

      // Hold for a moment
      tl.to({}, { duration: 0.5 });

      // Animate "Registration" out - fade out (stay in place)
      tl.to(split1.chars, {
        opacity: 0,
        duration: 0.5,
        stagger: 0.03,
        ease: 'power2.in'
      });

      // Animate "First Time Users Only" in - slide from right to left
      tl.to(split2.chars, {
        opacity: 1,
        x: 0, // Slide to original position from right
        duration: 0.5,
        stagger: 0.03,
        ease: 'power2.out'
      }, '-=0.4');

      // Hold for a moment
      tl.to({}, { duration: 0.5 });

      // Animate "First Time Users Only" out - fade out (stay in place)
      tl.to(split2.chars, {
        opacity: 0,
        duration: 0.7,
        stagger: 0.03,
        ease: 'power2.in'
      });

      // Reset Registration to starting position (off-screen right) while First Time Users Only is fading out
      tl.set(split1.chars, {
        x: 50,
        opacity: 0
      }, '-=0.4');

      // Loop back to Registration sliding in from right
      tl.to(split1.chars, {
        opacity: 1,
        x: 0, // Slide to original position from right
        duration: 0.5,
        stagger: 0.03,
        ease: 'power2.out'
      }, '-=0.4');

      return () => {
        split1.revert();
        split2.revert();
        tl.kill();
      };
    }
  }, []);

  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      style={{
        ...buttonStyle,
        background: '#10b981',
        position: 'relative',
        overflow: 'hidden',
        minHeight: '48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <span ref={text1Ref} style={{ display: 'block', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>Registration</span>
      <span ref={text2Ref} style={{ display: 'block', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>First Time Users Only</span>
    </button>
  );
}

type StaffLoginProps = {
  onLoginSuccess: (session: { userId: string; idNumber: string; isAdmin: boolean; surname?: string; name?: string }) => void
  onRegister?: () => void
  showIdField?: boolean
}

const hash = async (input: string) => {
  const enc = new TextEncoder()
  const data = enc.encode(input)
  const d = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, '0')).join('')
}

const StaffLogin: React.FC<StaffLoginProps> = ({ onLoginSuccess, onRegister, showIdField = true }) => {
  const headerRef = useRef<HTMLHeadingElement>(null);
  const animationTriggerRef = useRef(0); // Track animation trigger count

  // Try to get the last used ID number from IndexedDB to pre-fill
  const [idNumber, setIdNumber] = useState('');
  
  useEffect(() => {
    const loadLastId = async () => {
      try {
        const lastId = await getLastUsedIdNumber();
        if (lastId) {
          setIdNumber(lastId);
        }
      } catch (error) {
        console.warn('Could not load last used ID number from IndexedDB, falling back to localStorage:', error);
        // Fallback to localStorage if IndexedDB fails
        const fallbackId = localStorage.getItem('last_used_id_number');
        if (fallbackId) {
          setIdNumber(fallbackId);
        }
      }
    };
    
    loadLastId();
  }, []);

  const [passcode, setPasscode] = useState('')
  const [showPasscode, setShowPasscode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForgotPasscode, setShowForgotPasscode] = useState(false)
  const [tempIdNumber, setTempIdNumber] = useState('')
  const [idVerified, setIdVerified] = useState(false)
  const [newPasscode, setNewPasscode] = useState('')
  const [confirmPasscode, setConfirmPasscode] = useState('')
  const [showNewPasscode, setShowNewPasscode] = useState(false)
  const [showConfirmPasscode, setShowConfirmPasscode] = useState(false)

  // GSAP SplitText wave zoom animation for "Staff Sign In" header
  useEffect(() => {
    if (headerRef.current) {
      // Register SplitText with GSAP core
      SplitText.register(gsap);
      
      // Create SplitText instance
      const split = new SplitText(headerRef.current, {
        type: 'chars',
        wordsClass: 'split-word',
        charsClass: 'split-char'
      });
      
      // Set initial state of all characters - hidden and scaled down
      gsap.set(split.chars, {
        opacity: 0,
        scale: 0.5,
        y: -100,
        rotationX: -90,
        transformOrigin: 'center center -50',
        display: 'inline-block'
      });
      
      // Apply gradient to each character
      split.chars.forEach(char => {
        char.style.background = 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)';
        char.style.backgroundClip = 'text';
        char.style.webkitBackgroundClip = 'text';
        char.style.webkitTextFillColor = 'transparent';
      });
      
      // Create timeline for entrance and exit animation
      const tl = gsap.timeline({
        repeat: -1,
        repeatDelay: 1.5
      });
      
      // Animate characters IN - drop down from top
      tl.to(split.chars, {
        opacity: 1,
        scale: 1,
        y: 0,
        rotationX: 0,
        duration: 0.6,
        stagger: 0.08,
        ease: 'back.out(1.7)',
        transformOrigin: 'center center'
      });
      
      // Hold for a moment
      tl.to({}, { duration: 1.5 });
      
      // Animate characters OUT - starting from last character, moving downward
      tl.to(split.chars, {
        opacity: 0,
        scale: 0.5,
        y: 50, // Move downward toward ID number field
        rotationX: -90,
        duration: 0.4,
        stagger: {
          amount: 0.3,
          from: 'end' // Start from last character
        },
        ease: 'back.in(1.7)',
        transformOrigin: 'center center'
      });
      
      // Reset to starting position while invisible
      tl.set(split.chars, {
        y: -100,
        rotationX: -90,
        scale: 0.5
      });

      return () => {
        // Cleanup on unmount or dependency change
        split.revert();
      };
    }
  }, [showForgotPasscode]); // Re-run animation when forgot passcode state changes

  // Check if user is online
  const checkOnlineStatus = (): boolean => {
    return navigator.onLine
  }

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 User is back online');
    };

    const handleOffline = () => {
      console.log('📡 User went offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Check if user is online FIRST, before clearing errors
    if (!checkOnlineStatus()) {
      setError('You are currently offline, please check your connectivity and try again...')
      return
    }
    
    // Clear any previous errors only after confirming we're online
    setError(null)
    
    // Determine the ID number to use
    const actualIdNumber = showIdField ? idNumber : (passcode === '5274' ? '5274' : idNumber)
    
    // Validate that both ID Number and Passcode are provided
    if (!actualIdNumber || !passcode) {
      setError('Enter a Valid ID Number and Passcode')
      return
    }
    
    // MVP admin bypass - if passcode is '5274', treat as admin regardless of ID field visibility
    if (passcode === '5274' && actualIdNumber === '5274') {
      const session = { userId: 'admin-5274', idNumber: '5274', isAdmin: true };
      onLoginSuccess(session);
      return
    }
    
    // Check the global login setting FIRST using admin client (before checking user)
    let loginEnabled = true; // Default to enabled if setting doesn't exist
    try {
      const { data: settings, error: settingsError } = await supabaseAdmin.from('system_settings').select('value').eq('key', 'login_enabled').single()
      
      if (!settingsError && settings?.value !== undefined && settings?.value !== null) {
        // Handle both string and boolean values from database
        loginEnabled = typeof settings.value === 'string' 
          ? settings.value.toLowerCase() === 'true'
          : Boolean(settings.value);
      }
    } catch {
      // If settings don't exist, default to enabled
      // This handles cases where the system_settings table doesn't have the login_enabled key yet
    }
    
    // If login is disabled, show error immediately
    if (!loginEnabled) {
      setError('Login is currently disabled by admin')
      return
    }
    
    // Regular staff login flow
    try {
      // First, check if the user exists
      const rec = await (await import('../lib/supabase')).supabase.from('staff_users').select('id, surname, name, id_number, passcode_hash, is_admin, is_active').eq('id_number', actualIdNumber).single()
      console.log('User lookup result:', rec);
      
      // Check for duplicate ID numbers
      const duplicates = await (await import('../lib/supabase')).supabase.from('staff_users').select('id, id_number, passcode_hash').eq('id_number', actualIdNumber);
      console.log('Duplicate check for ID', actualIdNumber, ':', duplicates);
      
      if (rec.error || !rec.data) throw new Error('User not found')
      const row = rec.data
      if (!row.is_active) throw new Error('User is inactive')
      
      const hashed = await hash(passcode)
      console.log('Login attempt:', { passcode, hashed, storedHash: row.passcode_hash });
      if (hashed !== row.passcode_hash) throw new Error('Incorrect passcode')
      await (await import('../lib/supabase')).supabase.from('staff_users').update({ last_login: new Date().toISOString() }).eq('id', row.id)
      // Store the ID number in IndexedDB for future logins
      try {
        await saveLastUsedIdNumber(row.id_number);
      } catch (error) {
        console.warn('Could not save ID number to IndexedDB, falling back to localStorage:', error);
        // Fallback to localStorage if IndexedDB fails
        localStorage.setItem('last_used_id_number', row.id_number);
      }
      onLoginSuccess({ 
        userId: row.id, 
        idNumber: row.id_number, 
        isAdmin: !!row.is_admin,
        surname: row.surname || '',
        name: row.name || ''
      })
    } catch (err: any) {
      setError(err?.message ?? 'Login failed')
    }
  }

  const handleForgotPasscode = async () => {
    setError(null)
    setPasscode('') // Clear the passcode field when starting forgot passcode flow
    console.log('Starting forgot passcode flow with tempIdNumber:', tempIdNumber);
    
    // Check if user is online
    if (!checkOnlineStatus()) {
      setError('You are currently offline, please check your connectivity and try again...')
      return
    }
    
    // Validate ID Number field
    if (!tempIdNumber || tempIdNumber.trim().length === 0) {
      setError('Enter a valid ID')
      return
    }
    
    // Check if ID is exactly 14 alphanumeric characters
    if (!/^[A-Z0-9]{14}$/.test(tempIdNumber)) {
      setError('Enter a valid ID')
      return
    }
    
    try {
      const { data, error } = await supabase.from('staff_users').select('id').eq('id_number', tempIdNumber).single()
      console.log('ID verification result:', { data, error, tempIdNumber });
      if (error || !data) {
        setError('Incorrect ID Number')
        return
      }
      
      // ID verified, now allow setting new passcode
      setIdVerified(true) // Set verification state
      setError(null)
    } catch (err) {
      setError('Incorrect ID Number')
    }
  }

  const handleUpdatePasscode = async () => {
    if (newPasscode !== confirmPasscode) {
      setError('Passcodes do not match')
      return
    }
    
    if (newPasscode.length !== 4 || !/^\d{4}$/.test(newPasscode)) {
      setError('Passcode must be 4 digits')
      return
    }
    
    // Check if user is online
    if (!checkOnlineStatus()) {
      setError('You are currently offline, please check your connectivity and try again...')
      return
    }
    
    try {
      const hashedPasscode = await hash(newPasscode)
      console.log('Updating password:', { newPasscode, hashedPasscode, tempIdNumber });
      console.log('Update query will target id_number:', tempIdNumber);
      if (!tempIdNumber) {
        setError('ID number not found');
        return;
      }
      const { error } = await supabase.from('staff_users').update({ passcode_hash: hashedPasscode }).eq('id_number', tempIdNumber)
      
      if (error) {
        console.error('Update error:', error);
        throw error;
      }
      
      // Verify the update actually happened
      const verify = await supabase.from('staff_users').select('passcode_hash').eq('id_number', tempIdNumber).single();
      console.log('Verification after update:', { expected: hashedPasscode, actual: verify.data?.passcode_hash, match: hashedPasscode === verify.data?.passcode_hash });
      
      setError('Passcode updated successfully')
      setShowForgotPasscode(false)
      setNewPasscode('')
      setConfirmPasscode('')
      setTempIdNumber('')
      setIdVerified(false) // Reset verification state
      setPasscode('') // Clear the main passcode field
    } catch (err: any) {
      setError(err?.message ?? 'Failed to update passcode')
    }
  }

  if (showForgotPasscode) {
    if (!idVerified) {
      return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1rem' }}>
          <div style={{ width: '100%', maxWidth: 420, display: 'grid', gap: '12px' }}>
            <h2 style={{ textAlign: 'center' }}>Forgot Passcode</h2>
            <input 
              placeholder="Enter ID Number" 
              value={tempIdNumber} 
              onChange={e => {
                const value = e.target.value.toUpperCase();
                setTempIdNumber(value);
                // Clear error if we have a valid 14-character alphanumeric ID
                if (/^[A-Z0-9]{14}$/.test(value)) {
                  setError(null);
                }
              }} 
              style={inputStyle} 
              autoCapitalize="characters"
              onKeyDown={e => {
                // Prevent Enter key from submitting the form
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleForgotPasscode();
                }
              }}
            />
            {error && <div style={{ color: 'red', textAlign: 'center' }}>{error}</div>}
            <button onClick={handleForgotPasscode} style={buttonStyle}>Verify ID</button>
            <button type="button" onClick={() => {
              setShowForgotPasscode(false); 
              setTempIdNumber(''); 
              setIdVerified(false); 
              setError(null); 
              setPasscode('');
              window.scrollTo(0, 0); // Reset scroll to top
            }} style={{ ...buttonStyle, background: '#6b7280' }}>Back</button>
          </div>
        </div>
      )
    } else if (idVerified) {
      return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1rem' }}>
          <div style={{ width: '100%', maxWidth: 420, display: 'grid', gap: '12px' }}>
            <h2 style={{ textAlign: 'center' }}>Update Passcode</h2>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input 
                placeholder="New 4-digit Passcode" 
                value={newPasscode} 
                onChange={e => setNewPasscode(e.target.value.replace(/\D/g, '').slice(0, 4))} 
                style={{ ...inputStyle, flex: 1, paddingRight: '45px' }} 
                type={showNewPasscode ? 'text' : 'password'}
                inputMode="numeric" 
                maxLength={4}
              />
              <button
                type="button"
                onMouseDown={() => setShowNewPasscode(true)}
                onMouseUp={() => setShowNewPasscode(false)}
                onMouseLeave={() => setShowNewPasscode(false)}
                onTouchStart={() => setShowNewPasscode(true)}
                onTouchEnd={() => setShowNewPasscode(false)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  fontSize: '18px',
                  color: '#6b7280'
                }}
              >
                {showNewPasscode ? '🙈' : '👁️'}
              </button>
            </div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input 
                placeholder="Re-enter Passcode" 
                value={confirmPasscode} 
                onChange={e => setConfirmPasscode(e.target.value.replace(/\D/g, '').slice(0, 4))} 
                style={{ ...inputStyle, flex: 1, paddingRight: '45px' }} 
                type={showConfirmPasscode ? 'text' : 'password'}
                inputMode="numeric" 
                maxLength={4}
              />
              <button
                type="button"
                onMouseDown={() => setShowConfirmPasscode(true)}
                onMouseUp={() => setShowConfirmPasscode(false)}
                onMouseLeave={() => setShowConfirmPasscode(false)}
                onTouchStart={() => setShowConfirmPasscode(true)}
                onTouchEnd={() => setShowConfirmPasscode(false)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  fontSize: '18px',
                  color: '#6b7280'
                }}
              >
                {showConfirmPasscode ? '🙈' : '👁️'}
              </button>
            </div>
            {error && <div style={{ color: 'red', textAlign: 'center' }}>{error}</div>}
            <button onClick={handleUpdatePasscode} style={buttonStyle}>Update Passcode</button>
            <button type="button" onClick={() => {
              setShowForgotPasscode(false); 
              setNewPasscode(''); 
              setConfirmPasscode(''); 
              setTempIdNumber(''); 
              setIdVerified(false); 
              setError(null); 
              setPasscode('');
              window.scrollTo(0, 0); // Reset scroll to top
            }} style={{ ...buttonStyle, background: '#6b7280' }}>Cancel</button>
          </div>
        </div>
      )
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1rem' }}>
      <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: 420, display: 'grid', gap: '12px' }}>
        {/* Animated Staff Sign In Header with GSAP */}
        <h2 
          ref={headerRef}
          style={{ 
            textAlign: 'center',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            backgroundSize: '200% auto',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontSize: '28px',
            fontWeight: '700',
            margin: '0 0 12px 0',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none',
            display: 'inline-block'
          }}
        >
          Staff Sign In
        </h2>
        {showIdField !== false && (
          <input 
            placeholder="ID Number" 
            value={idNumber} 
            onChange={e => setIdNumber(e.target.value.toUpperCase())} 
            style={inputStyle} 
            autoCapitalize="characters"
            onKeyDown={e => {
              // Prevent Enter key from submitting the form
              if (e.key === 'Enter') {
                e.preventDefault();
              }
            }}
          />
        )}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input 
            placeholder="4-digit Passcode" 
            value={passcode} 
            onChange={e => setPasscode(e.target.value.replace(/\D/g, '').slice(0, 4))} 
            style={{ ...inputStyle, flex: 1, paddingRight: '45px' }} 
            type={showPasscode ? 'text' : 'password'}
            inputMode="numeric" 
            maxLength={4}
          />
          <button
            type="button"
            onMouseDown={() => setShowPasscode(true)}
            onMouseUp={() => setShowPasscode(false)}
            onMouseLeave={() => setShowPasscode(false)}
            onTouchStart={() => setShowPasscode(true)}
            onTouchEnd={() => setShowPasscode(false)}
            style={{
              position: 'absolute',
              right: '10px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              fontSize: '18px',
              color: '#6b7280',
              userSelect: 'none',
              WebkitUserSelect: 'none'
            }}
          >
            {showPasscode ? '🙈' : '👁️'}
          </button>
        </div>
        {error && <div style={{ color: 'red', textAlign: 'center' }}>{error}</div>}
        <button type="submit" style={buttonStyle}>Login</button>
      </form>
      <div style={{ display: 'grid', gap: '8px', width: '100%', maxWidth: 420, marginTop: '16px' }}>
        <AnimatedRegistrationButton onClick={() => onRegister && onRegister()} />
        <button type="button" onClick={() => {
          console.log('Forgot Passcode button clicked');
          setError(null); // Clear any existing error when navigating to forgot passcode
          setShowForgotPasscode(true);
        }} style={{ ...buttonStyle, background: '#ef4444' }}>Forgot Passcode</button>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '12px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, textAlign: 'center'
}
const buttonStyle: React.CSSProperties = {
  padding: '12px 14px', borderRadius: 8, border: 'none', background: '#2563eb', color: 'white', fontWeight: 600, cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none'
}

// Character-by-character slide reveal animation for Registration button
export default StaffLogin
