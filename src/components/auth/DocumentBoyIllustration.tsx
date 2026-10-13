import { useEffect, useState } from 'react';

interface DocumentBoyProps {
  className?: string;
  isRegisteredSuccess?: boolean;
}

export const DocumentBoyIllustration = ({
  className = '',
  isRegisteredSuccess = false,
}: DocumentBoyProps) => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [animationStep, setAnimationStep] = useState<number>(
    () => (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 4 : 0),
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const listener = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
      if (e.matches) setAnimationStep(4);
    };
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return;

    // Sequence timing
    const t1 = setTimeout(() => setAnimationStep(1), 200);   // Walking in
    const t2 = setTimeout(() => setAnimationStep(2), 900);   // Placing box down
    const t3 = setTimeout(() => setAnimationStep(3), 1400);  // Box opens
    const t4 = setTimeout(() => setAnimationStep(4), 1800);  // Documents float out & boy welcomes

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [prefersReducedMotion]);

  return (
    <div className={`relative flex items-center justify-center select-none overflow-hidden ${className}`}>
      {/* Background radial ambient glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-amber-500/5 to-transparent pointer-events-none rounded-3xl" />
      
      <svg
        viewBox="0 0 540 420"
        className="w-full h-auto max-h-[380px] drop-shadow-2xl"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Animated illustration of a boy carrying an official land document box"
      >
        <defs>
          <linearGradient id="skinGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FBD5B5" />
            <stop offset="100%" stopColor="#EAA87B" />
          </linearGradient>

          <linearGradient id="hairGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3D2314" />
            <stop offset="100%" stopColor="#201108" />
          </linearGradient>

          <linearGradient id="shirtGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>

          <linearGradient id="vestGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1E293B" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>

          <linearGradient id="boxWoodGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#A16207" />
            <stop offset="50%" stopColor="#854D0E" />
            <stop offset="100%" stopColor="#713F12" />
          </linearGradient>

          <linearGradient id="boxInterior" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#451A03" />
            <stop offset="100%" stopColor="#2E1002" />
          </linearGradient>

          <linearGradient id="goldBrass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="50%" stopColor="#EAB308" />
            <stop offset="100%" stopColor="#CA8A04" />
          </linearGradient>

          <linearGradient id="docPaperGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#F8FAFC" />
          </linearGradient>

          <linearGradient id="mapBlueprintGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0284C7" />
            <stop offset="100%" stopColor="#0369A1" />
          </linearGradient>

          <filter id="boxShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="8" stdDeviation="6" floodOpacity="0.35" />
          </filter>

          <filter id="paperGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#F59E0B" floodOpacity="0.4" />
          </filter>
        </defs>

        {/* Floor Shadow Platform */}
        <ellipse
          cx="270"
          cy="375"
          rx="210"
          ry="24"
          fill="currentColor"
          className="text-foreground/5 dark:text-foreground/10 transition-all duration-700"
        />

        {/* ============================================================== */}
        {/* CHARACTER: THE DEDICATED BOY                                   */}
        {/* ============================================================== */}
        <g
          className={`transition-all duration-700 ease-out ${
            animationStep === 0
              ? '-translate-x-32 opacity-0'
              : animationStep === 1
              ? '-translate-x-8 opacity-100'
              : 'translate-x-0 opacity-100'
          }`}
        >
          {/* Shadow of boy */}
          <ellipse
            cx={animationStep < 2 ? "190" : "185"}
            cy="372"
            rx="55"
            ry="14"
            fill="black"
            opacity="0.25"
          />

          {/* Left Leg (Rear) */}
          <g className={animationStep === 1 ? "animate-pulse" : ""}>
            <rect x="160" y="270" width="18" height="75" rx="8" fill="#1E293B" />
            {/* Shoe */}
            <path
              d="M154 340 C154 336, 178 336, 184 340 L188 356 C188 360, 150 360, 152 356 Z"
              fill="#451A03"
            />
            <rect x="150" y="354" width="38" height="5" rx="2" fill="#78350F" />
          </g>

          {/* Right Leg (Front) */}
          <g>
            <rect x="185" y="270" width="18" height="75" rx="8" fill="#334155" />
            {/* Shoe */}
            <path
              d="M178 340 C178 336, 202 336, 208 340 L212 356 C212 360, 174 360, 176 356 Z"
              fill="#451A03"
            />
            <rect x="174" y="354" width="38" height="5" rx="2" fill="#78350F" />
          </g>

          {/* Torso & Uniform Shirt */}
          <rect x="150" y="170" width="62" height="105" rx="14" fill="url(#shirtGrad)" />
          {/* Official Officer Waistcoat / Vest */}
          <path
            d="M150 185 C150 172, 212 172, 212 185 L212 265 L150 265 Z"
            fill="url(#vestGrad)"
          />
          {/* Collar & Tie / Badge */}
          <polygon points="170,170 181,188 192,170 181,176" fill="#F8FAFC" />
          <polygon points="177,184 185,184 183,212 179,212" fill="#EA580C" />
          {/* Official LAND-IQ ID Card on Lanyard */}
          <rect x="162" y="218" width="16" height="22" rx="3" fill="#FFFFFF" filter="url(#boxShadow)" />
          <rect x="165" y="222" width="10" height="4" fill="#3B82F6" rx="1" />
          <circle cx="170" cy="231" r="3" fill="#94A3B8" />

          {/* Head & Neck */}
          <rect x="172" y="152" width="18" height="22" rx="6" fill="url(#skinGrad)" />
          {/* Face */}
          <ellipse cx="181" cy="132" rx="28" ry="32" fill="url(#skinGrad)" />

          {/* Ears */}
          <circle cx="153" cy="134" r="7" fill="url(#skinGrad)" />
          <circle cx="209" cy="134" r="7" fill="url(#skinGrad)" />

          {/* Stylish Hair */}
          <path
            d="M152 130 C150 100, 170 92, 185 92 C204 92, 214 102, 214 125 C210 115, 202 110, 192 110 C180 110, 172 118, 162 118 C156 118, 154 124, 152 130 Z"
            fill="url(#hairGrad)"
          />
          {/* Fringe Tufts */}
          <path d="M165 106 Q175 116 182 108 Q192 118 200 108" stroke="url(#hairGrad)" strokeWidth="6" strokeLinecap="round" />

          {/* Eyes (Friendly, blinking/expressive) */}
          <ellipse cx="172" cy="130" rx="3.5" ry="4.5" fill="#1E293B" />
          <circle cx="171" cy="128.5" r="1.5" fill="#FFFFFF" />
          <ellipse cx="192" cy="130" rx="3.5" ry="4.5" fill="#1E293B" />
          <circle cx="191" cy="128.5" r="1.5" fill="#FFFFFF" />

          {/* Eyebrows */}
          <path d="M167 122 Q173 120 178 123" stroke="#2B150A" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M186 123 Q191 120 197 122" stroke="#2B150A" strokeWidth="2.5" strokeLinecap="round" />

          {/* Cheerful Smile */}
          <path
            d="M174 144 Q181 152 188 144"
            stroke="#9A3412"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
          {/* Subtle blush */}
          <circle cx="165" cy="138" r="4" fill="#F43F5E" opacity="0.25" />
          <circle cx="197" cy="138" r="4" fill="#F43F5E" opacity="0.25" />

          {/* Arms */}
          {animationStep < 2 ? (
            /* Carrying the box forward */
            <g>
              <path
                d="M152 190 Q170 215 220 220"
                stroke="url(#shirtGrad)"
                strokeWidth="16"
                strokeLinecap="round"
                fill="none"
              />
              <circle cx="222" cy="222" r="8" fill="url(#skinGrad)" />
            </g>
          ) : (
            /* Standing proudly beside the box with welcoming hand gesture */
            <g>
              {/* Left arm resting gently on waist */}
              <path
                d="M152 188 Q138 215 148 238"
                stroke="url(#shirtGrad)"
                strokeWidth="15"
                strokeLinecap="round"
                fill="none"
              />
              <circle cx="148" cy="240" r="7.5" fill="url(#skinGrad)" />

              {/* Right arm gesturing towards the open document box / form */}
              <path
                d="M210 188 Q235 205 260 200"
                stroke="url(#shirtGrad)"
                strokeWidth="15"
                strokeLinecap="round"
                fill="none"
              />
              <circle cx="264" cy="198" r="7.5" fill="url(#skinGrad)" />
            </g>
          )}
        </g>

        {/* ============================================================== */}
        {/* THE DOCUMENT BOX (OFFICIAL ARCHIVE CHEST)                      */}
        {/* ============================================================== */}
        <g
          className={`transition-all duration-700 ease-out ${
            animationStep === 0
              ? 'opacity-0 scale-75'
              : animationStep === 1
              ? 'translate-x-12 translate-y-6 opacity-100 scale-95'
              : 'translate-x-0 translate-y-0 opacity-100 scale-100'
          }`}
          style={{ transformOrigin: '320px 320px' }}
        >
          {/* Box Shadow */}
          <ellipse cx="330" cy="365" rx="80" ry="16" fill="black" opacity="0.3" />

          {/* Main Box Body */}
          <rect
            x="245"
            y="265"
            width="170"
            height="95"
            rx="10"
            fill="url(#boxWoodGrad)"
            filter="url(#boxShadow)"
          />

          {/* Box Interior / Cavity visible when open */}
          <rect x="250" y="268" width="160" height="28" rx="6" fill="url(#boxInterior)" />

          {/* Wood Planks Lines */}
          <line x1="245" y1="298" x2="415" y2="298" stroke="#582900" strokeWidth="2" opacity="0.6" />
          <line x1="245" y1="330" x2="415" y2="330" stroke="#582900" strokeWidth="2" opacity="0.6" />

          {/* Brass Corner Brackets */}
          <polygon points="245,265 265,265 245,285" fill="url(#goldBrass)" />
          <polygon points="415,265 395,265 415,285" fill="url(#goldBrass)" />
          <polygon points="245,360 265,360 245,340" fill="url(#goldBrass)" />
          <polygon points="415,360 395,360 415,340" fill="url(#goldBrass)" />

          {/* Brass Clasp & Seal */}
          <rect x="315" y="278" width="30" height="20" rx="4" fill="url(#goldBrass)" />
          <circle cx="330" cy="288" r="4" fill="#713F12" />
          {/* Seal Emblem: "LAND-IQ" */}
          <rect x="295" y="315" width="70" height="26" rx="6" fill="#F8FAFC" opacity="0.95" />
          <text
            x="330"
            y="332"
            textAnchor="middle"
            fill="#C2410C"
            fontSize="10"
            fontWeight="bold"
            fontFamily="sans-serif"
            letterSpacing="1"
          >
            LAND-IQ
          </text>

          {/* Side Brass Handles */}
          <path d="M242 305 C236 305 236 325 242 325" stroke="url(#goldBrass)" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M418 305 C424 305 424 325 418 325" stroke="url(#goldBrass)" strokeWidth="4" fill="none" strokeLinecap="round" />

          {/* ========================================================== */}
          {/* THE BOX LID (Animated Hinge Opening)                       */}
          {/* ========================================================== */}
          <g
            className={`transition-transform duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
              animationStep >= 3 ? '-rotate-[115deg]' : 'rotate-0'
            }`}
            style={{ transformOrigin: '245px 265px' }}
          >
            {/* Lid Main */}
            <rect
              x="240"
              y="245"
              width="180"
              height="24"
              rx="6"
              fill="url(#boxWoodGrad)"
              filter="url(#boxShadow)"
            />
            {/* Lid Trim */}
            <rect x="240" y="260" width="180" height="6" fill="url(#goldBrass)" />
            {/* Handle on Lid Top */}
            <path
              d="M310 245 C310 236 350 236 350 245"
              stroke="url(#goldBrass)"
              strokeWidth="5"
              fill="none"
              strokeLinecap="round"
            />
          </g>
        </g>

        {/* ============================================================== */}
        {/* FLOATING LAND DOCUMENTS & MAP ELEMENTS                         */}
        {/* ============================================================== */}
        {animationStep >= 3 && (
          <g className="transition-all duration-700">
            {/* Document 1: Official Land Deed (Patta / Title Certificate) */}
            <g
              className="animate-bounce"
              style={{
                animationDuration: '3.2s',
                animationTimingFunction: 'ease-in-out',
                animationIterationCount: prefersReducedMotion ? '1' : 'infinite',
              }}
            >
              <rect
                x="280"
                y="145"
                width="85"
                height="115"
                rx="6"
                fill="url(#docPaperGrad)"
                filter="url(#paperGlow)"
                transform="rotate(-8 322 202)"
              />
              {/* Header Bar */}
              <rect x="290" y="156" width="65" height="8" rx="2" fill="#EA580C" transform="rotate(-8 322 202)" />
              {/* Text Lines */}
              <rect x="290" y="172" width="55" height="4" rx="2" fill="#CBD5E1" transform="rotate(-8 322 202)" />
              <rect x="290" y="182" width="60" height="4" rx="2" fill="#E2E8F0" transform="rotate(-8 322 202)" />
              <rect x="290" y="192" width="45" height="4" rx="2" fill="#E2E8F0" transform="rotate(-8 322 202)" />
              <rect x="290" y="202" width="52" height="4" rx="2" fill="#E2E8F0" transform="rotate(-8 322 202)" />
              {/* Golden Stamp / Official Seal */}
              <circle cx="340" cy="235" r="12" fill="#F59E0B" opacity="0.3" transform="rotate(-8 322 202)" />
              <circle cx="340" cy="235" r="9" stroke="#D97706" strokeWidth="2" fill="none" transform="rotate(-8 322 202)" />
              <path d="M336 235 L339 238 L345 231" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" transform="rotate(-8 322 202)" />
            </g>

            {/* Document 2: Cadastral Survey Blueprint / GIS Parcel Map */}
            <g
              style={{
                animation: prefersReducedMotion ? 'none' : 'slowDrift 4s ease-in-out infinite alternate',
              }}
            >
              <rect
                x="350"
                y="165"
                width="95"
                height="100"
                rx="6"
                fill="url(#mapBlueprintGrad)"
                filter="url(#paperGlow)"
                transform="rotate(12 397 215)"
              />
              {/* Parcel Grid Lines */}
              <path
                d="M362 185 L428 185 M362 205 L435 205 M362 225 L425 225 M380 175 L380 245 M410 178 L410 248"
                stroke="#BAE6FD"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                opacity="0.8"
                transform="rotate(12 397 215)"
              />
              {/* Highlighted Survey Parcel Polygon */}
              <polygon
                points="385,190 415,192 422,222 390,225"
                fill="#38BDF8"
                opacity="0.5"
                stroke="#FFFFFF"
                strokeWidth="2"
                transform="rotate(12 397 215)"
              />
              <circle cx="403" cy="207" r="4" fill="#F59E0B" transform="rotate(12 397 215)" />
            </g>

            {/* Floating Golden Compass Rose & Verified Badge */}
            <g
              style={{
                animation: prefersReducedMotion ? 'none' : 'pulse-halo 2.5s ease-in-out infinite',
              }}
            >
              <circle cx="260" cy="180" r="18" fill="url(#goldBrass)" filter="url(#boxShadow)" />
              <polygon points="260,166 264,178 274,180 264,182 260,194 256,182 246,180 256,178" fill="#FFFFFF" />
              <circle cx="260" cy="180" r="3" fill="#713F12" />
            </g>

            {/* Floating Magic Sparks / Particles */}
            <circle cx="310" cy="120" r="3" fill="#F59E0B" className="animate-ping" style={{ animationDuration: '2s' }} />
            <circle cx="430" cy="140" r="2.5" fill="#38BDF8" className="animate-ping" style={{ animationDuration: '2.5s' }} />
            <circle cx="240" cy="220" r="2" fill="#EA580C" className="animate-ping" style={{ animationDuration: '3s' }} />
          </g>
        )}

        {/* Success Checkmark Banner if registered/authenticated */}
        {isRegisteredSuccess && (
          <g className="animate-bounce" style={{ animationDuration: '1s' }}>
            <rect x="180" y="40" width="180" height="40" rx="20" fill="#16A34A" filter="url(#boxShadow)" />
            <circle cx="205" cy="60" r="12" fill="#FFFFFF" />
            <path d="M199 60 L203 64 L211 56" stroke="#16A34A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <text x="225" y="65" fill="#FFFFFF" fontSize="13" fontWeight="bold" fontFamily="sans-serif">
              Account Verified!
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};
