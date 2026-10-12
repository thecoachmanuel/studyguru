const fs = require('fs');
const path = require('path');

// Human head profile silhouette (exact vector language from the reference)
const HEAD_PATH = 'M153.013,279.996C139.821,262.443 132,240.628 132,217C132,159.049 179.049,112 237,112C294.951,112 342,159.049 342,217C342,220.345 341.843,223.653 341.537,226.918C341.474,227.578 341.591,228.243 341.875,228.843C344.689,234.774 360.347,267.768 366.509,280.751C367.049,281.889 366.968,283.225 366.295,284.289C365.621,285.354 364.449,286 363.189,286C357.37,286 348.592,286 343.674,286C341.645,286 340,287.645 340,289.674C340,300.326 340,331.368 340,345.652C340,349.71 336.71,353 332.652,353C319.506,353 292.524,353 283.793,353C282.142,353 280.694,354.101 280.253,355.691C278.398,362.367 273.602,379.633 271.747,386.309C271.306,387.899 269.858,389 268.207,389C253.845,389 188.26,389 169.83,389C168.682,389 167.601,388.464 166.906,387.55C166.211,386.637 165.983,385.451 166.289,384.345C169.943,371.149 180.254,333.916 182.545,325.642C182.834,324.601 182.649,323.485 182.04,322.592C176.962,315.144 153.444,280.652 153.006,280.009C153.005,280.007 153.005,280.004 153.006,280.001C153.007,279.999 153.01,279.997 153.013,279.997C153.013,279.996 153.013,279.996 153.013,279.996Z';

// Guru emblem: An enlightened wisdom star and knowledge nexus at center (241, 219)
// It has 8 radiant points (4 cardinal, 4 diagonal), concave aerodynamic tapers, an orbital intellect ring, and a core spark
// Center: (241, 219)
// Cardinal points: (241, 150), (310, 219), (241, 288), (172, 219)
// Pinched inner waist: radius 22 at (241±16, 219±16)
// Diagonal tips: radius 46 at 45 degrees: (273, 187), (273, 251), (209, 251), (209, 187)

// SVG path for the 8-point Guru Wisdom Spark:
const GURU_SPARK_PATH = `
M 241,150 
Q 241,202 273,187 
Q 258,219 310,219 
Q 258,219 273,251 
Q 241,236 241,288 
Q 241,236 209,251 
Q 224,219 172,219 
Q 224,219 209,187 
Q 241,202 241,150 Z
`.replace(/\s+/g, ' ').trim();

// Inner core cutout / halo
const GURU_INNER_RING = `
M 241,203 A 16 16 0 1 0 241,235 A 16 16 0 1 0 241,203 Z
`.replace(/\s+/g, ' ').trim();

// Combined path with nonzero / evenodd winding or separate elements:
// In separate elements:
// 1) Guru Spark (<path d="..." fill={sparkFill} />)
// 2) Orbital wisdom ring or center insight dot (<circle cx="241" cy="219" r="15" fill={bgFill} /><circle cx="241" cy="219" r="7" fill={sparkFill} />)

console.log('Spark path:', GURU_SPARK_PATH);

// Create the SVG logo string:
function buildLogoSvg({ isWhite = false } = {}) {
  const headFill = isWhite ? '#FFFFFF' : '#1D4ED8';
  const sparkFill = isWhite ? '#1D4ED8' : '#FFFFFF';
  const centerRingFill = isWhite ? '#FFFFFF' : '#1D4ED8';
  const centerDotFill = isWhite ? '#1D4ED8' : '#FFFFFF';
  const textDark = isWhite ? '#FFFFFF' : '#0F172A';
  const textAccent = isWhite ? '#93C5FD' : '#1D4ED8';

  return `<svg width="680" height="180" viewBox="0 0 680 180" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(10, 10)">
    <!-- Guru Head & Wisdom Emblem -->
    <g transform="matrix(0.55, 0, 0, 0.55, -60, -50)">
      <!-- Head Profile Silhouette -->
      <path d="${HEAD_PATH}" fill="${headFill}" />
      
      <!-- Guru Wisdom & Enlightenment Star -->
      <path d="${GURU_SPARK_PATH}" fill="${sparkFill}" />
      
      <!-- Wisdom Core Ring & Insight Nexus -->
      <circle cx="241" cy="219" r="16" fill="${centerRingFill}" />
      <circle cx="241" cy="219" r="7" fill="${centerDotFill}" />
    </g>

    <!-- StudyGuru Wordmark -->
    <text
      x="160"
      y="105"
      font-family="'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif"
      font-size="82"
      font-weight="800"
      letter-spacing="-2px"
      fill="${textDark}"
    >
      Study<tspan fill="${textAccent}">Guru</tspan>
    </text>
  </g>
</svg>`;
}

const defaultSvg = buildLogoSvg({ isWhite: false });
const whiteSvg = buildLogoSvg({ isWhite: true });

const targetDir = path.resolve('public');
fs.writeFileSync(path.join(targetDir, 'logo.svg'), defaultSvg);
fs.writeFileSync(path.join(targetDir, 'logo-white.svg'), whiteSvg);
console.log('Written logo.svg and logo-white.svg');
