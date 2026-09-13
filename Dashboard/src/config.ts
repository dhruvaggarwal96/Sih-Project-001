// Paste your Google Maps browser API key between the quotes below.
// Restrict the key in Google Cloud Console to this site's HTTP referrer before deployment.
export const GOOGLE_MAPS_API_KEY = 'AIzaSyDMoXz9qfIk_MouKBjb3rubHnXnwKMKzjY'

// Keep this as a public URL only. API secrets never belong in a Vite browser app.
export const TRANSIT_API_URL = import.meta.env.VITE_TRANSIT_API_URL ?? 'http://localhost:4000/api'
