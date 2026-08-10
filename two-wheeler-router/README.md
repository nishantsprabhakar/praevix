# Fastest 2-Wheeler Route (India)

A single-page web app that finds the fastest route for a two-wheeler ride between
two locations in India, using Google Maps' India-only `TWO_WHEELER` travel mode
(accounts for lane-splitting and roads restricted to/from two-wheelers).

## Setup

1. **Create a Google Cloud project** (or use an existing one) with billing enabled.
2. Enable these APIs on that project:
   - Maps JavaScript API
   - Places API
   - Directions API
3. Create an API key (APIs & Services → Credentials → Create Credentials → API key).
4. **Restrict the key** (Credentials → your key → Application restrictions):
   - "HTTP referrers" → add `http://localhost:8080/*` for local testing, and your
     production domain when you deploy.
   - API restrictions → limit to the three APIs above.
5. Run the app locally:
   ```
   node server.js
   ```
   Then open http://localhost:8080 and paste your API key when prompted.

The key is stored only in the browser's `localStorage` — it is never sent to
anything other than Google's endpoints. This app has no backend/server-side
logic beyond serving static files.

## How it works

- Autocomplete (restricted to India) helps pick origin/destination.
- `DirectionsService.route()` is called with `travelMode: 'TWO_WHEELER'` and
  `region: 'IN'`, with `provideRouteAlternatives: true`.
- When Google returns multiple route options, the app picks the one with the
  lowest `duration_in_traffic` (falling back to `duration` if traffic data
  isn't available) as the "fastest" route, and lets you switch to alternatives.
- Optional "avoid highways" / "avoid tolls" toggles map directly to the
  Directions API's `avoidHighways` / `avoidTolls` request options.

## Known limitations

- `TWO_WHEELER` mode only returns valid routes for origins/destinations inside
  India — Google will error otherwise.
- Live traffic-adjusted duration (`duration_in_traffic`) is only returned by
  Google for near-term departure times; it's best-effort, not guaranteed for
  two-wheeler mode.
- This uses the legacy `DirectionsService`/`DirectionsRenderer`/`Autocomplete`
  APIs, which Google marked deprecated (Feb 2026) in favor of
  `routes.Route.computeRoutes` and `PlaceAutocompleteElement`. Google has
  committed to at least 12 months' notice before removal, and bug fixes
  continue in the meantime, so this is fine for now — worth migrating later.
