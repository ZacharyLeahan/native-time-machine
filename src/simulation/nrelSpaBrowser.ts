// The package's public wrapper currently relies on Node's createRequire. The
// calculation core is dependency-free CommonJS and Vite can bundle it safely.
// @ts-expect-error nrel-spa does not publish declarations for its core module.
import { SpaData, spa_calculate } from 'nrel-spa-core'

export const SPA_ZA_RTS = 2

interface SpaOptions {
  elevation?: number
  pressure?: number
  temperature?: number
  delta_ut1?: number
  delta_t?: number
  slope?: number
  azm_rotation?: number
  atmos_refract?: number
  function?: number
}

interface SpaResult {
  zenith: number
  azimuth: number
  sunrise: number
  solarNoon: number
  sunset: number
}

function spaInstant(date:Date|string):Date {
  if(date instanceof Date)return date
  const [year,month,day]=date.split('-').map(Number)
  return new Date(Date.UTC(year,month-1,day,12))
}

export function getSpa(date:Date|string,latitude:number,longitude:number,timezone=0,options:SpaOptions={}):SpaResult {
  const at=spaInstant(date)
  const data=new SpaData()
  data.year=at.getUTCFullYear()
  data.month=at.getUTCMonth()+1
  data.day=at.getUTCDate()
  data.hour=at.getUTCHours()
  data.minute=at.getUTCMinutes()
  data.second=at.getUTCSeconds()
  data.longitude=longitude
  data.latitude=latitude
  data.timezone=timezone
  data.elevation=options.elevation??0
  data.pressure=options.pressure??1013
  data.temperature=options.temperature??15
  data.delta_ut1=options.delta_ut1??0
  data.delta_t=options.delta_t??67
  data.slope=options.slope??0
  data.azm_rotation=options.azm_rotation??0
  data.atmos_refract=options.atmos_refract??.5667
  data.function=options.function??SPA_ZA_RTS
  const code=spa_calculate(data)
  if(code!==0)throw new Error(`NREL SPA calculation failed with error code ${code}`)
  return {zenith:data.zenith,azimuth:data.azimuth,sunrise:data.sunrise,solarNoon:data.suntransit,sunset:data.sunset}
}

export function formatTime(hours:number):string {
  if(!Number.isFinite(hours)||hours<0)return 'N/A'
  const seconds=Math.round(hours*3600)
  const hour=Math.floor(seconds/3600)%24
  const minute=Math.floor(seconds%3600/60)
  const second=seconds%60
  return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:${String(second).padStart(2,'0')}`
}
