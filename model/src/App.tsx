import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileVideo,
  ImagePlus,
  LocateFixed,
  MapPin,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react'

const apiUrl = import.meta.env.VITE_TRANSIT_API_URL ?? 'http://localhost:4000/api'
const publicApiUrl = apiUrl.replace(/\/api\/?$/, '')

type PriorityLevel = 'Low' | 'Medium' | 'High' | 'Critical'

type ScanResult = {
  ticketId: string
  issueType: string
  confidence: number
  potholeCount: number
  estimatedDiameterCm: number | null
  diameterSource: string
  priorityScore: number
  priorityLevel: PriorityLevel
  status: string
  modelMode: 'roboflow' | 'demo' | string
  note: string | null
  municipality: {
    name: string
    wardNumber: string
    wardName: string
    department: string
    contactName: string
  } | null
}

type RoadReport = {
  ticketId: string
  issueType: string
  priorityScore: number
  priorityLevel: PriorityLevel
  status: string
  confidence: number
  potholeCount: number
  photoPath: string
  createdAt: string
  municipalityName: string | null
  wardNumber: string | null
}

type FormValues = {
  driverId: string
  busId: string
  routeId: string
  latitude: string
  longitude: string
  trafficLevel: 'Low' | 'Medium' | 'High'
  nearSensitiveSite: boolean
  potholeDiameterCm: string
  demoIssueType: string
}

const initialForm: FormValues = {
  driverId: 'DRV-101',
  busId: 'DL 1PC 4821',
  routeId: '522',
  latitude: '28.6139',
  longitude: '77.2090',
  trafficLevel: 'Medium',
  nearSensitiveSite: false,
  potholeDiameterCm: '',
  demoIssueType: 'pothole',
}

function formatIssue(issue: string) {
  return issue.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function priorityClass(priority: PriorityLevel) {
  return priority.toLowerCase()
}

function statusLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function createFrameFromVideo(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.src = objectUrl

    const cleanup = () => URL.revokeObjectURL(objectUrl)
    video.onerror = () => {
      cleanup()
      reject(new Error('This video could not be read. Please use an MP4, MOV, or WEBM video.'))
    }
    video.onloadedmetadata = () => {
      const safeDuration = Number.isFinite(video.duration) ? video.duration : 1
      video.currentTime = Math.min(Math.max(safeDuration * 0.25, 0.1), Math.max(safeDuration - 0.1, 0.1))
    }
    video.onseeked = () => {
      const longestSide = Math.max(video.videoWidth, video.videoHeight)
      const scale = longestSide > 1280 ? 1280 / longestSide : 1
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
      canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => {
        cleanup()
        if (!blob) {
          reject(new Error('Could not create an image frame from this video.'))
          return
        }
        resolve(new File([blob], `${file.name.replace(/\.[^.]+$/, '')}-frame.jpg`, { type: 'image/jpeg' }))
      }, 'image/jpeg', 0.88)
    }
  })
}

export default function App() {
  const [form, setForm] = useState<FormValues>(initialForm)
  const [media, setMedia] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isVideo, setIsVideo] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [reports, setReports] = useState<RoadReport[]>([])
  const [isLoadingReports, setIsLoadingReports] = useState(false)

  const acceptedHelp = useMemo(
    () => isVideo ? 'A clear image frame at 25% of the video will be scanned.' : 'Use a clear, close image of the road problem.',
    [isVideo],
  )

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  async function loadReports() {
    setIsLoadingReports(true)
    try {
      const response = await fetch(`${apiUrl}/road-reports`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Could not load saved road tickets.')
      setReports(data.roadReports ?? [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load saved road tickets.')
    } finally {
      setIsLoadingReports(false)
    }
  }

  useEffect(() => {
    void loadReports()
  }, [])

  function updateField<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function chooseMedia(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    if (!file) return
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setMedia(file)
    setPreviewUrl(URL.createObjectURL(file))
    setIsVideo(file.type.startsWith('video/'))
    setResult(null)
    setError(null)
  }

  function removeMedia() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setMedia(null)
    setPreviewUrl(null)
    setIsVideo(false)
  }

  function getLocation() {
    if (!navigator.geolocation) {
      setError('This browser does not support GPS. Enter latitude and longitude manually.')
      return
    }
    setIsLocating(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        updateField('latitude', coords.latitude.toFixed(6))
        updateField('longitude', coords.longitude.toFixed(6))
        setIsLocating(false)
      },
      () => {
        setError('Location permission was not given. Enter latitude and longitude manually.')
        setIsLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  async function submitScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!media) {
      setError('Select an image or video first.')
      return
    }
    setIsSubmitting(true)
    setError(null)
    setResult(null)
    try {
      const imageForModel = isVideo ? await createFrameFromVideo(media) : media
      const request = new FormData()
      request.append('photo', imageForModel)
      request.append('driverId', form.driverId)
      request.append('busId', form.busId)
      request.append('routeId', form.routeId)
      request.append('latitude', form.latitude)
      request.append('longitude', form.longitude)
      request.append('trafficLevel', form.trafficLevel)
      request.append('nearSensitiveSite', String(form.nearSensitiveSite))
      if (form.potholeDiameterCm) request.append('potholeDiameterCm', form.potholeDiameterCm)
      if (form.demoIssueType) request.append('demoIssueType', form.demoIssueType)

      const response = await fetch(`${apiUrl}/road-condition`, { method: 'POST', body: request })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'The road scan could not be completed.')
      setResult(data)
      await loadReports()
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : 'The road scan could not be completed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function updateTicket(ticketId: string, status: 'in_progress' | 'resolved') {
    setError(null)
    try {
      const response = await fetch(`${apiUrl}/road-reports/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Could not update ticket.')
      await loadReports()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update ticket.')
    }
  }

  return (
    <main>
      <header className="topbar">
        <div className="brand"><ScanSearch size={24} /><span>Urban<span>IQ</span></span></div>
        <div className="header-label"><ShieldCheck size={16} /> Municipal road intelligence</div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">ROAD AI SCANNER</p>
          <h1>Turn a road photo into an action ticket.</h1>
          <p className="hero-copy">Upload a manual image or video. The model finds the issue, calculates urgency, and sends it to the matching municipal ward.</p>
        </div>
        <div className="flow" aria-label="Upload to municipality flow">
          <span>Upload</span><ChevronRight size={17} /><span>AI scan</span><ChevronRight size={17} /><span>Ward ticket</span>
        </div>
      </section>

      <div className="layout">
        <form className="scan-card" onSubmit={submitScan}>
          <div className="card-title">
            <div><p className="eyebrow">NEW REPORT</p><h2>Upload road evidence</h2></div>
            <span className="step">01</span>
          </div>

          <label className="upload-zone" htmlFor="media-upload">
            {previewUrl ? (
              <>
                {isVideo ? <video src={previewUrl} muted controls /> : <img src={previewUrl} alt="Selected road evidence" />}
                <button type="button" className="remove-media" aria-label="Remove selected file" onClick={(event) => { event.preventDefault(); removeMedia() }}><X size={18} /></button>
              </>
            ) : (
              <><div className="upload-icon"><Upload size={28} /></div><strong>Choose image or video</strong><span>JPG, PNG, WEBP, MP4, MOV or WEBM</span></>
            )}
          </label>
          <input id="media-upload" className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" onChange={chooseMedia} />
          <p className="upload-help">{acceptedHelp}</p>

          <div className="field-grid identity-fields">
            <label>Driver ID<input required value={form.driverId} onChange={(event) => updateField('driverId', event.target.value)} /></label>
            <label>Bus number<input value={form.busId} onChange={(event) => updateField('busId', event.target.value)} /></label>
            <label>Route<input value={form.routeId} onChange={(event) => updateField('routeId', event.target.value)} /></label>
          </div>

          <div className="divider" />
          <div className="location-heading"><div><MapPin size={18} /><strong>Problem location</strong></div><button type="button" className="location-button" onClick={getLocation} disabled={isLocating}><LocateFixed size={15} />{isLocating ? 'Finding…' : 'Use my GPS'}</button></div>
          <div className="field-grid two-columns">
            <label>Latitude<input required inputMode="decimal" value={form.latitude} onChange={(event) => updateField('latitude', event.target.value)} /></label>
            <label>Longitude<input required inputMode="decimal" value={form.longitude} onChange={(event) => updateField('longitude', event.target.value)} /></label>
          </div>

          <div className="field-grid two-columns options-grid">
            <label>Traffic level<select value={form.trafficLevel} onChange={(event) => updateField('trafficLevel', event.target.value as FormValues['trafficLevel'])}><option>Low</option><option>Medium</option><option>High</option></select></label>
            <label>Pothole diameter (cm)<input inputMode="decimal" placeholder="Optional measured size" value={form.potholeDiameterCm} onChange={(event) => updateField('potholeDiameterCm', event.target.value)} /></label>
          </div>
          <label className="check-row"><input type="checkbox" checked={form.nearSensitiveSite} onChange={(event) => updateField('nearSensitiveSite', event.target.checked)} /><span>Near a school, hospital, or high-risk location</span></label>

          <details className="demo-options">
            <summary>SIH demo option</summary>
            <p>Use this only when the Roboflow model is not yet configured. A real model ignores this selection.</p>
            <label>Demo issue type<select value={form.demoIssueType} onChange={(event) => updateField('demoIssueType', event.target.value)}><option value="pothole">Pothole</option><option value="garbage">Garbage</option><option value="flooding">Flooding</option><option value="road_blockage">Road blockage</option><option value="accident">Accident</option></select></label>
          </details>

          <button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? <RefreshCw className="spin" size={18} /> : <ScanSearch size={18} />}{isSubmitting ? 'Analyzing road…' : 'Analyze and create ticket'}</button>
        </form>

        <aside className="result-column">
          {error && <div className="error-box"><AlertTriangle size={19} /><div><strong>Could not complete the request</strong><p>{error}</p></div></div>}
          {result ? <ResultCard result={result} /> : <EmptyResult />}
          <div className="how-card"><p className="eyebrow">WHAT IS SAVED</p><div><ImagePlus size={18} /><span>Photo and model detections</span></div><div><MapPin size={18} /><span>GPS, ward and municipality</span></div><div><AlertTriangle size={18} /><span>Priority, count and size estimate</span></div><div><Clock3 size={18} /><span>Ticket status and time</span></div></div>
        </aside>
      </div>

      <section className="tickets-section">
        <div className="section-heading"><div><p className="eyebrow">SQLITE ROAD_REPORTS</p><h2>Saved municipal tickets</h2></div><button type="button" className="refresh-button" onClick={() => void loadReports()} disabled={isLoadingReports}><RefreshCw className={isLoadingReports ? 'spin' : ''} size={17} /> Refresh</button></div>
        {reports.length ? <div className="ticket-list">{reports.map((report) => <TicketRow key={report.ticketId} report={report} onUpdate={updateTicket} />)}</div> : <div className="empty-tickets">No road tickets yet. Upload an image to create the first one.</div>}
      </section>
    </main>
  )
}

function EmptyResult() {
  return <section className="result-card empty-result"><div className="result-icon"><FileVideo size={28} /></div><p className="eyebrow">AI RESULT</p><h2>Waiting for a scan</h2><p>Choose a clear photo or video, add GPS, then click analyze. The ticket result will appear here.</p></section>
}

function ResultCard({ result }: { result: ScanResult }) {
  return <section className="result-card">
    <div className="result-top"><div><p className="eyebrow">AI RESULT</p><h2>{result.issueType} detected</h2></div><span className={`priority ${priorityClass(result.priorityLevel)}`}>{result.priorityLevel}</span></div>
    {result.modelMode === 'demo' && <div className="demo-banner"><AlertTriangle size={16} /> Demo result — not a real AI prediction.</div>}
    <div className="score-row"><div><strong>{result.priorityScore}</strong><span>/ 100 priority</span></div><div><strong>{result.confidence}%</strong><span>confidence</span></div></div>
    <div className="metric-grid"><Metric label="Potholes" value={String(result.potholeCount)} /><Metric label="Largest size" value={result.estimatedDiameterCm ? `${result.estimatedDiameterCm} cm` : 'Measure on site'} /></div>
    <div className="ticket-id"><CheckCircle2 size={18} /><div><span>Ticket created</span><strong>{result.ticketId}</strong></div></div>
    {result.municipality ? <div className="municipality"><p>ROUTED TO</p><strong>{result.municipality.name}</strong><span>Ward {result.municipality.wardNumber} · {result.municipality.wardName}</span><span>{result.municipality.department}</span></div> : <div className="municipality unassigned"><p>ROUTING REQUIRED</p><strong>No matching ward boundary</strong><span>Add the official ward GeoJSON for this location.</span></div>}
    <p className="diameter-note">Size: {result.diameterSource}</p>
  </section>
}

function Metric({ label, value }: { label: string, value: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>
}

function TicketRow({ report, onUpdate }: { report: RoadReport, onUpdate: (ticketId: string, status: 'in_progress' | 'resolved') => Promise<void> }) {
  const [isUpdating, setIsUpdating] = useState(false)
  const update = async (status: 'in_progress' | 'resolved') => {
    setIsUpdating(true)
    await onUpdate(report.ticketId, status)
    setIsUpdating(false)
  }
  return <article className="ticket-row">
    {report.photoPath ? <img src={`${publicApiUrl}${report.photoPath}`} alt={`${formatIssue(report.issueType)} evidence`} /> : <div className="ticket-photo"><ImagePlus size={20} /></div>}
    <div className="ticket-main"><div className="ticket-title"><strong>{formatIssue(report.issueType)}</strong><span className={`priority ${priorityClass(report.priorityLevel)}`}>{report.priorityLevel} · {report.priorityScore}</span></div><span>{report.ticketId} · {report.confidence}% confidence · {new Date(report.createdAt).toLocaleString()}</span><small>{report.municipalityName ? `${report.municipalityName} · Ward ${report.wardNumber}` : 'Ward routing required'}</small></div>
    <div className="ticket-actions"><span className="status">{statusLabel(report.status)}</span>{report.status === 'open' && <button type="button" disabled={isUpdating} onClick={() => void update('in_progress')}>Start work</button>}{report.status !== 'resolved' && <button type="button" className="resolve" disabled={isUpdating} onClick={() => void update('resolved')}>Resolve</button>}</div>
  </article>
}
