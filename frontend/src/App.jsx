import { useEffect, useState } from 'react'
import {
  bootstrapSession,
  generateCopilot,
  getCurrentUser,
  getDashboardSummary,
  listLeads,
  listUploads,
  login,
  logout,
  predictLead,
  refreshLeadRecommendations,
  updateLeadStatus,
  uploadCsv,
  register,
  listUsers,
  updateUser,
} from './api/client'

const insights = [
  'Pricing-page visits are concentrated in the last 48 hours.',
  'Email opens are outpacing clicks, suggesting nurture before escalation.',
  'Demo attendees convert to high-intent leads within one follow-up cycle.',
]

function StatCard({ label, value, detail }) {
  return (
    <article className="stat-card">
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      <span className="stat-detail">{detail}</span>
    </article>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [loginSubmitting, setLoginSubmitting] = useState(false)

  // Registration state
  const [isRegistering, setIsRegistering] = useState(false)
  const [registerForm, setRegisterForm] = useState({ username: '', email: '', password: '', role: 'sales_representative' })
  const [registerSuccessMessage, setRegisterSuccessMessage] = useState('')
  const [registerError, setRegisterError] = useState('')
  const [registerSubmitting, setRegisterSubmitting] = useState(false)

  // Tab & User management state
  const [activeTab, setActiveTab] = useState('dashboard')
  const [usersList, setUsersList] = useState([])
  const [userMgmtError, setUserMgmtError] = useState('')
  const [userMgmtLoading, setUserMgmtLoading] = useState(false)

  const [dashboardError, setDashboardError] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [uploadResult, setUploadResult] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [summary, setSummary] = useState({
    total_leads: 0,
    high_intent_leads: 0,
    predicted_revenue: 0,
    daily_ai_insights: [],
    recommended_follow_ups: 0,
    top_opportunities: 0,
  })
  const [uploadCount, setUploadCount] = useState(0)
  const [uploads, setUploads] = useState([])
  const [leads, setLeads] = useState([])
  const [selectedLeadId, setSelectedLeadId] = useState('')
  const [copilotResult, setCopilotResult] = useState(null)
  const [copilotLoading, setCopilotLoading] = useState(false)
  const [leadActionLoading, setLeadActionLoading] = useState(false)
  const [leadActionError, setLeadActionError] = useState('')

  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) || leads[0] || null

  function getLatestPrediction(lead) {
    if (!lead?.predictions?.length) {
      return null
    }

    return [...lead.predictions].sort(
      (left, right) => new Date(right.predicted_at).getTime() - new Date(left.predicted_at).getTime(),
    )[0]
  }

  function getLatestRecommendation(lead) {
    if (!lead?.recommendations?.length) {
      return null
    }

    return [...lead.recommendations].sort(
      (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
    )[0]
  }

  async function loadUsers() {
    setUserMgmtLoading(true)
    setUserMgmtError('')
    try {
      const data = await listUsers()
      setUsersList(Array.isArray(data) ? data : [])
    } catch (error) {
      setUserMgmtError(error.message || 'Failed to load user list.')
    } finally {
      setUserMgmtLoading(false)
    }
  }

  async function loadWorkspace(currentUser = user) {
    if (!currentUser) return
    setDashboardError('')
    try {
      const isAdmin = currentUser.role === 'system_administrator'
      const isSales = isAdmin || currentUser.role === 'sales_representative' || currentUser.role === 'sales_manager'
      const isMarketing = isAdmin || currentUser.role === 'marketing_executive'

      if (isSales) {
        getDashboardSummary().then(setSummary).catch(err => setDashboardError(err.message))
        listLeads().then(leadList => {
          const leadsData = Array.isArray(leadList) ? leadList : []
          setLeads(leadsData)
          if (!selectedLeadId && leadsData.length > 0) {
            setSelectedLeadId(leadsData[0].id)
          }
        }).catch(err => setDashboardError(err.message))
      }

      if (isMarketing) {
        listUploads().then(uploadList => {
          setUploads(Array.isArray(uploadList) ? uploadList : [])
          setUploadCount(Array.isArray(uploadList) ? uploadList.length : 0)
        }).catch(err => setDashboardError(err.message))
      }

      if (isAdmin) {
        loadUsers()
      }
    } catch (error) {
      setDashboardError(error.message || 'Unable to load workspace data.')
    }
  }

  useEffect(() => {
    let active = true

    async function bootstrap() {
      try {
        await bootstrapSession()
        const currentUser = await getCurrentUser()
        if (!active) return
        setUser(currentUser)
        if (currentUser) {
          await loadWorkspace(currentUser)
          const isSalesUser = currentUser.role === 'system_administrator' || currentUser.role === 'sales_representative' || currentUser.role === 'sales_manager'
          setActiveTab(isSalesUser ? 'dashboard' : 'uploads')
        }
      } catch (error) {
        if (!active) return
        setAuthError(error.message || 'Unable to initialize session.')
      } finally {
        if (active) {
          setAuthLoading(false)
        }
      }
    }

    bootstrap()
    return () => {
      active = false
    }
  }, [])

  async function handleLoginSubmit(event) {
    event.preventDefault()
    setLoginSubmitting(true)
    setAuthError('')

    try {
      await bootstrapSession()
      const nextUser = await login(loginForm.username, loginForm.password)
      setUser(nextUser)
      await loadWorkspace(nextUser)
      const isSalesUser = nextUser.role === 'system_administrator' || nextUser.role === 'sales_representative' || nextUser.role === 'sales_manager'
      setActiveTab(isSalesUser ? 'dashboard' : 'uploads')
    } catch (error) {
      setAuthError(error.message || 'Login failed.')
    } finally {
      setLoginSubmitting(false)
    }
  }

  async function handleRegisterSubmit(event) {
    event.preventDefault()
    setRegisterSubmitting(true)
    setRegisterError('')
    setRegisterSuccessMessage('')

    try {
      await register(
        registerForm.username,
        registerForm.email,
        registerForm.password,
        registerForm.role
      )
      setRegisterSuccessMessage(
        'Registration successful! Please ask the administrator to verify and activate your account before logging in.'
      )
      setRegisterForm({ username: '', email: '', password: '', role: 'sales_representative' })
    } catch (error) {
      setRegisterError(error.message || 'Registration failed.')
    } finally {
      setRegisterSubmitting(false)
    }
  }

  async function handleUserVerifyToggle(targetUser) {
    try {
      setUserMgmtError('')
      const updated = await updateUser(targetUser.id, { is_active: !targetUser.is_active })
      setUsersList((curr) => curr.map((u) => (u.id === targetUser.id ? updated : u)))
    } catch (error) {
      setUserMgmtError(error.message || 'Failed to update user status.')
    }
  }

  async function handleUserRoleChange(userId, nextRole) {
    try {
      setUserMgmtError('')
      const updated = await updateUser(userId, { role: nextRole })
      setUsersList((curr) => curr.map((u) => (u.id === userId ? updated : u)))
      if (userId === user.id) {
        setUser(updated)
      }
    } catch (error) {
      setUserMgmtError(error.message || 'Failed to update user role.')
    }
  }

  async function handleUserUnlock(userId) {
    try {
      setUserMgmtError('')
      const updated = await updateUser(userId, { is_locked_by_admin: false })
      setUsersList((curr) => curr.map((u) => (u.id === userId ? updated : u)))
    } catch (error) {
      setUserMgmtError(error.message || 'Failed to unlock user.')
    }
  }

  async function handleLogout() {
    try {
      await logout()
    } finally {
      setUser(null)
      setLoginForm({ username: '', password: '' })
      setAuthError('')
      setSummary({
        total_leads: 0,
        high_intent_leads: 0,
        predicted_revenue: 0,
        daily_ai_insights: [],
        recommended_follow_ups: 0,
        top_opportunities: 0,
      })
      setUploads([])
      setUploadCount(0)
      setUploadResult(null)
      setSelectedFile(null)
      setIsRegistering(false)
      setRegisterSuccessMessage('')
      setRegisterError('')
    }
  }

  async function handleUploadSubmit(event) {
    event.preventDefault()
    if (!selectedFile) {
      setUploadError('Choose a CSV file first.')
      return
    }

    setUploading(true)
    setUploadError('')
    setUploadResult(null)

    try {
      const result = await uploadCsv(selectedFile)
      setUploadResult(result)
      await loadWorkspace()
    } catch (error) {
      setUploadError(error.payload?.row_errors ? 'CSV validation failed.' : error.message || 'Upload failed.')
      setUploadResult(error.payload || null)
      await loadWorkspace().catch(() => {})
    } finally {
      setUploading(false)
    }
  }

  async function handleGenerateCopilot() {
    if (!selectedLead) {
      return
    }

    setCopilotLoading(true)
    try {
      const result = await generateCopilot(selectedLead.id)
      setCopilotResult(result)
    } catch (error) {
      setDashboardError(error.message || 'Unable to generate copilot content.')
    } finally {
      setCopilotLoading(false)
    }
  }

  async function handleLeadAction(action) {
    if (!selectedLead) {
      return
    }

    setLeadActionLoading(true)
    setLeadActionError('')

    try {
      if (action === 'predict') {
        await predictLead(selectedLead.id)
      } else if (action === 'recommend') {
        await refreshLeadRecommendations(selectedLead.id)
      }

      await loadWorkspace()
    } catch (error) {
      setLeadActionError(error.message || 'Unable to update lead intelligence.')
    } finally {
      setLeadActionLoading(false)
    }
  }

  async function handleStatusChange(leadId, nextStatus) {
    try {
      await updateLeadStatus(leadId, nextStatus)
      await loadWorkspace()
    } catch (error) {
      setDashboardError(error.message || 'Unable to update lead status.')
    }
  }

  if (authLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-card">
          <p className="eyebrow">LeadPulse</p>
          <h1>Establishing secure session...</h1>
          <p>Checking the Django API, restoring the browser session, and loading the dashboard.</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="auth-shell">
        <section className="auth-hero">
          <p className="eyebrow">LeadPulse</p>
          <h1>AI Revenue Intelligence for teams that already have a CRM.</h1>
          <p>
            Connect CSV-based lead data to live scoring, intent analysis, and rep-ready recommendations without
            replacing your existing system of record.
          </p>
          <div className="auth-points">
            <span>Session-based auth</span>
            <span>CSRF-protected requests</span>
            <span>CSV upload validation</span>
          </div>
        </section>

        {!isRegistering ? (
          <section className="auth-card">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Sign in</p>
                <h2>Access the dashboard</h2>
              </div>
            </div>
            <form className="auth-form" onSubmit={handleLoginSubmit}>
              <label>
                Username
                <input
                  type="text"
                  value={loginForm.username}
                  onChange={(event) => setLoginForm((current) => ({ ...current, username: event.target.value }))}
                  autoComplete="username"
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                  autoComplete="current-password"
                  required
                />
              </label>
              {authError ? <p className="form-error">{authError}</p> : null}
              {registerSuccessMessage ? <p className="form-success" style={{ color: 'green', fontSize: '14px', margin: '10px 0' }}>{registerSuccessMessage}</p> : null}
              <button className="primary-button" type="submit" disabled={loginSubmitting}>
                {loginSubmitting ? 'Signing in...' : 'Sign in'}
              </button>
              <button
                className="link-button"
                type="button"
                onClick={() => {
                  setIsRegistering(true)
                  setAuthError('')
                  setRegisterSuccessMessage('')
                }}
                style={{ marginTop: '10px' }}
              >
                Need an account? Register here
              </button>
            </form>
          </section>
        ) : (
          <section className="auth-card">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Register</p>
                <h2>Create new account</h2>
              </div>
            </div>
            <form className="auth-form" onSubmit={handleRegisterSubmit}>
              <label>
                Username
                <input
                  type="text"
                  value={registerForm.username}
                  onChange={(event) => setRegisterForm((current) => ({ ...current, username: event.target.value }))}
                  required
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={registerForm.email}
                  onChange={(event) => setRegisterForm((current) => ({ ...current, email: event.target.value }))}
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={registerForm.password}
                  onChange={(event) => setRegisterForm((current) => ({ ...current, password: event.target.value }))}
                  required
                />
              </label>
              <label>
                Role
                <select
                  value={registerForm.role}
                  onChange={(event) => setRegisterForm((current) => ({ ...current, role: event.target.value }))}
                  className="status-select"
                >
                  <option value="sales_representative">Sales Representative</option>
                  <option value="sales_manager">Sales Manager</option>
                  <option value="marketing_executive">Marketing Executive</option>
                </select>
              </label>
              {registerError ? <p className="form-error">{registerError}</p> : null}
              <button className="primary-button" type="submit" disabled={registerSubmitting}>
                {registerSubmitting ? 'Registering...' : 'Register'}
              </button>
              <button
                className="link-button"
                type="button"
                onClick={() => {
                  setIsRegistering(false)
                  setRegisterError('')
                }}
                style={{ marginTop: '10px' }}
              >
                Back to Sign in
              </button>
            </form>
          </section>
        )}
      </div>
    )
  }

  const isSystemAdmin = user.role === 'system_administrator'
  const isSales = isSystemAdmin || user.role === 'sales_representative' || user.role === 'sales_manager'
  const isMarketing = isSystemAdmin || user.role === 'marketing_executive'

  return (
    <div className="shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">LeadPulse</p>
          <h1>Revenue intelligence for the leads your team already has.</h1>
        </div>
        <nav className="sidebar-nav" aria-label="Primary">
          {isSales && (
            <a
              href="#dashboard"
              className={activeTab === 'dashboard' ? 'active' : ''}
              onClick={(e) => { e.preventDefault(); setActiveTab('dashboard'); }}
            >
              Dashboard
            </a>
          )}
          {isMarketing && (
            <a
              href="#uploads"
              className={activeTab === 'uploads' ? 'active' : ''}
              onClick={(e) => { e.preventDefault(); setActiveTab('uploads'); }}
            >
              CSV Upload
            </a>
          )}
          {isSales && (
            <a
              href="#opportunities"
              className={activeTab === 'opportunities' ? 'active' : ''}
              onClick={(e) => { e.preventDefault(); setActiveTab('opportunities'); }}
            >
              Top Opportunities
            </a>
          )}
          {isSales && (
            <a
              href="#copilot"
              className={activeTab === 'copilot' ? 'active' : ''}
              onClick={(e) => { e.preventDefault(); setActiveTab('copilot'); }}
            >
              AI Copilot
            </a>
          )}
          {isSystemAdmin && (
            <a
              href="#users"
              className={activeTab === 'users' ? 'active' : ''}
              onClick={(e) => { e.preventDefault(); setActiveTab('users'); }}
            >
              User Management
            </a>
          )}
        </nav>
        <div className="sidebar-panel">
          <span>Signed in as</span>
          <strong>{user.username}</strong>
          <p style={{ textTransform: 'capitalize' }}>{user.role.replace('_', ' ')}</p>
          <button className="link-button" type="button" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="content">
        {activeTab === 'dashboard' && isSales && (
          <div id="dashboard">
            <header className="hero">
              <div>
                <p className="eyebrow">AI Revenue Intelligence Platform</p>
                <h2>Rank leads, explain why, and tell reps exactly what to do next.</h2>
                {dashboardError ? <p className="form-error">{dashboardError}</p> : null}
              </div>
              <div className="hero-pill">
                <span>Uploads processed</span>
                <strong>{uploadCount}</strong>
              </div>
            </header>

            <section className="stats-grid" aria-label="Dashboard metrics">
              <StatCard label="Total Leads" value={summary.total_leads} detail="Imported from CSV only" />
              <StatCard label="High Intent Leads" value={summary.high_intent_leads} detail="AI-ranked opportunities" />
              <StatCard label="Predicted Revenue" value={`$${summary.predicted_revenue}`} detail="Model output placeholder" />
              <StatCard label="Recommended Follow-ups" value={summary.recommended_follow_ups} detail="Next-best action items" />
            </section>

            <section className="panel table-panel" style={{ marginTop: '20px' }}>
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Overview</p>
                  <h3>Opportunities Summary</h3>
                </div>
              </div>
              <p>Welcome to your AI workspace dashboard. Select the tabs on the left sidebar to navigate detailed sections like Opportunities list, AI sales copilot guidelines, or CSV ingestion options.</p>
            </section>
          </div>
        )}

        {activeTab === 'uploads' && isMarketing && (
          <div id="uploads">
            <header className="hero">
              <div>
                <p className="eyebrow">Ingestion</p>
                <h2>CSV upload with server-side schema validation</h2>
                {dashboardError ? <p className="form-error">{dashboardError}</p> : null}
              </div>
            </header>

            <section className="panel upload-panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">File Upload</p>
                  <h3>Ingest lead and activity records</h3>
                </div>
                <span className="panel-badge">Type, size, and schema checked before processing</span>
              </div>
              <form className="upload-grid" onSubmit={handleUploadSubmit}>
                <label className="upload-dropzone">
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                  />
                  <strong>{selectedFile ? selectedFile.name : 'Drop or choose a CSV file'}</strong>
                  <p>Lead details and activity rows are validated row by row.</p>
                </label>
                <div className="upload-notes">
                  <h4>Expected signal family</h4>
                  <ul>
                    <li>Website visits and pricing-page visits</li>
                    <li>Email opens and clicks</li>
                    <li>Demo attendance and content downloads</li>
                    <li>Company size, industry, and recency</li>
                  </ul>
                  <button className="primary-button" type="submit" disabled={uploading}>
                    {uploading ? 'Uploading...' : 'Upload CSV'}
                  </button>
                  {uploadError ? <p className="form-error">{uploadError}</p> : null}
                  {uploadResult?.row_errors?.length ? (
                    <div className="error-block">
                      <h4>Row errors</h4>
                      <ul>
                        {uploadResult.row_errors.map((rowError) => (
                          <li key={`${rowError.row}-${rowError.errors.join('|')}`}>
                            Row {rowError.row ?? 'file'}: {rowError.errors.join(' ')}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </form>
            </section>

            <section className="panel upload-history" style={{ marginTop: '20px' }}>
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Upload history</p>
                  <h3>Recent CSV imports</h3>
                </div>
              </div>
              {uploads.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>File</th>
                        <th>Status</th>
                        <th>Rows</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uploads.map((upload) => (
                        <tr key={upload.id}>
                          <td>{upload.original_filename}</td>
                          <td>{upload.status}</td>
                          <td>{upload.row_count ?? 0}</td>
                          <td>{upload.created_at ? new Date(upload.created_at).toLocaleString() : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="empty-state">No uploads yet. Use the CSV form above to ingest leads.</p>
              )}
            </section>
          </div>
        )}

        {activeTab === 'opportunities' && isSales && (
          <div id="opportunities">
            <header className="hero">
              <div>
                <p className="eyebrow">Recommendations</p>
                <h2>Top opportunities and next contact windows</h2>
                {dashboardError ? <p className="form-error">{dashboardError}</p> : null}
              </div>
            </header>

            <section className="panel table-panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">CRM Leads</p>
                  <h3>AI Intent Classification</h3>
                </div>
                <span className="panel-badge">High / Medium / Low intent buckets</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Lead</th>
                      <th>Company</th>
                      <th>Score</th>
                      <th>Intent</th>
                      <th>Status</th>
                      <th>Best Channel</th>
                      <th>Best Window</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.length ? leads.map((lead) => {
                      const latestPrediction = getLatestPrediction(lead)
                      const latestRecommendation = lead.recommendations?.[0] || null
                      const isSelected = lead.id === selectedLeadId
                      return (
                        <tr
                          key={lead.id}
                          onClick={() => setSelectedLeadId(lead.id)}
                          style={{ cursor: 'pointer', background: isSelected ? 'var(--color-surface-alt)' : 'transparent' }}
                        >
                          <td>{`${lead.first_name} ${lead.last_name}`.trim()}</td>
                          <td>{lead.company_name}</td>
                          <td>{latestPrediction?.score ?? '-'}</td>
                          <td>
                            <span className={`intent intent-${(latestPrediction?.intent_bucket || 'low').toLowerCase()}`}>
                              {latestPrediction?.intent_bucket ? latestPrediction.intent_bucket.charAt(0).toUpperCase() + latestPrediction.intent_bucket.slice(1) : 'Low'}
                            </span>
                          </td>
                          <td>
                            <select
                              className="status-select"
                              value={lead.status}
                              onChange={(event) => handleStatusChange(lead.id, event.target.value)}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value="new">New</option>
                              <option value="working">Working</option>
                              <option value="qualified">Qualified</option>
                              <option value="opportunity">Opportunity</option>
                              <option value="won">Won</option>
                              <option value="lost">Lost</option>
                            </select>
                          </td>
                          <td>{latestRecommendation?.preferred_channel || '-'}</td>
                          <td>
                            {latestRecommendation?.best_contact_window_start
                              ? new Date(latestRecommendation.best_contact_window_start).toLocaleString()
                              : '-'}
                          </td>
                        </tr>
                      )
                    }) : (
                      <tr>
                        <td colSpan="7">No leads yet. Upload a CSV to create live opportunities.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="panel lead-detail-panel" style={{ marginTop: '20px' }}>
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Lead detail</p>
                  <h3>{selectedLead ? `${selectedLead.first_name} ${selectedLead.last_name}`.trim() : 'Select a lead'}</h3>
                </div>
                <span className="panel-badge">Live prediction, recommendation, and activity history</span>
              </div>

              {selectedLead ? (
                <div className="detail-grid">
                  <div className="detail-card">
                    <h4>Profile</h4>
                    <p><strong>Company:</strong> {selectedLead.company_name}</p>
                    <p><strong>Role:</strong> {selectedLead.job_title || '-'}</p>
                    <p><strong>Industry:</strong> {selectedLead.industry || '-'}</p>
                    <p><strong>Status:</strong> {selectedLead.status}</p>
                    <p><strong>Email:</strong> {selectedLead.email || '-'}</p>
                  </div>

                  <div className="detail-card">
                    <h4>Latest prediction</h4>
                    {getLatestPrediction(selectedLead) ? (
                      <>
                        <p><strong>Score:</strong> {getLatestPrediction(selectedLead).score}</p>
                        <p><strong>Intent:</strong> {getLatestPrediction(selectedLead).intent_bucket}</p>
                        <p>{getLatestPrediction(selectedLead).explanation}</p>
                      </>
                    ) : (
                      <p>No prediction has been generated for this lead yet.</p>
                    )}
                  </div>

                  <div className="detail-card">
                    <h4>Latest recommendation</h4>
                    {getLatestRecommendation(selectedLead) ? (
                      <>
                        <p><strong>Channel:</strong> {getLatestRecommendation(selectedLead).preferred_channel}</p>
                        <p>
                          <strong>Window:</strong>{' '}
                          {getLatestRecommendation(selectedLead).best_contact_window_start
                            ? new Date(getLatestRecommendation(selectedLead).best_contact_window_start).toLocaleString()
                            : '-'}
                        </p>
                        <p>{getLatestRecommendation(selectedLead).rationale}</p>
                      </>
                    ) : (
                      <p>No recommendation has been generated for this lead yet.</p>
                    )}
                  </div>

                  <div className="detail-card">
                    <h4>Activity history</h4>
                    {selectedLead.activities?.length ? (
                      <ul className="activity-list">
                        {selectedLead.activities.slice(0, 5).map((activity) => (
                          <li key={activity.id}>
                            <strong>{activity.activity_type}</strong>
                            <span>{activity.channel || 'n/a'}</span>
                            <span>{activity.occurred_at ? new Date(activity.occurred_at).toLocaleString() : '-'}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No activity history yet.</p>
                    )}
                  </div>

                  <div className="detail-card detail-actions">
                    <h4>Actions</h4>
                    {leadActionError ? <p className="form-error">{leadActionError}</p> : null}
                    <button className="primary-button" type="button" onClick={() => handleLeadAction('predict')} disabled={leadActionLoading}>
                      {leadActionLoading ? 'Updating...' : 'Re-score lead'}
                    </button>
                    <button className="primary-button" type="button" onClick={() => handleLeadAction('recommend')} disabled={leadActionLoading}>
                      {leadActionLoading ? 'Updating...' : 'Refresh recommendation'}
                    </button>
                    <button className="primary-button" type="button" onClick={handleGenerateCopilot} disabled={copilotLoading || leadActionLoading}>
                      {copilotLoading ? 'Generating...' : 'Generate copilot'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="empty-state">No lead selected.</p>
              )}
            </section>
          </div>
        )}

        {activeTab === 'copilot' && isSales && (
          <div id="copilot">
            <header className="hero">
              <div>
                <p className="eyebrow">Sales Copilot</p>
                <h2>AI Outreach Assistant</h2>
                {dashboardError ? <p className="form-error">{dashboardError}</p> : null}
              </div>
            </header>

            <div className="split-grid">
              <article className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">AI Copilot</p>
                    <h3>LLM-generated outreach, call prep, and follow-ups</h3>
                  </div>
                </div>
                <div className="copilot-controls">
                  <label>
                    Lead
                    <select value={selectedLeadId} onChange={(event) => setSelectedLeadId(event.target.value)}>
                      {leads.length ? leads.map((lead) => (
                        <option key={lead.id} value={lead.id}>
                          {lead.first_name} {lead.last_name} - {lead.company_name}
                        </option>
                      )) : (
                        <option value="">No leads available</option>
                      )}
                    </select>
                  </label>
                  <button className="primary-button" type="button" onClick={handleGenerateCopilot} disabled={!selectedLead || copilotLoading}>
                    {copilotLoading ? 'Generating...' : 'Generate Copilot'}
                  </button>
                </div>
                <div className="copilot-card">
                  {copilotResult ? (
                    <>
                      <p><strong>Subject:</strong> {copilotResult.subject}</p>
                      <p style={{ whiteSpace: 'pre-wrap' }}>{copilotResult.email_body}</p>
                      <h4>Call prep</h4>
                      <ul>
                        {copilotResult.call_prep?.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                      <h4>Talking points</h4>
                      <ul>
                        {copilotResult.talking_points?.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                      <h4>Follow-up</h4>
                      <p>{copilotResult.follow_up_message}</p>
                    </>
                  ) : (
                    <p>Select a lead and generate outreach assets from its engagement history.</p>
                  )}
                </div>
              </article>

              <article className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Daily AI Insights</p>
                    <h3>Signals worth acting on today</h3>
                  </div>
                </div>
                <ul className="insight-list">
                  {(summary.daily_ai_insights?.length ? summary.daily_ai_insights : insights).map((insight) => (
                    <li key={insight}>{insight}</li>
                  ))}
                </ul>
              </article>
            </div>
          </div>
        )}

        {activeTab === 'users' && isSystemAdmin && (
          <div id="users">
            <header className="hero">
              <div>
                <p className="eyebrow">Administration</p>
                <h2>User Role and Verification Management</h2>
                {userMgmtError ? <p className="form-error">{userMgmtError}</p> : null}
              </div>
            </header>

            <section className="panel table-panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Users list</p>
                  <h3>Manage access and verification</h3>
                </div>
                <span className="panel-badge">Verify registered accounts to allow login</span>
              </div>
              {userMgmtLoading ? (
                <p>Loading user list...</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersList.length ? usersList.map((targetUser) => (
                        <tr key={targetUser.id}>
                          <td>{targetUser.username}</td>
                          <td>{targetUser.email}</td>
                          <td>
                            <select
                              value={targetUser.role}
                              onChange={(event) => handleUserRoleChange(targetUser.id, event.target.value)}
                              className="status-select"
                            >
                              <option value="sales_representative">Sales Representative</option>
                              <option value="sales_manager">Sales Manager</option>
                              <option value="marketing_executive">Marketing Executive</option>
                              <option value="system_administrator">System Administrator</option>
                            </select>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span className={`intent intent-${targetUser.is_active ? 'high' : 'low'}`}>
                                {targetUser.is_active ? 'Verified' : 'Pending'}
                              </span>
                              {targetUser.is_locked_by_admin && (
                                <span className="intent intent-low" style={{ background: '#FEE2E2', color: '#EF4444', border: '1px solid #FCA5A5' }}>
                                  Locked (Admin)
                                </span>
                              )}
                              {!targetUser.is_locked_by_admin && targetUser.locked_until && new Date(targetUser.locked_until) > new Date() && (
                                <span className="intent intent-medium" style={{ background: '#FEF3C7', color: '#D97706', border: '1px solid #FCD34D' }}>
                                  Locked (Temp)
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                className="primary-button"
                                type="button"
                                onClick={() => handleUserVerifyToggle(targetUser)}
                                style={{ height: '28px', padding: '0 10px', fontSize: '12px' }}
                              >
                                {targetUser.is_active ? 'Unverify' : 'Verify & Activate'}
                              </button>
                              {(targetUser.is_locked_by_admin || (targetUser.locked_until && new Date(targetUser.locked_until) > new Date())) && (
                                <button
                                  className="primary-button"
                                  type="button"
                                  onClick={() => handleUserUnlock(targetUser.id)}
                                  style={{ height: '28px', padding: '0 10px', fontSize: '12px', background: '#EF4444', borderColor: '#EF4444', color: 'white' }}
                                >
                                  Unlock
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan="5">No users found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* Fallback Access Forbidden Page */}
        {((activeTab === 'dashboard' || activeTab === 'opportunities' || activeTab === 'copilot') && !isSales) ||
         ((activeTab === 'uploads') && !isMarketing) ||
         ((activeTab === 'users') && !isSystemAdmin) ? (
          <div className="panel" style={{ textAlign: 'center', padding: '40px' }}>
            <h2 style={{ color: 'var(--color-ember)' }}>Access Denied</h2>
            <p>You do not have the required permissions to access this page.</p>
          </div>
        ) : null}
      </main>
    </div>
  )
}

export default App
