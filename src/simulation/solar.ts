import { formatTime, getSpa, SPA_ZA_RTS } from './nrelSpaBrowser'

export const PICKWICK_SOLAR_SITE = {
  latitude: 40.028618,
  longitude: -75.531244,
  elevationM: 178.17,
  timeZone: 'America/New_York',
  pressureMbar: 992,
  temperatureC: 15,
} as const

export interface SolarSnapshot {
  instant: Date
  localDate: string
  localMinute: number
  timezoneOffsetHours: number
  azimuthDeg: number
  altitudeDeg: number
  zenithDeg: number
  isAboveHorizon: boolean
  sunriseMinutes: number
  solarNoonMinutes: number
  sunsetMinutes: number
  sunriseLabel: string
  solarNoonLabel: string
  sunsetLabel: string
  worldDirection: [number, number, number]
}

const SPA_OPTIONS = {
  elevation: PICKWICK_SOLAR_SITE.elevationM,
  pressure: PICKWICK_SOLAR_SITE.pressureMbar,
  temperature: PICKWICK_SOLAR_SITE.temperatureC,
  atmos_refract: .5667,
  function: SPA_ZA_RTS,
} as const

function zonedParts(date: Date, timeZone = PICKWICK_SOLAR_SITE.timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  return Object.fromEntries(parts.filter((part)=>part.type!=='literal').map((part)=>[part.type,Number(part.value)])) as Record<'year'|'month'|'day'|'hour'|'minute'|'second',number>
}

export function timezoneOffsetHours(date: Date, timeZone = PICKWICK_SOLAR_SITE.timeZone): number {
  const parts=zonedParts(date,timeZone)
  const representedAsUtc=Date.UTC(parts.year,parts.month-1,parts.day,parts.hour,parts.minute,parts.second)
  return (representedAsUtc-date.getTime())/3_600_000
}

export function localDateString(date = new Date(), timeZone = PICKWICK_SOLAR_SITE.timeZone): string {
  const parts=zonedParts(date,timeZone)
  return `${parts.year}-${String(parts.month).padStart(2,'0')}-${String(parts.day).padStart(2,'0')}`
}

export function localMinuteOfDay(date = new Date(), timeZone = PICKWICK_SOLAR_SITE.timeZone): number {
  const parts=zonedParts(date,timeZone)
  return parts.hour*60+parts.minute
}

export function zonedDateTimeToUtc(localDate: string, minuteOfDay: number, timeZone = PICKWICK_SOLAR_SITE.timeZone): Date {
  const [year,month,day]=localDate.split('-').map(Number)
  const clamped=Math.max(0,Math.min(1439,minuteOfDay))
  const hour=Math.floor(clamped/60),minute=Math.floor(clamped%60),second=Math.round((clamped-Math.floor(clamped))*60)
  const wallClockUtc=Date.UTC(year,month-1,day,hour,minute,second)
  let guess=new Date(wallClockUtc)
  for(let iteration=0;iteration<3;iteration++){
    const offset=timezoneOffsetHours(guess,timeZone)
    guess=new Date(wallClockUtc-offset*3_600_000)
  }
  return guess
}

function worldDirection(azimuthDeg: number, altitudeDeg: number): [number,number,number] {
  const azimuth=azimuthDeg*Math.PI/180
  const altitude=altitudeDeg*Math.PI/180
  const horizontal=Math.cos(altitude)
  return [
    Math.sin(azimuth)*horizontal,
    Math.sin(altitude),
    -Math.cos(azimuth)*horizontal,
  ]
}

function spaWallClockDate(localDate: string, minuteOfDay: number): Date {
  const [year,month,day]=localDate.split('-').map(Number)
  const clamped=Math.max(0,Math.min(1439,minuteOfDay))
  const second=Math.round((clamped-Math.floor(clamped))*60)
  return new Date(Date.UTC(year,month-1,day,Math.floor(clamped/60),Math.floor(clamped%60),second))
}

export function calculateSolarSnapshot(localDate: string, minuteOfDay: number): SolarSnapshot {
  const instant=zonedDateTimeToUtc(localDate,minuteOfDay)
  const timezone=timezoneOffsetHours(instant)
  const position=getSpa(spaWallClockDate(localDate,minuteOfDay),PICKWICK_SOLAR_SITE.latitude,PICKWICK_SOLAR_SITE.longitude,timezone,SPA_OPTIONS)
  const daily=getSpa(localDate,PICKWICK_SOLAR_SITE.latitude,PICKWICK_SOLAR_SITE.longitude,timezone,SPA_OPTIONS)
  const altitudeDeg=90-position.zenith
  return {
    instant,
    localDate,
    localMinute:minuteOfDay,
    timezoneOffsetHours:timezone,
    azimuthDeg:position.azimuth,
    altitudeDeg,
    zenithDeg:position.zenith,
    isAboveHorizon:altitudeDeg>0,
    sunriseMinutes:daily.sunrise*60,
    solarNoonMinutes:daily.solarNoon*60,
    sunsetMinutes:daily.sunset*60,
    sunriseLabel:formatTime(daily.sunrise),
    solarNoonLabel:formatTime(daily.solarNoon),
    sunsetLabel:formatTime(daily.sunset),
    worldDirection:worldDirection(position.azimuth,altitudeDeg),
  }
}

export function sampleSunPath(localDate: string, stepMinutes = 10): [number,number,number][] {
  const noon=zonedDateTimeToUtc(localDate,720)
  const timezone=timezoneOffsetHours(noon)
  const points: [number,number,number][]=[]
  for(let minute=0;minute<1440;minute+=stepMinutes){
    const position=getSpa(spaWallClockDate(localDate,minute),PICKWICK_SOLAR_SITE.latitude,PICKWICK_SOLAR_SITE.longitude,timezone,SPA_OPTIONS)
    const altitude=90-position.zenith
    if(altitude>0){
      const direction=worldDirection(position.azimuth,altitude)
      points.push([direction[0]*230,direction[1]*230,direction[2]*230])
    }
  }
  return points
}

export function formatClockMinute(minute: number): string {
  const normalized=((Math.round(minute)%1440)+1440)%1440
  const hour24=Math.floor(normalized/60),minutes=normalized%60
  const suffix=hour24>=12?'PM':'AM'
  const hour12=hour24%12||12
  return `${hour12}:${String(minutes).padStart(2,'0')} ${suffix}`
}
