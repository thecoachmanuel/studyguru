/**
 * OpenAI DALL-E Image Generation Engine for StudyCord AI
 * Supports OpenAI DALL-E-3 and DALL-E-2 with automatic fallback.
 * Strictly zero Pollinations AI dependencies.
 */

export async function generateOpenAIImage(prompt, { rawSubject = 'Concept' } = {}) {
  const openaiApiKey = (process.env.OPENAI_API_KEY || '').trim();
  const openrouterApiKey = (process.env.OPENROUTER_API_KEY || '').trim();

  const cleanSubject = rawSubject.replace(/[#*`_]+/g, '').trim() || 'Academic Concept';
  const cleanPrompt = `${cleanSubject}, clear high-definition educational scientific illustration, textbook diagram, sharp focus, 4k resolution`;

  // 1. Try OpenAI DALL-E-3
  if (openaiApiKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: cleanPrompt,
          n: 1,
          size: '1024x1024',
          quality: 'standard',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const imageUrl = data?.data?.[0]?.url;
        if (imageUrl) {
          return imageUrl;
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.warn('[OpenAI DALL-E-3] Warning:', errorData?.error?.message || response.statusText);

        // Fallback to DALL-E-2 if DALL-E-3 failed
        const v2Response = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify({
            model: 'dall-e-2',
            prompt: cleanPrompt.slice(0, 1000),
            n: 1,
            size: '1024x1024',
          }),
        });

        if (v2Response.ok) {
          const v2Data = await v2Response.json();
          const v2Url = v2Data?.data?.[0]?.url;
          if (v2Url) return v2Url;
        }
      }
    } catch (err) {
      console.warn('[OpenAI Image Generation Error]:', err.message);
    }
  }

  // 2. High-resolution pedagogical SVG visual illustration fallback (100% reliable, subject-aware, zero external downtime)
  const escapedSubject = cleanSubject
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  // Derive contextual subject theme and color palette
  const theme = getSubjectTheme(cleanSubject, prompt);
  const glyph = renderSubjectGlyph(theme.type, theme.primary, theme.secondary, cleanSubject);

  const svgDiagram = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0A0A0A"/>
        <stop offset="50%" stop-color="${theme.bgGrad[0]}"/>
        <stop offset="100%" stop-color="#0E0E0E"/>
      </linearGradient>
      <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${theme.primary}"/>
        <stop offset="100%" stop-color="${theme.secondary}"/>
      </linearGradient>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.04)" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="1024" height="1024" fill="url(#bg)"/>
    <rect width="1024" height="1024" fill="url(#grid)"/>
    
    <!-- Outer Glow Frame -->
    <rect x="40" y="40" width="944" height="944" rx="32" fill="none" stroke="${theme.primary}" stroke-opacity="0.3" stroke-width="2"/>
    
    <!-- Header Badge -->
    <rect x="80" y="80" width="360" height="48" rx="24" fill="rgba(255, 255, 255, 0.05)" stroke="${theme.primary}" stroke-opacity="0.4" stroke-width="1.5"/>
    <circle cx="106" cy="104" r="8" fill="${theme.primary}"/>
    <text x="126" y="111" fill="${theme.primary}" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="800" letter-spacing="1">STUDYCORD AI · ${theme.badge}</text>
    
    <!-- Center Scientific Visual Glyph -->
    <g transform="translate(512, 470)">
      ${glyph}
    </g>
    
    <!-- Subject Title -->
    <text x="512" y="780" text-anchor="middle" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-size="34" font-weight="800" letter-spacing="-0.5">${escapedSubject}</text>
    <text x="512" y="822" text-anchor="middle" fill="#A3A3A3" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="500">${theme.title} · StudyCord Engine</text>
    
    <!-- Footer Note -->
    <rect x="80" y="890" width="864" height="52" rx="16" fill="rgba(255, 255, 255, 0.04)" stroke="rgba(255, 255, 255, 0.08)" stroke-width="1"/>
    <text x="110" y="922" fill="#D4D4D4" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="600">💡 Tip: Ask StudyCord AI to "break down this model step-by-step" or "quiz me on this topic".</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svgDiagram)}`;
}

function getSubjectTheme(subject, prompt) {
  const text = `${subject} ${prompt}`.toLowerCase();
  if (/bio|cell|dna|organ|gene|plant|animal|heart|neuron|blood|virus|bacteria|ecology|photosyn/i.test(text)) {
    return {
      type: 'biology',
      badge: 'BIOLOGICAL SYSTEM',
      primary: '#10B981',
      secondary: '#06B6D4',
      bgGrad: ['#0B1B15'],
      title: 'Structural Anatomy & Biological Pathway',
    };
  }
  if (/chem|atom|molecule|bond|reaction|physics|energy|quantum|force|thermo|wave|electron/i.test(text)) {
    return {
      type: 'chemistry_physics',
      badge: 'PHYSICAL SCIENCES',
      primary: '#A855F7',
      secondary: '#EC4899',
      bgGrad: ['#1B0D22'],
      title: 'Molecular Dynamics & Particle Interaction',
    };
  }
  if (/math|calc|algebra|matrix|vector|stat|probab|equation|function|deriv|integr|geometry/i.test(text)) {
    return {
      type: 'math',
      badge: 'MATHEMATICAL MODEL',
      primary: '#3B82F6',
      secondary: '#06B6D4',
      bgGrad: ['#0B1526'],
      title: 'Analytical Function & Geometric Formulation',
    };
  }
  if (/code|program|algorithm|data|software|comput|binary|network|cloud|db|sql|system|neural/i.test(text)) {
    return {
      type: 'tech',
      badge: 'SYSTEM ARCHITECTURE',
      primary: '#40E378',
      secondary: '#10B981',
      bgGrad: ['#0A1A10'],
      title: 'Algorithmic Data Flow & Processing Pipeline',
    };
  }
  if (/history|lit|philos|econom|law|govern|cultur|lang|art|music|psych|social/i.test(text)) {
    return {
      type: 'humanities',
      badge: 'CONCEPTUAL FRAMEWORK',
      primary: '#F59E0B',
      secondary: '#EF4444',
      bgGrad: ['#1F1608'],
      title: 'Thematic Synthesis & Structural Taxonomy',
    };
  }
  return {
    type: 'general',
    badge: 'SCHEMATIC MODEL',
    primary: '#40E378',
    secondary: '#25CC5F',
    bgGrad: ['#121A14'],
    title: 'Core Concept & Systematic Breakdown',
  };
}

function renderSubjectGlyph(type, p, s, subject) {
  if (type === 'biology') {
    return `
      <!-- Biological Double Helix & Cellular Organelle Pathway -->
      <circle cx="0" cy="0" r="160" fill="none" stroke="${p}" stroke-opacity="0.25" stroke-width="2" stroke-dasharray="8 6"/>
      <ellipse cx="0" cy="0" rx="130" ry="85" fill="none" stroke="${p}" stroke-width="2.5" transform="rotate(-30)"/>
      <ellipse cx="0" cy="0" rx="130" ry="85" fill="none" stroke="${s}" stroke-width="2.5" transform="rotate(30)"/>
      <circle cx="0" cy="0" r="45" fill="rgba(16, 185, 129, 0.18)" stroke="${p}" stroke-width="2"/>
      <circle cx="0" cy="0" r="12" fill="${s}"/>
      <circle cx="-110" cy="-60" r="14" fill="${p}"/>
      <circle cx="110" cy="60" r="14" fill="${p}"/>
      <circle cx="-110" cy="60" r="14" fill="${s}"/>
      <circle cx="110" cy="-60" r="14" fill="${s}"/>
    `;
  }
  if (type === 'chemistry_physics') {
    return `
      <!-- Atomic Shells & Molecular Lattice -->
      <circle cx="0" cy="0" r="160" fill="none" stroke="${p}" stroke-opacity="0.3" stroke-width="1.5"/>
      <ellipse cx="0" cy="0" rx="150" ry="50" fill="none" stroke="${p}" stroke-width="2" transform="rotate(0)"/>
      <ellipse cx="0" cy="0" rx="150" ry="50" fill="none" stroke="${s}" stroke-width="2" transform="rotate(60)"/>
      <ellipse cx="0" cy="0" rx="150" ry="50" fill="none" stroke="${p}" stroke-width="2" transform="rotate(120)"/>
      <circle cx="0" cy="0" r="28" fill="${p}"/>
      <circle cx="-150" cy="0" r="10" fill="${s}"/>
      <circle cx="75" cy="130" r="10" fill="${p}"/>
      <circle cx="75" cy="-130" r="10" fill="${s}"/>
    `;
  }
  if (type === 'math') {
    return `
      <!-- Coordinate Graph & Analytical Wave Vector -->
      <line x1="-180" y1="0" x2="180" y2="0" stroke="rgba(255,255,255,0.4)" stroke-width="2"/>
      <line x1="0" y1="-150" x2="0" y2="150" stroke="rgba(255,255,255,0.4)" stroke-width="2"/>
      <path d="M -160 80 Q -80 -120 0 0 T 160 -80" fill="none" stroke="${p}" stroke-width="4"/>
      <polygon points="180,0 170,-6 170,6" fill="rgba(255,255,255,0.6)"/>
      <polygon points="0,-150 -6,-140 6,-140" fill="rgba(255,255,255,0.6)"/>
      <circle cx="-80" cy="-60" r="9" fill="${s}"/>
      <circle cx="80" cy="60" r="9" fill="${p}"/>
      <circle cx="0" cy="0" r="6" fill="#fff"/>
    `;
  }
  if (type === 'tech') {
    return `
      <!-- Algorithmic Nodes & Flow Architecture -->
      <rect x="-160" y="-45" width="90" height="90" rx="18" fill="rgba(64, 227, 120, 0.15)" stroke="${p}" stroke-width="2"/>
      <rect x="-45" y="-45" width="90" height="90" rx="18" fill="rgba(16, 185, 129, 0.25)" stroke="${p}" stroke-width="2.5"/>
      <rect x="70" y="-45" width="90" height="90" rx="18" fill="rgba(64, 227, 120, 0.15)" stroke="${p}" stroke-width="2"/>
      <line x1="-70" y1="0" x2="-45" y2="0" stroke="${s}" stroke-width="3"/>
      <line x1="45" y1="0" x2="70" y2="0" stroke="${s}" stroke-width="3"/>
      <circle cx="-115" cy="0" r="10" fill="${p}"/>
      <circle cx="0" cy="0" r="14" fill="#FFFFFF"/>
      <circle cx="115" cy="0" r="10" fill="${p}"/>
      <path d="M 0 -45 L 0 -90 L 115 -90 L 115 -45" fill="none" stroke="${p}" stroke-width="1.5" stroke-dasharray="4 4"/>
    `;
  }
  if (type === 'humanities') {
    return `
      <!-- Conceptual Tripartite Balance & Taxonomy Framework -->
      <polygon points="0,-130 -140,90 140,90" fill="none" stroke="${p}" stroke-width="2.5"/>
      <circle cx="0" cy="-130" r="24" fill="${p}"/>
      <circle cx="-140" cy="90" r="24" fill="${s}"/>
      <circle cx="140" cy="90" r="24" fill="${p}"/>
      <circle cx="0" cy="15" r="38" fill="rgba(245, 158, 11, 0.15)" stroke="${s}" stroke-width="2"/>
      <line x1="0" y1="-130" x2="0" y2="15" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
      <line x1="-140" y1="90" x2="0" y2="15" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
      <line x1="140" y1="90" x2="0" y2="15" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
    `;
  }
  return `
    <circle cx="0" cy="0" r="160" fill="none" stroke="${p}" stroke-opacity="0.25" stroke-width="2" stroke-dasharray="8 6"/>
    <circle cx="0" cy="0" r="120" fill="none" stroke="${p}" stroke-width="3"/>
    <circle cx="0" cy="0" r="50" fill="rgba(64, 227, 120, 0.15)" stroke="${p}" stroke-width="2"/>
    <circle cx="-120" cy="0" r="14" fill="${p}"/>
    <circle cx="120" cy="0" r="14" fill="${p}"/>
    <circle cx="0" cy="-120" r="14" fill="${s}"/>
    <circle cx="0" cy="120" r="14" fill="${s}"/>
  `;
}
