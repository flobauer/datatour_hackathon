mapboxgl.accessToken =
  "pk.eyJ1IjoiZmxvYmF1IiwiYSI6ImNrdW1uYW12cDFlenUzM282Ym96N3pqYTEifQ.RH29qvuc6pkcbl5JxtDzVQ";

(async () => {
  // global state FTW!!1
  let startTime = null;
  let activeTour = null;
  let activePath = [];
  let activePathDistance = 0;
  let activeMarker = null;
  let activePopup = null;

  let tours = [];
  let lookup = [];

  /*
   * SEARCH AS YOU TYPE
   * so that users can look for tours
   */
  const search_input = document.getElementById("search");
  const search_button = document.getElementById("searchbutton");
  const results = document.getElementById("results");

  search_input.addEventListener("input", (e) => {
    // re-displaying countries based on the new search_term
    searchHandler(e.target.value);
  });

  search_button.addEventListener("click", (e) => {
    // re-displaying countries based on the new search_term
    results.style.display = "block";
    results.innerHTML = document.getElementById("infocontainer").innerHTML;
  });

  const searchHandler = (search_term) => {
    if (search_term == "") {
      results.style.display = "none";
      return;
    }
    results.style.display = "block";
    results.innerHTML = "";

    const ul = document.createElement("ul");
    ul.classList.add("countries");

    const searchResult = tours.data.items.filter(
      (tour) =>
        tour.title.toLowerCase().includes(search_term.toLowerCase()) ||
        (tour.city &&
          tour.city.toLowerCase().includes(search_term.toLowerCase())) ||
        tour.id == search_term
    );

    if (!searchResult.length) {
      results.innerHTML = "Es wurde leider keine Tour gefunden.";
    }
    searchResult.splice(0, 20).forEach((tour) => {
      // creating the structure
      const li = document.createElement("li");
      li.classList.add("tour-item");
      li.innerText = tour.title;

      li.addEventListener("click", (e) => {
        // cleanup if there was any previous tour
        cleanUp();
        search_input.value = "";

        const [marker, popup] = createMarker(tour);

        // we havent clicked on the marker, so we toggle here
        marker.togglePopup();

        zoomInTour(e, marker, popup, tour);

        results.innerHTML = "";
      });
      ul.appendChild(li);
    });

    results.appendChild(ul);
  };

  const cleanUp = () => {
    document.getElementById("zoomOut").style.display = "none";

    // remove painted layers
    if (activeTour) {
      if (map.getLayer("line-" + activeTour.id)) {
        map.removeLayer("line-" + activeTour.id);
      }
      if (map.getSource("line-" + activeTour.id)) {
        map.removeSource("line-" + activeTour.id);
      }
    }
    if (activeMarker) {
      activeMarker.togglePopup();
    }
    startTime = null;
    activeTour = null;
    activePath = [];
    activePathDistance = 0;
    activeMarker = null;
    activePopup = null;
  };

  /*
   *
   * Create a Marker Pin
   *
   */
  const createMarker = (tour) => {
    const alreadyMarker = lookup[tour.coordinates.join(",")];

    if (alreadyMarker) {
      return [alreadyMarker, alreadyMarker.getPopup()];
    }
    // popup for elevation later
    const popup = new mapboxgl.Popup({ closeButton: false });
    // Add Marker to Map
    const marker = new mapboxgl.Marker({
      color: "red",
      scale: 0.8,
      draggable: false,
      pitchAlignment: "auto",
      rotationAlignment: "auto",
    })
      .setPopup(popup)
      .setLngLat(tour.coordinates)
      .addTo(map);

    // Click Handler on Marker
    marker.getElement().addEventListener("click", (e) => {
      cleanUp();
      zoomInTour(e, marker, popup, tour);
    });

    lookup[tour.coordinates.join(",")] = marker;

    return [marker, popup];
  };

  // Map Object
  const map = new mapboxgl.Map({
    container: "map",
    zoom: 8,
    center: [14.633576, 48.250435],
    style: "mapbox://styles/mapbox/satellite-streets-v11",
    interactive: true,
    hash: false,
  });

  // We wait for
  // - download of first batch of routes
  // - Loading of the map
  [tours] = await Promise.all([
    // no loaded yet
    fetch("api/all.json").then((response) => {
      // allow searching
      search_input.disabled = false;

      // return json promise
      return response.json();
    }),
    map.once("load"),
  ]);

  // Add some fog in the background
  map.setFog({
    range: [-0.5, 4],
    color: "white",
    "horizon-blend": 0.2,
  });

  // Add a sky layer over the horizon
  map.addLayer({
    id: "sky",
    type: "sky",
    paint: {
      "sky-type": "atmosphere",
      "sky-atmosphere-color": "rgba(85, 151, 210, 0.5)",
    },
  });

  // Add terrain source, with slight exaggeration
  map.addSource("mapbox-dem", {
    type: "raster-dem",
    url: "mapbox://mapbox.terrain-rgb",
    tileSize: 512,
    maxzoom: 14,
  });
  map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });

  const zoomBackOut = (e) => {
    map.flyTo({
      zoom: 8,
      center: [14.633576, 48.250435],
      pitch: 0,
      bearing: 0,
    });

    cleanUp();
  };

  document.getElementById("zoomOut").addEventListener("click", zoomBackOut);

  await map.once("idle");

  const firstRandomTours = tours.data.items.slice(0, 30);
  // We add the Pins for the routes
  firstRandomTours.forEach((tour) => {
    createMarker(tour);
  });

  const zoomInTour = async (e, marker, popup, tour) => {
    // make sure no movement
    document.getElementById("map").classList.add("pointer-none");
    document.getElementById("searchwrapper").classList.add("close");

    // fly to the clicked marker
    map.flyTo({
      center: tour.coordinates,
      zoom: 12,
      pitch: 56,
      bearing: 150,
    });

    const tourDetail = await fetch("api/tour/" + tour.id + ".json").then(
      (response) => response.json()
    );

    const coordinates = tourDetail.data.geo.geometry.split(" ");
    const coordinatesArray = [];

    for (let i = 0; i < coordinates.length; i++) {
      if (i % 2 === 0) {
        coordinatesArray.push([coordinates[i + 1], coordinates[i]]);
      }
    }

    const geoJson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: coordinatesArray,
          },
        },
      ],
    };

    // Add a line feature and layer. This feature will get updated as we progress the animation
    map.addSource("line-" + tour.id, {
      type: "geojson",
      // Line metrics is required to use the 'line-progress' property
      lineMetrics: true,
      data: geoJson,
    });
    map.addLayer({
      type: "line",
      source: "line-" + tour.id,
      id: "line-" + tour.id,
      paint: {
        "line-color": "rgba(0,0,0,0)",
        "line-width": 5,
      },
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
    });

    await map.once("idle");

    // Use the https://turfjs.org/ library to calculate line distances and
    // sample the line at a given percentage with the turf.along function.
    activePath = turf.lineString(coordinatesArray);
    // Get the total line distance
    activePathDistance = turf.lineDistance(activePath);
    // get marker
    activeMarker = marker;
    // get popup
    activePopup = popup;
    // set tour
    activeTour = tour;

    window.requestAnimationFrame(frame);
  };

  // The total animation duration, in milliseconds
  const animationDuration = 20000;

  function frame(time) {
    if (!startTime) startTime = time;

    const animationPhase = (time - startTime) / animationDuration;

    if (animationPhase > 1) {
      document.getElementById("searchwrapper").classList.remove("close");
      document.getElementById("map").classList.remove("pointer-none");
      document.getElementById("zoomOut").style.display = "block";
      return;
    }

    // Get the new latitude and longitude by sampling along the path
    const alongPath = turf.along(
      activePath,
      activePathDistance * animationPhase
    ).geometry.coordinates;
    const lngLat = {
      lng: alongPath[0],
      lat: alongPath[1],
    };

    // Sample the terrain elevation. We round to an integer value to
    // prevent showing a lot of digits during the animation
    const elevation = Math.floor(
      // Do not use terrain exaggeration to get actual meter values
      map.queryTerrainElevation(lngLat, { exaggerated: false })
    );

    // Update the popup altitude value and marker location
    activePopup.setHTML(
      activeTour.title + "<br/>Höhe: " + elevation + "m<br/>"
    );
    activeMarker.setLngLat(lngLat);

    // Reduce the visible length of the line by using a line-gradient to cutoff the line
    // animationPhase is a value between 0 and 1 that reprents the progress of the animation
    map.setPaintProperty("line-" + activeTour.id, "line-gradient", [
      "step",
      ["line-progress"],
      "#ffcc00",
      animationPhase,
      "rgba(255, 0, 0, 0)",
    ]);

    // Rotate the camera at a slightly lower speed to give some parallax effect in the background
    const rotation = 150 - animationPhase * 40.0;
    map.setBearing(rotation % 360);

    window.requestAnimationFrame(frame);
  }
})();
