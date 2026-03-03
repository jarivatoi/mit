import React, { useState, useEffect } from 'react' 
import { supabase, supabaseAdmin } from '../lib/supabase'
import { saveLastUsedIdNumber, getLastUsedIdNumber } from '../utils/indexedDB';

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
  const [error, setError] = useState<string | null>(null)
  const [showForgotPasscode, setShowForgotPasscode] = useState(false)
  const [tempIdNumber, setTempIdNumber] = useState('')
  const [idVerified, setIdVerified] = useState(false) // New state to track ID verification
  const [newPasscode, setNewPasscode] = useState('')
  const [confirmPasscode, setConfirmPasscode] = useState('')

  // Check if user is online
  const checkOnlineStatus = (): boolean => {
    return navigator.onLine
  }

  // Monitor online/offline status and clear error when back online
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 User is back online');
      // Clear any offline-related errors
      setError((prevError) => {
        if (prevError && prevError.includes('offline')) {
          return null;
        }
        return prevError;
      });
    };

    const handleOffline = () => {
      console.log('📡 User went offline');
      // Don't set error here, just log it - error will be set on next login attempt
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    if (!navigator.onLine && error?.includes('offline')) {
      setError(null);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [error]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
    // Check if user is online
    if (!checkOnlineStatus()) {
      setError('You are currently offline, please check your connectivity and try again...')
      return
    }
    
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
            <button type="button" onClick={() => {setShowForgotPasscode(false); setTempIdNumber(''); setIdVerified(false); setError(null); setPasscode('');}} style={{ ...buttonStyle, background: '#6b7280' }}>Back</button>
          </div>
        </div>
      )
    } else if (idVerified) {
      return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1rem' }}>
          <div style={{ width: '100%', maxWidth: 420, display: 'grid', gap: '12px' }}>
            <h2 style={{ textAlign: 'center' }}>Update Passcode</h2>
            <input 
              placeholder="New 4-digit Passcode" 
              value={newPasscode} 
              onChange={e => setNewPasscode(e.target.value.replace(/\D/g, '').slice(0, 4))} 
              style={inputStyle} 
              inputMode="numeric" 
              maxLength={4}
            />
            <input 
              placeholder="Re-enter Passcode" 
              value={confirmPasscode} 
              onChange={e => setConfirmPasscode(e.target.value.replace(/\D/g, '').slice(0, 4))} 
              style={inputStyle} 
              inputMode="numeric" 
              maxLength={4}
            />
            {error && <div style={{ color: 'red', textAlign: 'center' }}>{error}</div>}
            <button onClick={handleUpdatePasscode} style={buttonStyle}>Update Passcode</button>
            <button type="button" onClick={() => {setShowForgotPasscode(false); setNewPasscode(''); setConfirmPasscode(''); setTempIdNumber(''); setIdVerified(false); setError(null); setPasscode('');}} style={{ ...buttonStyle, background: '#6b7280' }}>Cancel</button>
          </div>
        </div>
      )
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1rem' }}>
      <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: 420, display: 'grid', gap: '12px' }}>
        <h2 style={{ textAlign: 'center' }}>Staff Sign In</h2>
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
        <input placeholder="4-digit Passcode" value={passcode} onChange={e => setPasscode(e.target.value.replace(/\D/g, '').slice(0, 4))} style={inputStyle} inputMode="numeric" maxLength={4} />
        {error && <div style={{ color: 'red', textAlign: 'center' }}>{error}</div>}
        <button type="submit" style={buttonStyle}>Login</button>
      </form>
      <div style={{ display: 'grid', gap: '8px', width: '100%', maxWidth: 420, marginTop: '16px' }}>
        <button type="button" onClick={() => onRegister && onRegister()} style={{ ...buttonStyle, background: '#10b981' }}>Register</button>
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
  padding: '12px 14px', borderRadius: 8, border: 'none', background: '#2563eb', color: 'white', fontWeight: 600, cursor: 'pointer'
}

export default StaffLogin
