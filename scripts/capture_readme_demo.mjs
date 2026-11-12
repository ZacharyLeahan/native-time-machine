import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root=resolve(import.meta.dirname,'..')
const framesDir=join(root,'docs','demo-frames')
const chromePath='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const appUrl='http://127.0.0.1:4173/'
const debugPort=9337
const profile=await mkdtemp(join(tmpdir(),'native-time-machine-demo-'))
await rm(framesDir,{recursive:true,force:true})
await mkdir(framesDir,{recursive:true})

const viteBin=join(root,'node_modules','vite','bin','vite.js')
const server=spawn(process.execPath,[viteBin,'--host','127.0.0.1','--port','4173'],{cwd:root,stdio:'ignore'})
let chrome

async function waitFor(url,attempts=80){
  for(let attempt=0;attempt<attempts;attempt++){
    try{const response=await fetch(url);if(response.ok)return response}catch{}
    await new Promise((resolve)=>setTimeout(resolve,150))
  }
  throw new Error(`Timed out waiting for ${url}`)
}

try{
  await waitFor(appUrl)
  chrome=spawn(chromePath,[
    '--headless=new',`--remote-debugging-port=${debugPort}`,'--remote-debugging-address=127.0.0.1',
    `--user-data-dir=${profile}`,'--window-size=1360,820','--hide-scrollbars','--force-device-scale-factor=1',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist',appUrl,
  ],{stdio:'ignore'})
  await waitFor(`http://127.0.0.1:${debugPort}/json/version`)
  const targets=await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()
  const target=targets.find((entry)=>entry.type==='page'&&entry.url.startsWith(appUrl))
  if(!target)throw new Error('Chrome did not expose the app page')

  const socket=new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})})
  let sequence=0
  const pending=new Map()
  socket.addEventListener('message',(event)=>{
    const message=JSON.parse(event.data)
    if(!message.id)return
    const request=pending.get(message.id)
    if(!request)return
    pending.delete(message.id)
    if(message.error)request.reject(new Error(message.error.message));else request.resolve(message.result)
  })
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))})
  const wait=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms))
  const evaluate=async(expression)=>{const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text);return result.result.value}
  const capture=async(name,delay=500)=>{await wait(delay);const image=await send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});await writeFile(join(framesDir,`${name}.png`),Buffer.from(image.data,'base64'))}

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride',{width:1360,height:820,deviceScaleFactor:1,mobile:false})
  await wait(2200)
  const demoDesign={version:8,siteId:'15-pickwick-ln-malvern-pa',name:'Native Time Machine demo',widthFt:210,depthFt:210,plants:[
    {id:'demo-oak',speciesId:'white-oak',xFt:28,zFt:22,plantedYear:0,origin:'user'},
    {id:'demo-redbud',speciesId:'eastern-redbud',xFt:-28,zFt:-4,plantedYear:0,origin:'user'},
    {id:'demo-hazelnut',speciesId:'american-hazelnut',xFt:-5,zFt:42,plantedYear:0,origin:'user'},
  ]}
  await evaluate(`localStorage.setItem('landscape-time-machine/design/v8',${JSON.stringify(JSON.stringify(demoDesign))});location.reload()`)
  for(let attempt=0;attempt<50;attempt++){
    if(await evaluate(`Boolean(document.querySelector('.app-shell'))`))break
    if(attempt===49)throw new Error(`App did not render: ${await evaluate(`document.body.innerText`)}`)
    await wait(150)
  }
  await wait(1200)
  await capture('01-3d-overview')
  await evaluate(`document.querySelector('[aria-label="Expand solar controls"]').click()`)
  await capture('02-solar-controls')
  const setRange=(label,value)=>`(()=>{const input=[...document.querySelectorAll('input[type="range"]')].find((item)=>item.getAttribute('aria-label')==='${label}');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,'${value}');input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}))})()`
  await evaluate(setRange('Time of day',390));await capture('03-morning-sun',650)
  await evaluate(setRange('Time of day',785));await capture('04-noon-sun',650)
  await evaluate(setRange('Time of day',1140));await capture('05-evening-sun',650)
  await evaluate(`document.querySelector('[aria-label="Minimize solar controls"]').click();[...document.querySelectorAll('button')].find((button)=>button.textContent.trim()==='Plan').click()`)
  await capture('06-plan-view',800)
  await evaluate(setRange('Simulation year',0));await capture('07-young-design',500)
  await evaluate(setRange('Simulation year',25));await capture('08-growing-design',500)
  await evaluate(setRange('Simulation year',50));await capture('09-mature-design',500)
  await evaluate(`[...document.querySelectorAll('button')].find((button)=>button.textContent.includes('3D Garden')).click()`)
  await capture('10-mature-3d',900)
  socket.close()
}finally{
  if(chrome&&!chrome.killed){chrome.kill();await Promise.race([once(chrome,'exit'),new Promise((resolve)=>setTimeout(resolve,1500))])}
  if(!server.killed){server.kill();await Promise.race([once(server,'exit'),new Promise((resolve)=>setTimeout(resolve,1000))])}
  await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200}).catch(()=>{})
}
