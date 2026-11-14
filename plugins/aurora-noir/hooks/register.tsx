import type { Register, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'

const { theme, problems } = makeColors({
  label: 'Aurora Noir',
  only: 'dark',
  roles: { accent: '#3affc0', danger: '#ff6b81', success: '#5dffb5', warning: '#ffc46b', pro: '#9f7bff' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#05070d',
        'surface-1': '#090c15',
        'surface-2': '#0d111c',
        'surface-3': '#121726',
        'text-primary': '#ffffff',
        'text-secondary': '#9fadc6',
        'text-muted': '#7d8aa5',
      },
    },
  },
})

const soft = (id: string, color: string, o: number) =>
  `<radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity="${o}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`

// Same layout as the stock aurora, with every glow at about a third of its strength on near-black.
const SCENE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
<style>
.ribbon{transform-origin:50% 0;animation:wave 52s ease-in-out infinite alternate}
.ribbon.b{animation-duration:71s;animation-direction:alternate-reverse}
.ribbon.c{transform-origin:50% 50%;animation-duration:96s}
.haze{animation:breathe 34s ease-in-out infinite alternate}
@keyframes wave{from{transform:translateX(-70px) skewX(-7deg) scaleY(0.94)}to{transform:translateX(70px) skewX(7deg) scaleY(1.08)}}
@keyframes breathe{from{opacity:0.5}to{opacity:1}}
@media (prefers-reduced-motion:reduce){.ribbon,.haze{animation:none}}
</style>
<defs>
<linearGradient id="night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#060919"/><stop offset="0.55" stop-color="#04060f"/><stop offset="1" stop-color="#020307"/></linearGradient>
${soft('green', '#3affc0', 0.11)}${soft('violet', '#9f7bff', 0.1)}${soft('glow', '#3affc0', 0.07)}${soft('dusk', '#7a5cff', 0.07)}
</defs>
<rect width="1600" height="1000" fill="url(#night)"/>
<ellipse class="haze" cx="260" cy="80" rx="520" ry="260" fill="url(#glow)"/>
<ellipse class="haze" cx="1400" cy="60" rx="480" ry="240" fill="url(#dusk)" style="animation-delay:-12s"/>
<g class="ribbon"><ellipse cx="-40" cy="230" rx="330" ry="150" fill="url(#green)"/><ellipse cx="260" cy="170" rx="360" ry="170" fill="url(#green)"/><ellipse cx="600" cy="230" rx="340" ry="140" fill="url(#green)"/><ellipse cx="930" cy="160" rx="360" ry="150" fill="url(#green)"/><ellipse cx="1270" cy="110" rx="340" ry="140" fill="url(#green)"/><ellipse cx="1600" cy="170" rx="330" ry="150" fill="url(#green)"/></g>
<g class="ribbon b"><ellipse cx="80" cy="110" rx="340" ry="130" fill="url(#violet)"/><ellipse cx="460" cy="80" rx="360" ry="140" fill="url(#violet)"/><ellipse cx="860" cy="290" rx="330" ry="120" fill="url(#violet)"/><ellipse cx="1220" cy="270" rx="350" ry="130" fill="url(#violet)"/><ellipse cx="1560" cy="80" rx="340" ry="140" fill="url(#violet)"/></g>
<g class="ribbon c"><ellipse cx="90" cy="430" rx="300" ry="260" fill="url(#green)"/><ellipse cx="150" cy="700" rx="260" ry="220" fill="url(#violet)"/><ellipse cx="1510" cy="460" rx="300" ry="270" fill="url(#violet)"/><ellipse cx="1470" cy="720" rx="260" ry="220" fill="url(#green)"/></g>
<path d="M0 1000 L0 930 L180 880 L330 925 L520 868 L700 930 L900 892 L1080 938 L1260 876 L1430 926 L1600 884 L1600 1000Z" fill="#010205"/>
</svg>`

const LOOK: ThemeSetArgs = {
  colors: theme,
  backdrop: { scene: 'aurora-noir', glass: { blur: 18, tint: '#05070d', opacity: 0.45 } },
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
