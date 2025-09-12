import { computeBarGeometry } from "../lib/chart-geometry"

function assert(cond: any, msg: string){ if(!cond) throw new Error(msg) }

const a = computeBarGeometry(1, 50)
assert(a.barWidth >= 4, 'barWidth min failed')
assert(a.gap >= 2, 'gap min failed')

const b1 = computeBarGeometry(5, 800)
const b2 = computeBarGeometry(10, 800)
assert(b1.barWidth > b2.barWidth, 'expected narrower bars for more items')

const p = computeBarGeometry(3, 400).padding
assert(JSON.stringify(p)==='{"top":10,"right":16,"bottom":36,"left":36}', 'padding mismatch')

console.log('chart-geometry verification OK')
