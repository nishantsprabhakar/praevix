const LS_KEY = "gmaps_api_key";

let map, directionsService, directionsRenderer, geocoder;
let originAutocomplete, destinationAutocomplete;
let routeResults = [];
let selectedRouteIndex = 0;

// ---------- API key gate ----------

function boot() {
  const savedKey = localStorage.getItem(LS_KEY);
  if (savedKey) {
    loadGoogleMaps(savedKey);
  } else {
    document.getElementById("api-key-submit").addEventListener("click", submitKey);
    document.getElementById("api-key-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") submitKey();
    });
  }

  document.getElementById("reset-key").addEventListener("click", (e) => {
    e.preventDefault();
    localStorage.removeItem(LS_KEY);
    window.location.reload();
  });
}

function submitKey() {
  const key = document.getElementById("api-key-input").value.trim();
  if (!key) return;
  localStorage.setItem(LS_KEY, key);
  loadGoogleMaps(key);
}

function loadGoogleMaps(key) {
  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&callback=initMap&v=weekly`;
  script.async = true;
  script.onerror = () => {
    showKeyError("Failed to load Google Maps. Check your API key and network connection.");
  };
  document.body.appendChild(script);
}

function showKeyError(message) {
  const gate = document.getElementById("key-gate");
  gate.classList.remove("hidden");
  document.getElementById("app").classList.add("hidden");
  let err = document.getElementById("key-error");
  if (!err) {
    err = document.createElement("p");
    err.id = "key-error";
    err.style.color = "#c0392b";
    err.style.fontSize = "13px";
    document.querySelector(".key-card").appendChild(err);
  }
  err.textContent = message;
}

// ---------- Map initialization (Google Maps callback) ----------

function initMap() {
  document.getElementById("key-gate").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");

  const defaultCenter = { lat: 20.5937, lng: 78.9629 }; // India centroid

  map = new google.maps.Map(document.getElementById("map"), {
    center: defaultCenter,
    zoom: 5,
    mapTypeControl: false,
    streetViewControl: false,
  });

  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer({
    map,
    suppressMarkers: false,
    polylineOptions: { strokeColor: "#ff8a00", strokeWeight: 5 },
  });
  geocoder = new google.maps.Geocoder();

  const indiaBounds = new google.maps.LatLngBounds(
    { lat: 6.5546, lng: 68.1114 },
    { lat: 35.6745, lng: 97.3956 }
  );

  const originInput = document.getElementById("origin-input");
  const destinationInput = document.getElementById("destination-input");

  const autocompleteOptions = {
    bounds: indiaBounds,
    componentRestrictions: { country: "in" },
    fields: ["geometry", "name", "formatted_address"],
  };

  originAutocomplete = new google.maps.places.Autocomplete(originInput, autocompleteOptions);
  destinationAutocomplete = new google.maps.places.Autocomplete(destinationInput, autocompleteOptions);

  document.getElementById("route-btn").addEventListener("click", findRoute);
  document.getElementById("swap-btn").addEventListener("click", swapInputs);
  document.getElementById("locate-btn").addEventListener("click", useMyLocation);
}

// ---------- UI actions ----------

function swapInputs() {
  const originInput = document.getElementById("origin-input");
  const destinationInput = document.getElementById("destination-input");
  const tmp = originInput.value;
  originInput.value = destinationInput.value;
  destinationInput.value = tmp;
}

function useMyLocation() {
  if (!navigator.geolocation) {
    setStatus("Geolocation isn't supported by this browser.", true);
    return;
  }
  setStatus("Fetching your location...", false);
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const latlng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      geocoder.geocode({ location: latlng }, (results, status) => {
        if (status === "OK" && results[0]) {
          document.getElementById("origin-input").value = results[0].formatted_address;
        } else {
          document.getElementById("origin-input").value = `${latlng.lat}, ${latlng.lng}`;
        }
        setStatus("", false);
      });
    },
    () => setStatus("Couldn't get your location. Check browser permissions.", true)
  );
}

function setStatus(message, isError) {
  const el = document.getElementById("status");
  el.textContent = message;
  el.className = isError ? "status" : "status info";
}

// ---------- Routing ----------

function findRoute() {
  const origin = document.getElementById("origin-input").value.trim();
  const destination = document.getElementById("destination-input").value.trim();

  if (!origin || !destination) {
    setStatus("Enter both an origin and a destination.", true);
    return;
  }

  const routeBtn = document.getElementById("route-btn");
  routeBtn.disabled = true;
  setStatus("Finding the fastest 2-wheeler route...", false);
  document.getElementById("result").classList.add("hidden");

  const avoidHighways = document.getElementById("avoid-highways").checked;
  const avoidTolls = document.getElementById("avoid-tolls").checked;

  directionsService.route(
    {
      origin,
      destination,
      travelMode: google.maps.TravelMode.TWO_WHEELER,
      region: "IN",
      provideRouteAlternatives: true,
      avoidHighways,
      avoidTolls,
    },
    (response, status) => {
      routeBtn.disabled = false;

      if (status !== "OK") {
        setStatus(routeErrorMessage(status), true);
        return;
      }

      routeResults = response.routes;
      selectedRouteIndex = pickFastestRouteIndex(routeResults);
      setStatus("", false);
      renderRoute(response);
    }
  );
}

function routeErrorMessage(status) {
  switch (status) {
    case "ZERO_RESULTS":
      return "No two-wheeler route found between these locations.";
    case "NOT_FOUND":
      return "Couldn't find one of the locations. Try a more specific address.";
    case "REQUEST_DENIED":
      return "Request denied — check that Directions API is enabled and billing is active for your API key.";
    case "OVER_QUERY_LIMIT":
      return "API quota exceeded for this key.";
    default:
      return `Couldn't compute a route (${status}).`;
  }
}

function routeDurationSeconds(route) {
  const leg = route.legs[0];
  return (leg.duration_in_traffic || leg.duration).value;
}

function pickFastestRouteIndex(routes) {
  let bestIndex = 0;
  let bestTime = Infinity;
  routes.forEach((route, i) => {
    const t = routeDurationSeconds(route);
    if (t < bestTime) {
      bestTime = t;
      bestIndex = i;
    }
  });
  return bestIndex;
}

function renderRoute(response) {
  directionsRenderer.setDirections(response);
  directionsRenderer.setRouteIndex(selectedRouteIndex);

  const route = routeResults[selectedRouteIndex];
  const leg = route.legs[0];

  document.getElementById("result-duration").textContent =
    (leg.duration_in_traffic || leg.duration).text;
  document.getElementById("result-distance").textContent = leg.distance.text;

  renderAltRoutes();
  renderSteps(leg.steps);

  document.getElementById("result").classList.remove("hidden");
}

function renderAltRoutes() {
  const container = document.getElementById("alt-routes");
  container.innerHTML = "";

  if (routeResults.length <= 1) return;

  routeResults.forEach((route, i) => {
    const leg = route.legs[0];
    const btn = document.createElement("button");
    btn.className = "alt-route" + (i === selectedRouteIndex ? " selected" : "");
    btn.innerHTML = `${route.summary || `Route ${i + 1}`} — ${(leg.duration_in_traffic || leg.duration).text}, ${leg.distance.text}` +
      (i === selectedRouteIndex ? '<span class="badge">FASTEST</span>' : "");
    btn.addEventListener("click", () => {
      selectedRouteIndex = i;
      directionsRenderer.setRouteIndex(i);
      document.getElementById("result-duration").textContent =
        (leg.duration_in_traffic || leg.duration).text;
      document.getElementById("result-distance").textContent = leg.distance.text;
      renderAltRoutes();
      renderSteps(leg.steps);
    });
    container.appendChild(btn);
  });
}

function renderSteps(steps) {
  const list = document.getElementById("steps-list");
  list.innerHTML = "";
  steps.forEach((step) => {
    const li = document.createElement("li");
    const instruction = document.createElement("span");
    instruction.innerHTML = step.instructions;
    const meta = document.createElement("span");
    meta.className = "step-meta";
    meta.textContent = `${step.distance.text} · ${step.duration.text}`;
    li.appendChild(instruction);
    li.appendChild(meta);
    list.appendChild(li);
  });
}

boot();
