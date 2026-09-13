import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Bell, Bus, Check, ChevronDown, CircleHelp, Clock3, LayoutDashboard, LocateFixed, Map, Menu, MoreHorizontal, Radio, RefreshCw, Route, Settings, ShieldCheck, Sparkles, UsersRound, Wrench, X } from 'lucide-react'
import { GOOGLE_MAPS_API_KEY, TRANSIT_API_URL } from './config'

type AlertType = 'critical' | 'warning' | 'info'
type Page = 'Overview' | 'Live fleet' | 'Routes' | 'Alerts' | 'Road issues' | 'Maintenance' | 'Settings'
type StoredAccount = { name: string; email: string; passwordHash: string }
type RouteData = { id: string; name: string; buses: number; onTime: number; crowd: 'Low' | 'Medium' | 'High'; tone: string }
type FleetBus = { id: string; route: string; status: string; location: string; eta: string; tone: string; crowd?: string | null; latitude?: number | null; longitude?: number | null }
type LatLng = { lat: number; lng: number }
type DashboardSummary = { totalBuses: number; activeBuses: number; breakdowns: number; busesNeedingAttention: number; openAlerts: number; openRoadIssues: number }
type RoadReport = {
  ticketId: string; issueType: string; confidence: number; predictionCount: number; potholeCount: number
  maxPotholeDiameterCm: number | null; diameterSource: string; priorityScore: number; priorityLevel: 'Low' | 'Medium' | 'High' | 'Critical'
  trafficLevel: string; nearSensitiveSite: boolean; repeatedReports: number; photoPath: string; modelMode: 'roboflow' | 'demo'; modelNote: string | null
  latitude: number; longitude: number; status: 'open' | 'assigned' | 'in_progress' | 'resolved'; assignedTo: string | null; createdAt: string
  wardNumber: string | null; wardName: string | null; municipalityName: string | null; departmentName: string | null; contactName: string | null
}
type DashboardPayload = {
  updatedAt: string
  summary: DashboardSummary
  buses: { busId: string; routeId: string | null; latitude: number | null; longitude: number | null; speedKmph: number | null; passengerCount: number | null; crowdLevel: string | null; healthStatus: string; status: string; lastSeenAt: string | null }[]
  alerts: { id: number; busId: string | null; driverId: string; routeId: string | null; issueType: string; severity: string; description: string | null; isEmergency: number; reportedAt: string }[]
  routePerformance: { routeId: string; buses: number; averageSpeedKmph: number | null; crowdedBuses: number; breakdowns: number }[]
  roadReports: RoadReport[]
}

declare global { interface Window { google?: any } }

const initialRoutes: RouteData[] = [
  { id: 'R-12', name: 'Delhi → Hapur', buses: 18, onTime: 92, crowd: 'Medium', tone: 'blue' },
  { id: 'R-07', name: 'Airport → City Market', buses: 14, onTime: 79, crowd: 'High', tone: 'orange' },
  { id: 'R-21', name: 'University → Railway Station', buses: 11, onTime: 88, crowd: 'Low', tone: 'green' },
  { id: 'R-04', name: 'Old City → Civil Hospital', buses: 9, onTime: 71, crowd: 'High', tone: 'red' },
  { id: 'R-18', name: 'North Terminal → Riverfront', buses: 12, onTime: 86, crowd: 'Medium', tone: 'blue' },
  { id: 'R-33', name: 'East Depot → Innovation District', buses: 10, onTime: 90, crowd: 'Low', tone: 'green' },
  { id: 'R-09', name: 'South Gate → Central Station', buses: 13, onTime: 76, crowd: 'High', tone: 'orange' },
  { id: 'R-26', name: 'Museum Quarter → Airport', buses: 8, onTime: 84, crowd: 'Medium', tone: 'blue' },
]
const initialAlerts: { id: number; type: AlertType; title: string; detail: string; time: string }[] = [
  { id: 1, type: 'critical', title: 'Breakdown reported', detail: 'Bus DL-01-AB-4128 · Route R-04', time: '2 min ago' },
  { id: 2, type: 'warning', title: 'Heavy traffic detected', detail: 'Ring Road near City Market · Route R-07', time: '8 min ago' },
  { id: 3, type: 'warning', title: 'Overcrowding alert', detail: 'Bus DL-01-AB-3381 · Route R-12', time: '13 min ago' },
  { id: 4, type: 'info', title: 'Maintenance due tomorrow', detail: 'Bus DL-01-AB-2047 · Engine inspection', time: '24 min ago' },
]
const arrivals = [
  { route: 'R-12', destination: 'Hapur', time: '3 min', occupancy: 62, tone: 'blue' },
  { route: 'R-07', destination: 'Airport', time: '7 min', occupancy: 89, tone: 'orange' },
  { route: 'R-21', destination: 'Railway Station', time: '11 min', occupancy: 38, tone: 'green' },
]
const initialFleet: FleetBus[] = [
  { id: 'DL-01-AB-3381', route: 'R-12', status: 'On route', location: 'Delhi', eta: '3 min', tone: 'blue' },
  { id: 'DL-01-AB-7264', route: 'R-07', status: 'Delayed 9 min', location: 'City Market', eta: '12 min', tone: 'orange' },
  { id: 'DL-01-AB-2047', route: 'R-21', status: 'Maintenance due', location: 'University', eta: '11 min', tone: 'green' },
  { id: 'DL-01-AB-4128', route: 'R-04', status: 'Breakdown', location: 'Civil Hospital', eta: '—', tone: 'red' },
  { id: 'DL-01-AB-5560', route: 'R-18', status: 'On route', location: 'North Terminal', eta: '6 min', tone: 'blue' },
  { id: 'DL-01-AB-6614', route: 'R-33', status: 'On route', location: 'Innovation District', eta: '8 min', tone: 'green' },
  { id: 'DL-01-AB-9122', route: 'R-09', status: 'Delayed 5 min', location: 'South Gate', eta: '14 min', tone: 'orange' },
  { id: 'DL-01-AB-3750', route: 'R-26', status: 'On route', location: 'Museum Quarter', eta: '5 min', tone: 'blue' },
]
const routePaths: Record<string, LatLng[]> = {
  'R-12': [{ lat: 28.6139, lng: 77.209 }, { lat: 28.677, lng: 77.242 }, { lat: 28.7306, lng: 77.7759 }], // Delhi → Hapur
  'R-07': [{ lat: 28.5562, lng: 77.1 }, { lat: 28.6139, lng: 77.209 }, { lat: 28.6506, lng: 77.2315 }],
  'R-21': [{ lat: 28.5672, lng: 77.21 }, { lat: 28.6139, lng: 77.209 }, { lat: 28.6424, lng: 77.188 }],
  'R-04': [{ lat: 28.6506, lng: 77.2315 }, { lat: 28.6201, lng: 77.235 }, { lat: 28.6139, lng: 77.209 }],
  'R-18': [{ lat: 28.7041, lng: 77.1025 }, { lat: 28.67, lng: 77.15 }, { lat: 28.61, lng: 77.21 }],
  'R-33': [{ lat: 28.7041, lng: 77.1025 }, { lat: 28.67, lng: 77.18 }, { lat: 28.61, lng: 77.25 }],
  'R-09': [{ lat: 28.52, lng: 77.2 }, { lat: 28.57, lng: 77.21 }, { lat: 28.6139, lng: 77.209 }],
  'R-26': [{ lat: 28.5665, lng: 77.1031 }, { lat: 28.61, lng: 77.19 }, { lat: 28.5562, lng: 77.1 }],
}
const routeColors: Record<string, string> = { 'R-12': '#2563eb', 'R-07': '#f97316', 'R-21': '#16a36a', 'R-04': '#dc4f54', 'R-18': '#7c5ce6', 'R-33': '#0ea5a4', 'R-09': '#e7a72f', 'R-26': '#3b82f6' }
const pageCopy: Record<Exclude<Page, 'Overview'>, { title: string; description: string }> = {
  'Live fleet': { title: 'Live fleet monitoring', description: 'Track active buses, route progress, and live exceptions.' },
  Routes: { title: 'Route performance', description: 'Use AI-supported service data to find routes that need attention.' },
  Alerts: { title: 'Priority alerts', description: 'Review breakdowns, delays, crowding, and maintenance notices.' },
  'Road issues': { title: 'Road-condition tickets', description: 'Review AI-detected road problems and route each ticket to the responsible municipal team.' },
  Maintenance: { title: 'Maintenance control', description: 'Plan preventive repair before a bus loses service.' },
  Settings: { title: 'Dashboard settings', description: 'Set how this command center receives fleet updates.' },
}

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  return `${Math.floor(seconds / 3600)} hr ago`
}

function fleetTone(bus: DashboardPayload['buses'][number]) {
  if (bus.status === 'Breakdown' || bus.status === 'Emergency' || bus.healthStatus === 'Critical') return 'red'
  if (bus.healthStatus === 'Needs Attention' || bus.crowdLevel === 'High') return 'orange'
  return 'green'
}

function alertType(alert: DashboardPayload['alerts'][number]): AlertType {
  if (alert.isEmergency || alert.severity === 'Critical') return 'critical'
  if (alert.severity === 'High' || alert.issueType.toLowerCase().includes('traffic')) return 'warning'
  return 'info'
}

function App() {
  const [signedInEmail, setSignedInEmail] = useState(() => sessionStorage.getItem('urbaniq-session-email') ?? '')
  const [signedInName, setSignedInName] = useState(() => sessionStorage.getItem('urbaniq-session-name') ?? '')
  const signIn = (email: string, name: string) => { sessionStorage.setItem('urbaniq-session-email', email); sessionStorage.setItem('urbaniq-session-name', name); setSignedInEmail(email); setSignedInName(name) }
  const signOut = () => { sessionStorage.removeItem('urbaniq-session-email'); sessionStorage.removeItem('urbaniq-session-name'); setSignedInEmail(''); setSignedInName('') }

  return signedInEmail ? <Dashboard email={signedInEmail} name={signedInName} onLogout={signOut} /> : <LoginPage onLogin={signIn} />
}

function Dashboard({ email, name, onLogout }: { email: string; name: string; onLogout: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [activePage, setActivePage] = useState<Page>('Overview')
  const [selectedRoute, setSelectedRoute] = useState('All routes')
  const [updatedAt, setUpdatedAt] = useState('Just now')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [alerts, setAlerts] = useState(initialAlerts)
  const [arrivalsOpen, setArrivalsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [fleetLocated, setFleetLocated] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [automationEnabled, setAutomationEnabled] = useState(true)
  const [routeData, setRouteData] = useState<RouteData[]>(initialRoutes)
  const [fleetData, setFleetData] = useState<FleetBus[]>(initialFleet)
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [roadReports, setRoadReports] = useState<RoadReport[]>([])
  const [apiConnected, setApiConnected] = useState(false)
  const userName = name || email.split('@')[0].replace(/[._-]/g, ' ')
  const initials = userName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'U'
  const displayedRoutes = useMemo(() => selectedRoute === 'All routes' ? routeData : routeData.filter((route) => route.id === selectedRoute), [selectedRoute, routeData])
  const visibleFleet = useMemo(() => selectedRoute === 'All routes' ? fleetData : fleetData.filter((bus) => bus.route === selectedRoute), [selectedRoute, fleetData])
  const aiPlan = useMemo(() => {
    const route = [...routeData].sort((a, b) => a.onTime - b.onTime)[0]
    const action = route.crowd === 'High' ? 'dispatch one standby bus and prioritize signal clearance' : 'rebalance headways to protect service reliability'
    return { route, action, impact: Math.min(8, 94 - route.onTime) }
  }, [routeData])
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2600) }
  const loadLiveData = useCallback(async (announce = false) => {
    if (announce) setIsRefreshing(true)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 5000)
    try {
      const response = await fetch(`${TRANSIT_API_URL}/dashboard`, { signal: controller.signal })
      if (!response.ok) throw new Error('Dashboard API is unavailable')
      const payload = await response.json() as DashboardPayload
      const liveFleet = payload.buses.map((bus) => ({
        id: bus.busId,
        route: bus.routeId ?? 'Unassigned',
        status: bus.status,
        location: bus.latitude === null || bus.longitude === null ? 'Location unavailable' : `${bus.latitude.toFixed(4)}, ${bus.longitude.toFixed(4)}`,
        eta: bus.status === 'Breakdown' ? '—' : 'Live',
        tone: fleetTone(bus),
        crowd: bus.crowdLevel,
        latitude: bus.latitude,
        longitude: bus.longitude,
      }))
      const liveRoutes = payload.routePerformance.map((route) => {
        const onTime = Math.max(50, Math.min(100, 100 - route.breakdowns * 30 - route.crowdedBuses * 5))
        const crowd = route.crowdedBuses > 0 ? 'High' : route.buses > 2 ? 'Medium' : 'Low'
        return { id: route.routeId, name: 'Live fleet route', buses: route.buses, onTime, crowd: crowd as RouteData['crowd'], tone: route.breakdowns > 0 ? 'red' : crowd === 'High' ? 'orange' : 'green' }
      })
      const liveAlerts = payload.alerts.map((alert) => ({
        id: alert.id,
        type: alertType(alert),
        title: alert.issueType,
        detail: `${alert.busId ? `Bus ${alert.busId}` : 'Bus not assigned'} · Route ${alert.routeId ?? 'not assigned'}${alert.description ? ` · ${alert.description}` : ''}`,
        time: relativeTime(alert.reportedAt),
      }))
      if (liveFleet.length) setFleetData(liveFleet)
      if (liveRoutes.length) setRouteData(liveRoutes)
      setAlerts(liveAlerts)
      setSummary(payload.summary)
      setRoadReports(payload.roadReports ?? [])
      setUpdatedAt(new Date(payload.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
      setApiConnected(true)
      if (announce) notify('Live data loaded from the shared transport server')
    } catch {
      setApiConnected(false)
      if (announce) notify('Could not reach the shared transport server')
    } finally {
      window.clearTimeout(timeout)
      if (announce) setIsRefreshing(false)
    }
  }, [])
  const navigate = (page: Page) => { setActivePage(page); setMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const refreshData = () => { void loadLiveData(true) }
  const runAutomation = (announce: boolean) => { void loadLiveData(announce) }
  const applyAiPlan = () => notify(`AI plan for ${aiPlan.route.id} is ready for the transport officer to approve.`)
  useEffect(() => {
    void loadLiveData(false)
    if (!autoRefresh) return
    const timer = window.setInterval(() => void loadLiveData(false), 15000)
    return () => window.clearInterval(timer)
  }, [autoRefresh, loadLiveData])
  const resolveAlert = (id: number) => { const alert = alerts.find((item) => item.id === id); setAlerts((current) => current.filter((item) => item.id !== id)); if (alert) notify(`${alert.title} marked as resolved`) }
  const updateRoadStatus = async (ticketId: string, status: RoadReport['status']) => {
    try {
      const response = await fetch(`${TRANSIT_API_URL}/road-reports/${encodeURIComponent(ticketId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      if (!response.ok) throw new Error('Could not update this ticket.')
      await loadLiveData(false)
      notify(`${ticketId} marked as ${status.replace('_', ' ')}`)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not update this ticket.')
    }
  }
  const nav: { name: Page; icon: typeof Bus }[] = [{ name: 'Overview', icon: LayoutDashboard }, { name: 'Live fleet', icon: Bus }, { name: 'Routes', icon: Route }, { name: 'Alerts', icon: Bell }, { name: 'Road issues', icon: Map }, { name: 'Maintenance', icon: Wrench }]

  return <main className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'is-open' : ''}`}><div className="brand"><div className="brand-mark"><Radio size={19} /></div><div><strong>UrbanIQ</strong><span>Transport command</span></div><button className="icon-button close-menu" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X /></button></div><nav aria-label="Dashboard navigation"><p className="nav-label">Command center</p>{nav.map(({ name, icon: Icon }) => <button key={name} className={`nav-item ${activePage === name ? 'active' : ''}`} onClick={() => navigate(name)}><Icon size={18} /><span>{name}</span>{name === 'Alerts' && alerts.length > 0 && <b className="nav-badge">{alerts.length}</b>}</button>)}</nav><div className="sidebar-bottom"><button className={`nav-item ${activePage === 'Settings' ? 'active' : ''}`} onClick={() => navigate('Settings')}><Settings size={18} /><span>Settings</span></button><div className="data-safe"><ShieldCheck size={17} /><span>Fleet data is secure</span></div></div></aside>
    {menuOpen && <button className="backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    <section className="main-content"><header className="topbar"><div className="title-wrap"><button className="icon-button menu-button" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu /></button><div><p className="eyebrow">City transport authority</p><h1>{activePage}</h1></div></div><div className="top-actions"><button className="help-button" onClick={() => setHelpOpen(true)}><CircleHelp size={17} /> Help</button><div className="action-popover"><button className="notification-button" onClick={() => { setNotificationsOpen(!notificationsOpen); setProfileOpen(false) }} aria-label="Notifications"><Bell size={18} />{alerts.length > 0 && <span />}</button>{notificationsOpen && <div className="mini-popover notification-popover"><strong>Priority notifications</strong><p>{alerts.length ? `${alerts.length} open issues need review.` : 'All fleet alerts are resolved.'}</p><button onClick={() => { setNotificationsOpen(false); navigate('Alerts') }}>Open alerts</button></div>}</div><div className="action-popover"><button className="profile profile-button" onClick={() => { setProfileOpen(!profileOpen); setNotificationsOpen(false) }} aria-label="Open profile menu"><div className="avatar">{initials}</div><ChevronDown size={16} /></button>{profileOpen && <div className="mini-popover profile-popover"><strong>{email}</strong><p>Transport officer</p><button onClick={() => { setProfileOpen(false); navigate('Settings') }}>Account settings</button><button className="logout-button" onClick={onLogout}>Log out</button></div>}</div></div></header>
      <div className="page"><section className="page-intro"><div><h2>{activePage === 'Overview' ? `Good morning, ${userName}` : pageCopy[activePage].title}</h2><p>{activePage === 'Overview' ? 'Here is today’s live public transport network status.' : pageCopy[activePage].description}</p></div><div className="refresh-row"><span><Clock3 size={15} /> Updated {updatedAt}</span><button className="refresh-button" onClick={refreshData} disabled={isRefreshing}><RefreshCw size={16} className={isRefreshing ? 'spin' : ''} /> {isRefreshing ? 'Refreshing' : 'Refresh'}</button></div></section>
      {activePage === 'Overview' && <Overview selectedRoute={selectedRoute} setSelectedRoute={setSelectedRoute} routes={displayedRoutes} allRoutes={routeData} fleet={fleetData} alerts={alerts} summary={summary} apiConnected={apiConnected} arrivalsOpen={arrivalsOpen} setArrivalsOpen={setArrivalsOpen} onNavigate={navigate} onLocate={() => { setFleetLocated(!fleetLocated); notify(fleetLocated ? 'Map focus cleared' : 'Map centered on live fleet') }} located={fleetLocated} />}
      {activePage === 'Live fleet' && <LiveFleet selectedRoute={selectedRoute} setSelectedRoute={setSelectedRoute} routes={routeData} fleet={visibleFleet} allFleet={fleetData} onLocate={() => { setFleetLocated(true); notify('Map centered on live fleet') }} located={fleetLocated} />}
      {activePage === 'Routes' && <RoutesPage routes={displayedRoutes} allRoutes={routeData} selectedRoute={selectedRoute} setSelectedRoute={setSelectedRoute} plan={aiPlan} automationEnabled={automationEnabled} onToggleAutomation={() => setAutomationEnabled((value) => !value)} onApply={applyAiPlan} onRun={() => runAutomation(true)} onAction={(route: string) => notify(`${route} performance report prepared`)} />}
      {activePage === 'Alerts' && <AlertsPage alerts={alerts} onResolve={resolveAlert} />}
      {activePage === 'Road issues' && <RoadIssuesPage reports={roadReports} onStatusChange={updateRoadStatus} />}
      {activePage === 'Maintenance' && <MaintenancePage onAction={notify} />}
      {activePage === 'Settings' && <SettingsPage autoRefresh={autoRefresh} setAutoRefresh={setAutoRefresh} automationEnabled={automationEnabled} setAutomationEnabled={setAutomationEnabled} onSave={() => notify('Dashboard settings saved')} />}</div></section>
    {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}{toast && <div className="toast" role="status"><Check size={17} /> {toast}</div>}</main>
}

function Overview({ selectedRoute, setSelectedRoute, routes: shownRoutes, allRoutes, fleet, alerts, summary, apiConnected, arrivalsOpen, setArrivalsOpen, onNavigate, onLocate, located }: any) {
  const onTime = Math.round(allRoutes.reduce((total: number, route: RouteData) => total + route.onTime, 0) / Math.max(1, allRoutes.length))
  const crowded = fleet.filter((bus: FleetBus) => bus.crowd === 'High').length
  const activeBuses = summary?.activeBuses ?? fleet.length
  const totalBuses = summary?.totalBuses ?? fleet.length
  return <><section className="stats-grid" aria-label="Fleet summary"><StatCard icon={<Bus />} label="Active buses" value={String(activeBuses)} suffix={` / ${totalBuses}`} detail={apiConnected ? 'Live API connected' : 'Using cached display data'} change={apiConnected ? 'Updated from drivers' : 'Server unavailable'} color="blue" /><StatCard icon={<Clock3 />} label="Route reliability" value={String(onTime)} suffix="%" detail="Calculated from live route risks" change={`${allRoutes.length} routes reporting`} color="green" /><StatCard icon={<UsersRound />} label="Crowded buses" value={String(crowded)} suffix="" detail="Driver crowd status" change={crowded ? 'Needs attention' : 'No high crowd reports'} color="orange" /><StatCard icon={<AlertTriangle />} label="Open alerts" value={String(summary?.openAlerts ?? alerts.length)} suffix="" detail="Issues awaiting action" change="View all alerts" color="red" onClick={() => onNavigate('Alerts')} /></section><section className="content-grid"><MapPanel selectedRoute={selectedRoute} setSelectedRoute={setSelectedRoute} routes={allRoutes} fleet={fleet} onLocate={onLocate} located={located} onOpen={() => onNavigate('Live fleet')} /><article className="arrivals-panel panel"><div className="panel-header"><div><h3>Next arrivals</h3><p>Central Station</p></div><button className="more-button" aria-label="More arrival options" onClick={() => setArrivalsOpen(!arrivalsOpen)}><MoreHorizontal /></button></div><div className="arrivals-list">{arrivals.slice(0, arrivalsOpen ? arrivals.length : 2).map((item) => <Arrival key={item.route} item={item} />)}</div><button className="full-width-link" onClick={() => setArrivalsOpen(!arrivalsOpen)}>{arrivalsOpen ? 'Show fewer arrivals' : 'View all arrivals'} <span>→</span></button></article><article className="routes-panel panel"><div className="panel-header"><div><h3>Route performance</h3><p>Live service quality by route</p></div><button className="text-button" onClick={() => onNavigate('Routes')}>Full report</button></div><RouteTable routes={shownRoutes} /></article><article className="alerts-panel panel"><div className="panel-header"><div><h3>Priority alerts</h3><p>Issues needing attention</p></div><button className="text-button" onClick={() => onNavigate('Alerts')}>View all</button></div><div className="alert-list">{alerts.slice(0, 4).map((alert: any) => <AlertRow key={alert.id} {...alert} />)}{!alerts.length && <Empty text="No open alerts. Fleet is operating normally." />}</div></article></section></> }
function loadGoogleMaps() {
  if (window.google?.maps) return Promise.resolve()
  const existing = document.querySelector<HTMLScriptElement>('script[data-urbaniq-google-maps]')
  if (existing) return new Promise<void>((resolve, reject) => { existing.addEventListener('load', () => resolve(), { once: true }); existing.addEventListener('error', () => reject(new Error('Google Maps could not load')), { once: true }) })
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.dataset.urbaniqGoogleMaps = 'true'
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&v=weekly`
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google Maps could not load'))
    document.head.appendChild(script)
  })
}

function GoogleFleetMap({ selectedRoute, fleet, located }: { selectedRoute: string; fleet: FleetBus[]; located: boolean }) {
  const container = useRef<HTMLDivElement>(null)
  const [message, setMessage] = useState(GOOGLE_MAPS_API_KEY.startsWith('PASTE_') ? 'Add your Google Maps API key to src/config.ts to load the live map.' : 'Loading Google Maps…')
  useEffect(() => {
    if (!container.current || GOOGLE_MAPS_API_KEY.startsWith('PASTE_')) return
    let disposed = false
    const overlays: any[] = []
    loadGoogleMaps().then(() => {
      if (disposed || !container.current) return
      const firstGpsBus = fleet.find((bus) => bus.latitude !== null && bus.latitude !== undefined && bus.longitude !== null && bus.longitude !== undefined)
      const map = new window.google.maps.Map(container.current, { center: firstGpsBus ? { lat: firstGpsBus.latitude, lng: firstGpsBus.longitude } : { lat: 28.6139, lng: 77.209 }, zoom: selectedRoute === 'All routes' ? 10 : 11, mapTypeControl: false, streetViewControl: false, fullscreenControl: false })
      const activeRoutes = selectedRoute === 'All routes' ? Object.keys(routePaths) : [selectedRoute]
      activeRoutes.forEach((routeId) => {
        const path = routePaths[routeId]
        if (!path) return
        const line = new window.google.maps.Polyline({ path, strokeColor: routeColors[routeId] ?? '#2563eb', strokeOpacity: .85, strokeWeight: routeId === selectedRoute ? 6 : 4, map })
        overlays.push(line)
      })
      fleet.filter((bus) => selectedRoute === 'All routes' || bus.route === selectedRoute).forEach((bus, index) => {
        const path = routePaths[bus.route]
        const point = bus.latitude !== null && bus.latitude !== undefined && bus.longitude !== null && bus.longitude !== undefined ? { lat: bus.latitude, lng: bus.longitude } : path?.[Math.min(path.length - 1, 1 + (index % Math.max(1, path.length - 1)))]
        if (!point) return
        const marker = new window.google.maps.Marker({ position: point, map, title: `${bus.id} · ${bus.route}`, label: { text: bus.route, color: '#ffffff', fontWeight: '700', fontSize: '10px' }, icon: { path: window.google.maps.SymbolPath.CIRCLE, fillColor: routeColors[bus.route] ?? '#2563eb', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2, scale: 16 } })
        const info = new window.google.maps.InfoWindow({ content: `<strong>${bus.id}</strong><br/>${bus.route} · ${bus.status}<br/>${bus.location} · ETA ${bus.eta}` })
        marker.addListener('click', () => info.open({ map, anchor: marker }))
        overlays.push(marker)
      })
      if (located && selectedRoute !== 'All routes') {
        const routeBus = fleet.find((bus) => bus.route === selectedRoute && bus.latitude !== null && bus.latitude !== undefined && bus.longitude !== null && bus.longitude !== undefined)
        const routePoint = routeBus ? { lat: routeBus.latitude, lng: routeBus.longitude } : routePaths[selectedRoute]?.[1]
        if (routePoint) map.panTo(routePoint)
      }
      setMessage('')
    }).catch(() => !disposed && setMessage('Google Maps could not load. Check the API key, Maps JavaScript API, billing, and referrer restrictions.'))
    return () => { disposed = true; overlays.forEach((overlay) => overlay.setMap?.(null)) }
  }, [selectedRoute, fleet, located])
  return <div className="google-map" ref={container} aria-label="Google Map showing live government bus routes">{message && <div className="map-loading"><Map size={22} /><strong>{message}</strong><span>Each colored line is a government bus route. Markers show live fleet representatives.</span></div>}</div>
}

function roadPhotoUrl(photoPath: string) {
  return `${TRANSIT_API_URL.replace(/\/api\/?$/, '')}${photoPath}`
}

function RoadIssueMap({ reports }: { reports: RoadReport[] }) {
  const container = useRef<HTMLDivElement>(null)
  const [message, setMessage] = useState(reports.length ? (GOOGLE_MAPS_API_KEY.startsWith('PASTE_') ? 'Add your Google Maps API key to src/config.ts to load the road-issue map.' : 'Loading Google Maps…') : 'No road-condition tickets have been created yet.')
  useEffect(() => {
    if (!container.current || !reports.length || GOOGLE_MAPS_API_KEY.startsWith('PASTE_')) return
    let disposed = false
    const overlays: any[] = []
    loadGoogleMaps().then(() => {
      if (disposed || !container.current) return
      const first = reports[0]
      const map = new window.google.maps.Map(container.current, { center: { lat: first.latitude, lng: first.longitude }, zoom: 12, mapTypeControl: false, streetViewControl: false, fullscreenControl: false })
      reports.forEach((report) => {
        const color = report.priorityLevel === 'Critical' ? '#dc4f54' : report.priorityLevel === 'High' ? '#f08b3b' : report.priorityLevel === 'Medium' ? '#e7a72f' : '#3976eb'
        const marker = new window.google.maps.Marker({ position: { lat: report.latitude, lng: report.longitude }, map, title: `${report.ticketId} · ${report.issueType}`, label: { text: report.ticketId.replace('RD-', ''), color: '#ffffff', fontWeight: '700', fontSize: '10px' }, icon: { path: window.google.maps.SymbolPath.CIRCLE, fillColor: color, fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2, scale: 17 } })
        const content = document.createElement('div')
        const title = document.createElement('strong')
        title.textContent = `${report.ticketId} · ${report.issueType}`
        const detail = document.createElement('div')
        detail.textContent = `${report.priorityLevel} · Ward ${report.wardNumber ?? 'review'} · ${report.municipalityName ?? 'Unassigned'}`
        content.append(title, document.createElement('br'), detail)
        const info = new window.google.maps.InfoWindow({ content })
        marker.addListener('click', () => info.open({ map, anchor: marker }))
        overlays.push(marker)
      })
      setMessage('')
    }).catch(() => !disposed && setMessage('Google Maps could not load. Check the API key, Maps JavaScript API, billing, and referrer restrictions.'))
    return () => { disposed = true; overlays.forEach((overlay) => overlay.setMap?.(null)) }
  }, [reports])
  return <div className="road-issue-map google-map" ref={container} aria-label="Google Map of AI-detected road issues">{message && <div className="map-loading"><Map size={22} /><strong>{message}</strong><span>Each marker represents a photo report routed by GPS to a municipal ward.</span></div>}</div>
}

function RoadIssuesPage({ reports, onStatusChange }: { reports: RoadReport[]; onStatusChange: (ticketId: string, status: RoadReport['status']) => void }) {
  const openCount = reports.filter((report) => report.status !== 'resolved').length
  return <section className="road-issues-layout"><article className="panel road-map-panel"><div className="panel-header"><div><h3>Municipal road-issue map</h3><p>GPS → ward → municipal department. Demo boundaries must be replaced with official ward data before deployment.</p></div><span className="alert-count">{openCount} open</span></div><RoadIssueMap reports={reports} /></article><article className="panel road-tickets-panel"><div className="panel-header"><div><h3>AI road-condition tickets</h3><p>Photo, detection, priority, and accountable government team.</p></div></div><div className="road-ticket-list">{reports.map((report) => <article className="road-ticket" key={report.ticketId}><img className="road-photo" src={roadPhotoUrl(report.photoPath)} alt={`${report.issueType} submitted with ticket ${report.ticketId}`} /><div className="road-ticket-main"><div className="road-ticket-title"><div><strong>{report.ticketId}</strong><span>{report.issueType.replace(/_/g, ' ')}</span></div><span className={`road-priority ${report.priorityLevel.toLowerCase()}`}>{report.priorityLevel} · {report.priorityScore}/100</span></div><div className="road-ticket-meta"><span>{Math.round(report.confidence * 100)}% confidence</span><span>{report.potholeCount} pothole{report.potholeCount === 1 ? '' : 's'}</span><span>{report.maxPotholeDiameterCm ? `${report.maxPotholeDiameterCm} cm` : report.diameterSource}</span></div><p><b>Ward {report.wardNumber ?? 'review required'}</b> · {report.wardName ?? 'No boundary matched'}<br />{report.municipalityName ?? 'Municipal review queue'} · {report.departmentName ?? 'Assignment required'}</p><div className="road-ticket-actions"><select value={report.status} onChange={(event) => onStatusChange(report.ticketId, event.target.value as RoadReport['status'])} aria-label={`Status for ${report.ticketId}`}><option value="open">Open</option><option value="assigned">Assigned</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select><span>{report.modelMode === 'demo' ? 'Demo prediction — not AI' : 'Roboflow AI prediction'}</span></div></div></article>)}{!reports.length && <Empty text="No road-condition reports yet. Driver photo reports will appear here." />}</div></article></section>
}

function MapPanel({ selectedRoute, setSelectedRoute, routes, fleet, onLocate, located, onOpen }: any) { const markerRoutes = selectedRoute === 'All routes' ? fleet : fleet.filter((bus: FleetBus) => bus.route === selectedRoute); return <article className={`map-panel panel ${located ? 'is-located' : ''}`}><div className="panel-header"><div><h3>Live government bus map</h3><p><span className="live-dot" /> {selectedRoute === 'All routes' ? `${fleet.length} buses reporting` : `${markerRoutes.length} selected route buses reporting`}</p></div><RouteSelect value={selectedRoute} onChange={setSelectedRoute} routes={routes} /></div><GoogleFleetMap selectedRoute={selectedRoute} fleet={fleet} located={located} /><div className="map-footer"><Map size={16} /><span>GPS markers come from driver app location updates.</span>{onOpen && <button onClick={onOpen}>Open live fleet <span>→</span></button>}<button className="map-locate-action" onClick={onLocate} aria-label="Locate fleet"><LocateFixed size={18} /></button></div></article> }
function LiveFleet({ selectedRoute, setSelectedRoute, routes, fleet: shownFleet, allFleet, onLocate, located }: any) { return <section className="detail-grid"><MapPanel selectedRoute={selectedRoute} setSelectedRoute={setSelectedRoute} routes={routes} fleet={allFleet} onLocate={onLocate} located={located} /><article className="panel fleet-list-panel"><div className="panel-header"><div><h3>Reporting buses</h3><p>{shownFleet.length} buses shown</p></div><span className="live-dot" /></div><div className="fleet-list">{shownFleet.map((bus: FleetBus) => <div className="fleet-row" key={bus.id}><span className={`fleet-dot ${bus.tone}`} /><div><strong>{bus.id}</strong><span>{bus.route} · {bus.location}</span></div><div><strong>{bus.status}</strong><span>ETA {bus.eta}</span></div></div>)}</div></article></section> }
function RoutesPage({ routes: shownRoutes, allRoutes, selectedRoute, setSelectedRoute, plan, automationEnabled, onToggleAutomation, onApply, onRun, onAction }: any) { return <section className="single-panel"><article className="panel"><div className="panel-header"><div><h3>Route intelligence report</h3><p>Compare service quality, demand, and risk across all {allRoutes.length} active routes.</p></div><RouteSelect value={selectedRoute} onChange={setSelectedRoute} routes={allRoutes} /></div><div className="ai-plan"><div className="ai-plan-icon"><Sparkles size={19} /></div><div><strong>AI recommendation: {plan.route.id}</strong><p>{plan.route.name}: {plan.action}. Projected on-time improvement: +{plan.impact}%.</p></div><span className={automationEnabled ? 'automation-pill enabled' : 'automation-pill'}>{automationEnabled ? 'Automation on' : 'Automation paused'}</span></div><RouteTable routes={shownRoutes} /><div className="panel-actions"><button className="secondary-button" onClick={onRun}><RefreshCw size={15} /> Refresh live routes</button><button className="secondary-button" onClick={onToggleAutomation}>{automationEnabled ? 'Pause automation' : 'Enable automation'}</button><button className="primary-button" onClick={onApply}><Sparkles size={15} /> Apply AI plan</button><button className="text-button" onClick={() => onAction(selectedRoute === 'All routes' ? 'Network' : selectedRoute)}>Generate report</button></div></article></section> }
function AlertsPage({ alerts, onResolve }: any) { return <section className="single-panel"><article className="panel"><div className="panel-header"><div><h3>Open operational alerts</h3><p>Resolve an alert after a driver, depot, or field team confirms action.</p></div><span className="alert-count">{alerts.length} open</span></div><div className="full-alert-list">{alerts.map((alert: any) => <div className="full-alert" key={alert.id}><AlertRow {...alert} /><button className="resolve-button" onClick={() => onResolve(alert.id)}><Check size={15} /> Resolve</button></div>)}{!alerts.length && <Empty text="Everything is clear — there are no open fleet alerts." />}</div></article></section> }
function MaintenancePage({ onAction }: { onAction: (message: string) => void }) { const jobs = [{ bus: 'DL-01-AB-2047', work: 'Engine inspection', priority: 'Tomorrow' }, { bus: 'DL-01-AB-7792', work: 'Brake-pad replacement', priority: 'This week' }, { bus: 'DL-01-AB-1088', work: 'Battery health test', priority: 'This week' }]; return <section className="single-panel"><article className="panel"><div className="panel-header"><div><h3>Preventive maintenance queue</h3><p>Vehicle data identifies service needs before breakdowns happen.</p></div><button className="primary-button" onClick={() => onAction('Maintenance team notified')}>Notify team</button></div><div className="maintenance-list">{jobs.map((job) => <div className="maintenance-row" key={job.bus}><span className="maintenance-icon"><Wrench size={18} /></span><div><strong>{job.bus}</strong><span>{job.work}</span></div><span className="due-pill">{job.priority}</span><button className="secondary-button" onClick={() => onAction(`Inspection scheduled for ${job.bus}`)}>Schedule</button></div>)}</div></article></section> }
function SettingsPage({ autoRefresh, setAutoRefresh, automationEnabled, setAutomationEnabled, onSave }: any) { return <section className="single-panel"><article className="panel settings-panel"><div><h3>Live data preferences</h3><p>Control the live simulator and automated route recommendations.</p></div><label className="setting-row"><span><strong>Automatic data refresh</strong><small>Refresh GPS and service data every 15 seconds while the dashboard is open.</small></span><input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} /></label><label className="setting-row"><span><strong>AI route automation</strong><small>Continuously identify the lowest-performing route and prepare a recovery plan.</small></span><input type="checkbox" checked={automationEnabled} onChange={(event) => setAutomationEnabled(event.target.checked)} /></label><label className="setting-row"><span><strong>Critical alert notifications</strong><small>Show breakdown and emergency notifications immediately.</small></span><input type="checkbox" defaultChecked /></label><button className="primary-button" onClick={onSave}>Save settings</button></article></section> }
function HelpModal({ onClose }: { onClose: () => void }) { return <div className="modal-backdrop" role="presentation"><article className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title"><button className="modal-close" onClick={onClose} aria-label="Close help"><X size={19} /></button><div className="brand-mark"><CircleHelp size={20} /></div><h2 id="help-title">UrbanIQ command center</h2><p>This demo turns fleet GPS, ticketing, vehicle health, and driver reports into useful government decisions.</p><ul><li>Use <strong>Live fleet</strong> to inspect reporting buses.</li><li>Use <strong>Routes</strong> to find delays and high-demand services.</li><li>Use <strong>Alerts</strong> to resolve breakdown, crowding, and traffic issues.</li></ul><button className="primary-button" onClick={onClose}>Got it</button></article></div> }
function RouteSelect({ value, onChange, routes }: { value: string; onChange: (value: string) => void; routes: RouteData[] }) { return <select value={value} onChange={(event) => onChange(event.target.value)} aria-label="Filter by route"><option>All routes</option>{routes.map((route) => <option key={route.id}>{route.id}</option>)}</select> }
function StatCard({ icon, label, value, suffix, detail, change, color, onClick }: any) { const content = <><div className="stat-top"><span className="stat-icon">{icon}</span><span>{label}</span></div><div className="stat-number">{value}<small>{suffix}</small></div><div className="stat-bottom"><span>{detail}</span><strong>{change}</strong></div></>; return onClick ? <button className={`stat-card ${color} stat-button`} onClick={onClick}>{content}</button> : <article className={`stat-card ${color}`}>{content}</article> }
function BusMarker({ className, label, tone }: { className: string; label: string; tone: string }) { return <div className={`bus-marker ${className} ${tone}`}><Bus size={14} /><span>{label}</span></div> }
function Arrival({ item }: { item: typeof arrivals[number] }) { return <div className="arrival"><span className={`route-pill ${item.tone}`}>{item.route}</span><div className="arrival-info"><strong>{item.destination}</strong><span>{item.occupancy}% full</span></div><strong className="arrival-time">{item.time}</strong></div> }
function RouteTable({ routes: shownRoutes }: { routes: RouteData[] }) { return <div className="route-table"><div className="route-row route-heading"><span>Route</span><span>On-time</span><span>Occupancy</span><span>Status</span></div>{shownRoutes.map((route) => <div className="route-row" key={route.id}><div><strong>{route.id}</strong><span>{route.name}</span></div><div className="on-time"><div><i style={{ width: `${route.onTime}%` }} /></div><span>{route.onTime}%</span></div><span>{route.crowd}</span><span className={`status ${route.onTime < 75 ? 'attention' : 'normal'}`}>{route.onTime < 75 ? 'Needs attention' : 'Normal'}</span></div>)}</div> }
function AlertRow({ type, title, detail, time }: { type: AlertType; title: string; detail: string; time: string }) { const icon = type === 'critical' ? <AlertTriangle size={16} /> : type === 'warning' ? <Radio size={16} /> : <Wrench size={16} />; return <div className="alert-row"><span className={`alert-icon ${type}`}>{icon}</span><div><strong>{title}</strong><span>{detail}</span></div><time>{time}</time></div> }
function Empty({ text }: { text: string }) { return <div className="empty-state"><Check size={22} />{text}</div> }

async function passwordHash(password: string) {
  const bytes = new TextEncoder().encode(password)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, '0')).join('')
}

function LoginPage({ onLogin }: { onLogin: (email: string, name: string) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('register')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function switchMode(next: 'login' | 'register') {
    setMode(next); setMessage(''); setPassword(''); setConfirmPassword('')
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedEmail = email.trim().toLowerCase()
    const normalizedName = name.trim().replace(/\s+/g, ' ')
    if (mode === 'register' && !/^[a-zA-Z][a-zA-Z .'-]{1,48}$/.test(normalizedName)) return setMessage('Enter your full name using letters only.')
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) return setMessage('Enter a valid email address.')
    if (password.length < 6) return setMessage('Use a password with at least 6 characters.')
    if (mode === 'register' && password !== confirmPassword) return setMessage('Passwords do not match.')
    setSubmitting(true)
    const hash = await passwordHash(password)
    const saved = localStorage.getItem('urbaniq-account')
    const account: StoredAccount | null = saved ? JSON.parse(saved) : null
    if (mode === 'register') {
      if (account?.email === normalizedEmail) { setSubmitting(false); return setMessage('An account with this email already exists. Please log in.') }
      localStorage.setItem('urbaniq-account', JSON.stringify({ name: normalizedName, email: normalizedEmail, passwordHash: hash }))
      onLogin(normalizedEmail, normalizedName)
      return
    }
    if (!account || account.email !== normalizedEmail || account.passwordHash !== hash) { setSubmitting(false); return setMessage('Email or password is incorrect. Create an account first if you are new.') }
    onLogin(normalizedEmail, account.name || normalizedEmail.split('@')[0].replace(/[._-]/g, ' '))
  }

  return <main className="login-shell"><section className="login-showcase"><div className="brand"><div className="brand-mark"><Radio size={20} /></div><div><strong>UrbanIQ</strong><span>Transport command</span></div></div><div className="showcase-copy"><span className="login-kicker">SMART CITY TRANSPORT</span><h1>See every journey.<br />Improve every route.</h1><p>A government command center for bus tracking, crowd intelligence, maintenance, and safer roads.</p><div className="login-points"><span><Check size={16} /> Live fleet status</span><span><Check size={16} /> Actionable route insights</span><span><Check size={16} /> Secure local demo account</span></div></div><div className="showcase-stat"><Bus size={19} /><span><strong>186</strong> buses reporting now</span><i /></div></section><section className="login-panel"><div className="login-card"><div className="login-mobile-mark brand-mark"><Radio size={20} /></div><p className="eyebrow">URBANIQ ACCESS</p><h2>{mode === 'register' ? 'Create your account' : 'Welcome back'}</h2><p className="login-description">{mode === 'register' ? 'Enter your name, email, and a password to start the dashboard.' : 'Sign in with the email and password you created.'}</p><form onSubmit={submit}>{mode === 'register' && <label>Full name<input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your full name" autoComplete="name" required /></label>}<label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required /></label>{mode === 'register' && <label>Confirm password<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter password again" autoComplete="new-password" required /></label>}{message && <p className="login-message" role="alert">{message}</p>}<button className="login-submit" disabled={submitting}>{submitting ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Log in'}</button></form><p className="mode-switch">{mode === 'register' ? 'Already have an account?' : 'New to UrbanIQ?'} <button onClick={() => switchMode(mode === 'register' ? 'login' : 'register')} type="button">{mode === 'register' ? 'Log in' : 'Create account'}</button></p><p className="login-note">This is a local demo: your password is not hard-coded or shown on screen. Real email verification will be added when the backend is connected.</p></div></section></main>
}
export default App
