import React, { useEffect, useState } from 'react'
import { supabase, supabaseAdmin } from '../lib/supabase'
import ConfirmationModal from './ConfirmationModal'

// Helper function to format date as ddd dd-mmm-yyyy HH:MM
const formatDate = (dateString: string | null): string => {
  if (!dateString) return 'never'
  
  try {
    const date = new Date(dateString)
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    
    const dayName = days[date.getDay()]
    const day = date.getDate().toString().padStart(2, '0')
    const month = months[date.getMonth()]
    const year = date.getFullYear()
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    
    return `${dayName} ${day}-${month}-${year} ${hours}:${minutes}`
  } catch {
    return dateString // fallback to original string if parsing fails
  }
}

const AdminPanel: React.FC = () => {
  const [staff, setStaff] = useState<any[]>([])
  const [loginEnabled, setLoginEnabled] = useState<boolean>(true)
  const [loading, setLoading] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [staffToDelete, setStaffToDelete] = useState<{id: string, name: string} | null>(null)

  const fetchData = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('staff_users').select('id, surname, name, id_number, last_login, is_admin, is_active, passcode_hash').order('last_login', { ascending: false })
    if (!error && data) setStaff(data)
    
    // Fetch the login enabled setting using admin client (bypasses RLS)
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'login_enabled')
      .single()
    
    if (settingsError) {
      console.log('Login enabled setting not found or error occurred:', settingsError.message)
      setLoginEnabled(true) // Default to true if setting doesn't exist
    } else if (settings?.value !== undefined && settings?.value !== null) {
      // Handle both string and boolean values from database
      const parsedValue = typeof settings.value === 'string' 
        ? settings.value.toLowerCase() === 'true'
        : Boolean(settings.value)
      setLoginEnabled(parsedValue)
      console.log('📊 Loaded login enabled setting:', parsedValue)
    } else {
      console.log('Login enabled setting has null/undefined value, defaulting to true')
      setLoginEnabled(true)
    }
    
    setLoading(false)
  }
  useEffect(() => { fetchData() }, [])

  const toggleLogin = async () => {
    const next = !loginEnabled
    try {
      console.log('🔄 Attempting to update login enabled to:', next)
      
      // Store as boolean directly using admin client (bypasses RLS)
      const { data, error } = await supabaseAdmin.from('system_settings').upsert({ 
        key: 'login_enabled', 
        value: next  // Store as boolean directly
      })
      
      if (error) {
        console.error('❌ Database error:', error)
        throw error
      }
      
      console.log('✅ Upsert successful, data:', data)
      setLoginEnabled(next)
      console.log('✅ Login enabled setting updated to:', next)
      
      // Verify the update was successful by re-fetching
      const { data: verifyData, error: verifyError } = await supabaseAdmin
        .from('system_settings')
        .select('value')
        .eq('key', 'login_enabled')
        .single()
      
      if (verifyError) {
        console.error('❌ Verification failed:', verifyError)
      } else {
        console.log('🔍 Verified stored value:', verifyData?.value, 'Type:', typeof verifyData?.value)
      }
    } catch (error: any) {
      console.error('❌ Failed to update login enabled setting:', error)
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      alert('Failed to update login setting. Please check console for details.')
    }
  }

  const toggleStaffAccess = async (staffId: string, currentActiveStatus: boolean) => {
    try {
      await supabase.from('staff_users').update({ is_active: !currentActiveStatus }).eq('id', staffId)
      // Refresh the staff list
      fetchData()
    } catch (error) {
      console.error('Error updating staff access:', error)
    }
  }

  const deleteStaff = async (staffId: string, staffName: string) => {
    setStaffToDelete({ id: staffId, name: staffName });
    setShowDeleteModal(true);
  }

  const handleDeleteConfirm = async () => {
    if (!staffToDelete) return;
    
    try {
      await supabase.from('staff_users').delete().eq('id', staffToDelete.id)
      // Refresh the staff list
      fetchData()
      setShowDeleteModal(false);
      setStaffToDelete(null);
    } catch (error) {
      console.error('Error deleting staff:', error)
    }
  }

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setStaffToDelete(null);
  }

  return (
    <div style={{ 
      border: '1px solid #e5e7eb', 
      borderRadius: 8, 
      padding: 12, 
      marginTop: 12,
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 120px)', // Full height minus header and margins
      minHeight: '400px'
    }}>
      <h3 style={{ marginBottom: 12, flexShrink: 0 }}>Admin Panel</h3>
      <button 
        onClick={() => { 
          localStorage.removeItem('staff_session');
          localStorage.removeItem('staff_onboarded');
          localStorage.removeItem('staff_first_run_complete');
          localStorage.removeItem('staff_needs_login');
          localStorage.removeItem('last_used_id_number');
          window.location.reload();
        }} 
        style={{ 
          padding: '12px 14px', 
          borderRadius: 8, 
          border: 'none', 
          background: '#6b7280', 
          color: 'white', 
          fontWeight: 600, 
          cursor: 'pointer', 
          userSelect: 'none', 
          WebkitUserSelect: 'none',
          marginBottom: 12,
          flexShrink: 0
        }}
      >
        Back to Login
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexShrink: 0 }}>
        <span>Login enabled</span>
        <input type="checkbox" checked={loginEnabled} onChange={toggleLogin} />
      </div>
      <div style={{ 
        flex: 1, 
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0, // Critical for nested scrollable content
        overflow: 'hidden'
      }}>
        <strong style={{ 
          marginBottom: 6, 
          textAlign: 'center',
          display: 'block',
          width: '100%'
        }}>Staff Directory</strong>
        {loading ? (
          <div style={{ padding: 12, textAlign: 'center', color: '#6b7280' }}>Loading...</div>
        ) : (
          <ul style={{ 
            marginTop: 0, 
            paddingLeft: 0, 
            listStyle: 'none', 
            flex: 1,
            overflowY: 'auto',
            margin: 0,
            padding: 0,
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y'
          }}>
            {staff.map(s => (
              <li key={s.id} style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                padding: '12px 16px', 
                borderBottom: '1px solid #e5e7eb',
                position: 'relative',
                userSelect: 'none',
                WebkitUserSelect: 'none'
              }}>
                {/* Staff name - Line 1 */}
                <div style={{ 
                  fontSize: '14px', 
                  fontWeight: 500, 
                  color: '#1f2937', 
                  marginBottom: '4px',
                  userSelect: 'text',
                  WebkitUserSelect: 'text'
                }}>
                  {s.name} {s.surname}
                </div>
                
                {/* ID Number - Line 2 */}
                <div style={{ 
                  fontSize: '13px', 
                  color: '#6b7280', 
                  marginBottom: '4px',
                  userSelect: 'none',
                  WebkitUserSelect: 'none'
                }}>
                  ID number (<span style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>{s.id_number}</span>)
                </div>
                
                {/* Last Login - Line 3 */}
                <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '8px' }}>
                  Last login: {formatDate(s.last_login)}
                </div>
                
                {/* Access and Delete buttons on same line */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  width: '100%'
                }}>
                  {/* Access control on left */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#4b5563' }}>Access:</span>
                    <input 
                      type="checkbox" 
                      checked={s.is_active} 
                      onChange={() => toggleStaffAccess(s.id, s.is_active)} 
                      title={`Toggle access for ${s.name} ${s.surname}`}
                      style={{ cursor: 'pointer' }}
                    />
                  </div>
                  
                  {/* Delete button on extreme right */}
                  <button 
                    onClick={() => deleteStaff(s.id, `${s.name} ${s.surname}`)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#dc2626',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      marginLeft: 'auto',
                      userSelect: 'none',
                      WebkitUserSelect: 'none'
                    }}
                    title={`Delete ${s.name} ${s.surname}`}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        title="Delete Staff Member"
        message={`Are you sure you want to delete ${staffToDelete?.name}? This will permanently remove the user and they will need to register again.`}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        confirmText="Delete"
        cancelText="Cancel"
        isDanger={true}
      />
    </div>
  )
}

export default AdminPanel
