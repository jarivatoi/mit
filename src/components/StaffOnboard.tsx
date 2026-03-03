import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

type OnboardResult = { id?: string; idNumber?: string; surname?: string; name?: string; isAdmin?: boolean }

const StaffOnboard: React.FC<{ onComplete?: (u: OnboardResult) => void; onBack?: () => void }> = ({ onComplete, onBack }) => {
  const [surname, setSurname] = useState('')
  const [name, setName] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [confirmIdNumber, setConfirmIdNumber] = useState('')
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Check if user is online
  const checkOnlineStatus = (): boolean => {
    return navigator.onLine
  }

  // Helper function to capitalize surname (ALL CAPS)
  const capitalizeSurname = (str: string): string => {
    return str.toUpperCase().replace(/[^A-Z]/g, '');
  }

  // Helper function to capitalize name (first letter of each word)
  const capitalizeName = (str: string): string => {
    return str.toLowerCase().split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
    // Check if user is online
    if (!checkOnlineStatus()) {
      setError('You are currently offline, please check your connectivity and try again...')
      return
    }
    
    // Check if ID numbers match
    if (idNumber !== confirmIdNumber) {
      setError('ID number does not match. Please re-enter ID number.')
      return
    }
    
    // Basic validation
    const validSurname = surname.trim().length > 0
    const validName = name.trim().length > 0
    const validId = /^[A-Z0-9]{14}$/.test(idNumber) // Exactly 14 alphanumeric characters
    const validPass = /^\d{4}$/.test(passcode)
    if (!validSurname || !validName || !validId || !validPass) {
      setError('Please fill all fields: surname, name, ID (exactly 14 letters+digits), and a 4-digit passcode')
      return
    }
    
    try {
      const hash = async (input: string) => {
        const enc = new TextEncoder(); const data = enc.encode(input); const d = await crypto.subtle.digest('SHA-256', data); return Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2,'0')).join('')
      }
      const hashPass = await hash(passcode)
      const { data, error } = await supabase.from('staff_users').insert([{ surname: surname.trim(), name: name.trim(), id_number: idNumber, passcode_hash: hashPass, is_admin: false, is_active: true, last_login: new Date().toISOString() }])
      if (error) {
        // Check for duplicate ID error
        if (error.code === '23505' || error.message.includes('duplicate key') || error.message.includes('id_number_key')) {
          setError('This ID Number is already registered.')
        } else {
          setError(error.message ?? 'Onboarding failed')
        }
        return
      }
      const rec = data?.[0]
      onComplete?.({ id: rec?.id, idNumber, surname: surname.trim(), name: name.trim(), isAdmin: false })
    } catch (err: any) {
      setError(err?.message ?? 'Onboarding failed')
    }
  }

  const inputStyle: React.CSSProperties = { padding: '12px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, textAlign: 'center' }
  const btn: React.CSSProperties = { padding: '12px 14px', borderRadius: 8, border: 'none', background: '#2563eb', color: 'white', fontWeight: 600, cursor: 'pointer' }
  return (
    <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12, width: '100%', maxWidth: 420 }}>
        <h2 style={{ textAlign: 'center' }}>Staff Registration</h2>
        <input placeholder="Surname" value={surname} onChange={e => setSurname(capitalizeSurname(e.target.value))} style={inputStyle} />
        <input placeholder="Name" value={name} onChange={e => setName(capitalizeName(e.target.value))} style={inputStyle} />
        <input placeholder="ID Number" value={idNumber} onChange={e => setIdNumber(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 14))} style={inputStyle} autoCapitalize="characters" maxLength={14} />
        <input placeholder="Re-enter ID Number (verification)" value={confirmIdNumber} onChange={e => setConfirmIdNumber(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 14))} style={inputStyle} autoCapitalize="characters" maxLength={14} />
        <input placeholder="4-digit Passcode" value={passcode} onChange={e => setPasscode(e.target.value.replace(/\D/g, '').slice(0, 4))} style={inputStyle} inputMode="numeric" maxLength={4} />
        {error && <div style={{ color: 'red', textAlign: 'center' }}>{error}</div>}
        <button type="submit" style={btn}>Register</button>
        {onBack && (
          <button type="button" onClick={onBack} style={{ ...btn, background: '#6b7280' }}>Back to Login</button>
        )}
      </form>
    </div>
  )
}

export default StaffOnboard
