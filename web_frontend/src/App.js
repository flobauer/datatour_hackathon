import React, { useState, useEffect, useRef } from "react";
import "./App.css";

import mapboxgl from "!mapbox-gl"; // eslint-disable-line import/no-webpack-loader-syntax

mapboxgl.accessToken =
  "pk.eyJ1IjoiZmxvYmF1IiwiYSI6ImNrdW1uYW12cDFlenUzM282Ym96N3pqYTEifQ.RH29qvuc6pkcbl5JxtDzVQ";

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const mapContainer = useRef(null);
  const map = useRef(null);

  useEffect(() => {
    if (map.current) return; // initialize map only once
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/flobau/ckzmrh1rf003o14o8kpeam5tm",
      center: [13.767067, 48.104741],
      zoom: 8,
    });
    map.current.on("load", async () => {
      setLoaded(true);
    });
  }, []);

  return <div ref={mapContainer} className="mapContainer" />;
}
