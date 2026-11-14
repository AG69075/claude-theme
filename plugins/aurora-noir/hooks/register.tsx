import type { Register, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'

const { theme, problems } = makeColors({
  label: 'Aurora Noir',
  only: 'dark',
  roles: { accent: '#3affc0', danger: '#ff6b81', success: '#5dffb5', warning: '#ffc46b', pro: '#9f7bff' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0a1020',
        'surface-1': '#0f172b',
        'surface-2': '#141e36',
        'surface-3': '#162039',
        'text-primary': '#ffffff',
        'text-secondary': '#9fadc6',
        'text-muted': '#8996b0',
      },
    },
  },
})

const soft = (id: string, color: string, o: number) =>
  `<radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity="${o}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`

// Same layout as the stock aurora, with every glow at about a third of its strength on near-black.
const SCENE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
<style>
.ribbon{transform-origin:50% 0;animation:wave 14s ease-in-out infinite alternate,glowpulse 9s ease-in-out infinite alternate}
.ribbon.b{animation-duration:19s,11s;animation-direction:alternate-reverse,alternate}
.ribbon.c{transform-origin:50% 50%;animation-duration:24s,13s}
.star{animation:twinkle 4s ease-in-out infinite alternate}
@keyframes twinkle{from{opacity:0.15}to{opacity:0.9}}
.haze{animation:breathe 12s ease-in-out infinite alternate}
@keyframes wave{from{transform:translateX(-300px) skewX(-12deg) scaleY(0.85)}to{transform:translateX(300px) skewX(12deg) scaleY(1.2)}}
@keyframes glowpulse{from{opacity:0.45}to{opacity:1}}
@keyframes breathe{from{opacity:0.5}to{opacity:1}}
@media (prefers-reduced-motion:reduce){.ribbon,.haze,.star{animation:none}}
</style>
<defs>
<linearGradient id="night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#060919"/><stop offset="0.55" stop-color="#04060f"/><stop offset="1" stop-color="#020307"/></linearGradient>
${soft('green', '#3affc0', 0.24)}${soft('violet', '#9f7bff', 0.22)}${soft('glow', '#3affc0', 0.14)}${soft('dusk', '#7a5cff', 0.14)}
</defs>
<rect width="1600" height="1000" fill="url(#night)"/>
<ellipse class="haze" cx="260" cy="80" rx="520" ry="260" fill="url(#glow)"/>
<ellipse class="haze" cx="1400" cy="60" rx="480" ry="240" fill="url(#dusk)" style="animation-delay:-12s"/>
<g class="ribbon"><ellipse cx="-40" cy="230" rx="330" ry="150" fill="url(#green)"/><ellipse cx="260" cy="170" rx="360" ry="170" fill="url(#green)"/><ellipse cx="600" cy="230" rx="340" ry="140" fill="url(#green)"/><ellipse cx="930" cy="160" rx="360" ry="150" fill="url(#green)"/><ellipse cx="1270" cy="110" rx="340" ry="140" fill="url(#green)"/><ellipse cx="1600" cy="170" rx="330" ry="150" fill="url(#green)"/></g>
<g class="ribbon b"><ellipse cx="80" cy="110" rx="340" ry="130" fill="url(#violet)"/><ellipse cx="460" cy="80" rx="360" ry="140" fill="url(#violet)"/><ellipse cx="860" cy="290" rx="330" ry="120" fill="url(#violet)"/><ellipse cx="1220" cy="270" rx="350" ry="130" fill="url(#violet)"/><ellipse cx="1560" cy="80" rx="340" ry="140" fill="url(#violet)"/></g>
<g class="ribbon c"><ellipse cx="90" cy="430" rx="300" ry="260" fill="url(#green)"/><ellipse cx="150" cy="700" rx="260" ry="220" fill="url(#violet)"/><ellipse cx="1510" cy="460" rx="300" ry="270" fill="url(#violet)"/><ellipse cx="1470" cy="720" rx="260" ry="220" fill="url(#green)"/></g>
<circle class="star" cx="120" cy="60" r="2.6" fill="#cfe9ff" style="animation-delay:-0.0s;animation-duration:3s"/><circle class="star" cx="310" cy="140" r="1.8" fill="#cfe9ff" style="animation-delay:-0.7s;animation-duration:4s"/><circle class="star" cx="470" cy="40" r="1.8" fill="#cfe9ff" style="animation-delay:-1.4s;animation-duration:5s"/><circle class="star" cx="640" cy="110" r="2.6" fill="#cfe9ff" style="animation-delay:-2.1s;animation-duration:6s"/><circle class="star" cx="790" cy="70" r="1.8" fill="#cfe9ff" style="animation-delay:-2.8s;animation-duration:3s"/><circle class="star" cx="950" cy="150" r="1.8" fill="#cfe9ff" style="animation-delay:-3.5s;animation-duration:4s"/><circle class="star" cx="1100" cy="50" r="2.6" fill="#cfe9ff" style="animation-delay:-4.2s;animation-duration:5s"/><circle class="star" cx="1260" cy="120" r="1.8" fill="#cfe9ff" style="animation-delay:-4.9s;animation-duration:6s"/><circle class="star" cx="1420" cy="60" r="1.8" fill="#cfe9ff" style="animation-delay:-5.6s;animation-duration:3s"/><circle class="star" cx="1530" cy="170" r="2.6" fill="#cfe9ff" style="animation-delay:-6.3s;animation-duration:4s"/><circle class="star" cx="220" cy="260" r="1.8" fill="#cfe9ff" style="animation-delay:-7.0s;animation-duration:5s"/><circle class="star" cx="560" cy="230" r="1.8" fill="#cfe9ff" style="animation-delay:-7.7s;animation-duration:6s"/><circle class="star" cx="880" cy="250" r="2.6" fill="#cfe9ff" style="animation-delay:-8.4s;animation-duration:3s"/><circle class="star" cx="1180" cy="240" r="1.8" fill="#cfe9ff" style="animation-delay:-9.1s;animation-duration:4s"/><circle class="star" cx="1480" cy="290" r="1.8" fill="#cfe9ff" style="animation-delay:-9.8s;animation-duration:5s"/><circle class="star" cx="70" cy="180" r="2.6" fill="#cfe9ff" style="animation-delay:-10.5s;animation-duration:6s"/><circle class="star" cx="700" cy="20" r="1.8" fill="#cfe9ff" style="animation-delay:-11.2s;animation-duration:3s"/><circle class="star" cx="1020" cy="90" r="1.8" fill="#cfe9ff" style="animation-delay:-11.9s;animation-duration:4s"/><circle class="star" cx="390" cy="300" r="2.6" fill="#cfe9ff" style="animation-delay:-12.6s;animation-duration:5s"/><circle class="star" cx="1340" cy="20" r="1.8" fill="#cfe9ff" style="animation-delay:-13.3s;animation-duration:6s"/>
<path d="M0 1000 L0 930 L180 880 L330 925 L520 868 L700 930 L900 892 L1080 938 L1260 876 L1430 926 L1600 884 L1600 1000Z" fill="#010205"/>
</svg>`

const LOOK: ThemeSetArgs = {
  colors: theme,
  backdrop: { scene: 'aurora-noir', glass: { blur: 18, tint: '#020308', opacity: 0.28 } },
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))
    if (unpainted !== undefined) {
      $.ui.toast(unpainted)
    }
    const set = await $.theme.set(LOOK)
    if (!set.isDrawn) {
      $.ui.status(set.reason)
    }
    return next(e)
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if (e.surface !== 'desktop' && e.surface !== 'mobile') {
      return next(e)
    }
    const { Svg } = $.ui.resolve(e)
    return <Svg source={SCENE} alt="A very dim aurora over a dark ridge" isInteractive />
  })
}
