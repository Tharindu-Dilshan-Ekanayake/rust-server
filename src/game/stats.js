import { monitorEventLoopDelay } from 'node:perf_hooks'

/** Rooms alive on this process (rooms add and remove themselves). */
export const liveRooms = new Set()

const mb = (bytes) => (bytes / 1048576).toFixed(0)
const ms = (ns) => (ns / 1e6).toFixed(1)

/**
 * A load line every STATS_INTERVAL seconds (default: every minute in production,
 * off in dev): rooms, humans, bots, CPU, event-loop lag and memory. On a
 * 1 vCPU / 512 MB pod this is what says whether the deploy's seatCap is honest:
 * keep cpu well under 100% and lag p99 near the 33 ms tick at a full pod.
 */
export function startStats(pod) {
  const every = Number(process.env.STATS_INTERVAL ?? (process.env.NODE_ENV === 'production' ? 60 : 0))
  if (!(every > 0)) return
  const lag = monitorEventLoopDelay({ resolution: 10 })
  lag.enable()
  let cpu = process.cpuUsage()
  let at = performance.now()
  setInterval(() => {
    const now = performance.now()
    const used = process.cpuUsage(cpu)
    cpu = process.cpuUsage()
    const load = ((used.user + used.system) / 1000 / (now - at)) * 100
    at = now
    let humans = 0
    let bots = 0
    for (const room of liveRooms) {
      humans += room.clients.length
      bots += room.botCount()
    }
    const mem = process.memoryUsage()
    console.log(
      `[stats ${pod}] rooms=${liveRooms.size} humans=${humans} bots=${bots} cpu=${load.toFixed(0)}% ` +
        `lag p50=${ms(lag.percentile(50))}ms p99=${ms(lag.percentile(99))}ms max=${ms(lag.max)}ms ` +
        `rss=${mb(mem.rss)}MB heap=${mb(mem.heapUsed)}MB`,
    )
    lag.reset()
  }, every * 1000).unref()
}
