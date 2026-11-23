/// <reference types="vite/client" />

import { useEffect, useRef } from 'react';
import flightMapSvg from '../assets/flytoaspan-flight-map.svg?raw';

// Inline this local SVG so that the Atlantic flight can start on a random timer.
const mapMarkup = { __html: flightMapSvg };

export function HeroFlightMap() {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const flight = mapRef.current?.querySelector<SVGAnimationElement>('#hfm-atlantic-flight');
    const visibility = flight?.parentElement?.querySelector<SVGAnimationElement>('animate[attributeName="opacity"]');
    if (!flight?.beginElement || !visibility?.beginElement) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let departureTimer: number | undefined;

    const scheduleDeparture = (minimumMs: number, maximumMs: number) => {
      window.clearTimeout(departureTimer);
      if (reducedMotion.matches) return;

      const delay = minimumMs + Math.random() * (maximumMs - minimumMs);
      departureTimer = window.setTimeout(() => {
        flight.beginElement();
        visibility.beginElement();
      }, delay);
    };

    const scheduleFirstDeparture = () => scheduleDeparture(1800, 5200);
    const scheduleNextDeparture = () => scheduleDeparture(7000, 16000);

    flight.addEventListener('endEvent', scheduleNextDeparture);
    reducedMotion.addEventListener('change', scheduleFirstDeparture);
    scheduleFirstDeparture();

    return () => {
      window.clearTimeout(departureTimer);
      flight.removeEventListener('endEvent', scheduleNextDeparture);
      reducedMotion.removeEventListener('change', scheduleFirstDeparture);
    };
  }, []);

  return (
    <div
      ref={mapRef}
      className="hero-geo-map"
      aria-hidden="true"
      dangerouslySetInnerHTML={mapMarkup}
    />
  );
}
