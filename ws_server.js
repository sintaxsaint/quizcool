// Minimal Quizall WebSocket server
// Requires: npm install ws
// Run: node ws_server.js

const WebSocket = require('ws')

const PORT = process.env.PORT || 8080
const wss = new WebSocket.Server({ port: PORT })

const rooms = Object.create(null) // code -> {status, quiz, cur, players, created}

function send(ws, obj){ try{ ws.send(JSON.stringify(obj)) }catch(e){} }
function broadcast(code){ const room = rooms[code] || null; const msg = JSON.stringify({ type:'room', code, room })
  wss.clients.forEach(c => { if(c.ready && c.code === code && c.readyState === WebSocket.OPEN) { try{ c.send(msg) }catch(e){} } })
}

wss.on('connection', ws => {
  ws.ready = false
  ws.code = null
  ws.role = null

  ws.on('message', data => {
    let msg
    try{ msg = JSON.parse(data) }catch(e){ return }
    const { type, code } = msg || {}
    if(!type) return

    if(type === 'join'){
      ws.ready = true
      ws.code = String(code || '')
      ws.role = String(msg.role || '')
      if(!rooms[ws.code]) rooms[ws.code] = null
      send(ws, { type:'room', code: ws.code, room: rooms[ws.code] })
      return
    }

    if(!code) return

    if(type === 'set_room'){
      rooms[code] = msg.room || null
      broadcast(code)
      return
    }

    if(type === 'patch_room'){
      const cur = rooms[code]
      if(!cur) return
      rooms[code] = { ...cur, ...msg.patch }
      broadcast(code)
      return
    }

    if(type === 'get_room'){
      send(ws, { type:'room', code, room: rooms[code] || null })
      return
    }

    if(type === 'add_player'){
      const cur = rooms[code]
      if(!cur) return
      const players = cur.players || {}
      players[String(msg.pid)] = msg.player || { name:'Player', score:0, answer:null }
      rooms[code] = { ...cur, players }
      broadcast(code)
      return
    }

    if(type === 'set_answer'){
      const cur = rooms[code]
      if(!cur || cur.status !== 'question') return
      const players = { ...(cur.players || {}) }
      const pid = String(msg.pid)
      const p = players[pid]
      if(!p || p.answer != null) return
      players[pid] = { ...p, answer: msg.idx }
      rooms[code] = { ...cur, players }
      broadcast(code)
      return
    }
  })

  ws.on('close', () => { ws.ready = false })
})

console.log('Quizall WebSocket server listening on port', PORT)