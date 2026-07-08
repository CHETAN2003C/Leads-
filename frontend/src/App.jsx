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

  async function loadWorkspace() {
    setDashboardError('')
    try {
      const [dashboard, uploadList, leadList] = await Promise.all([getDashboardSummary(), listUploads(), listLeads()])
      setSummary(dashboard)
      setUploads(Array.isArray(uploadList) ? uploadList : [])
      setUploadCount(Array.isArray(uploadList) ? uploadList.length : 0)
      setLeads(Array.isArray(leadList) ? leadList : [])
      if (!selectedLeadId && Array.isArray(leadList) && leadList.length > 0) {
        setSelectedLeadId(leadList[0].id)
      }
    } catch (error) {
      setDashboardError(error.message || 'Unable to load dashboard data.')
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
          await loadWorkspace()
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
      const nextUser = await login(loginForm.username, loginForm.password)
      setUser(nextUser)
      await loadWorkspace()
    } catch (error) {
      setAuthError(error.message || 'Login failed.')
    } finally {
      setLoginSubmitting(false)
    }
  }

  async function handleLogout() {
    try {
      await logout()
    } finally {
      setUser(null)
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
            <button className="primary-button" type="submit" disabled={loginSubmitting}>
              {loginSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </section>
      </div>
    )
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">LeadPulse</p>
          <h1>Revenue intelligence for the leads your team already has.</h1>
        </div>
        <nav className="sidebar-nav" aria-label="Primary">
          <a href="#dashboard">Dashboard</a>
          <a href="#uploads">CSV Upload</a>
          <a href="#opportunities">Top Opportunities</a>
          <a href="#copilot">AI Copilot</a>
        </nav>
        <div className="sidebar-panel">
          <span>Signed in as</span>
          <strong>{user.username}</strong>
          <p>{user.role}</p>
          <button className="link-button" type="button" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="content" id="dashboard">
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

        <section className="panel upload-panel" id="uploads">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Ingestion</p>
              <h3>CSV upload with server-side schema validation</h3>
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

        <section className="panel table-panel" id="opportunities">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Recommendations</p>
              <h3>Top opportunities and next contact windows</h3>
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
                  return (
                    <tr key={lead.id}>
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

        <section className="panel lead-detail-panel" id="lead-detail">
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

        <section className="split-grid" id="copilot">
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
                  <p>{copilotResult.email_body}</p>
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
              {(summary.daily_ai_insights.length ? summary.daily_ai_insights : insights).map((insight) => (
                <li key={insight}>{insight}</li>
              ))}
            </ul>
          </article>
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
      </main>
    </div>
  )
}

export default App
