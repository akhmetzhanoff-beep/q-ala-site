// Chalet Home — Финансы: API на Vercel. Данные в Vercel Blob (один JSON).
const { put, list } = require('@vercel/blob');
const ROLES = { '2817':'manager','4731':'accountant','5926':'rop','6184':'director','7350':'owner','9042':'admin' };
const CAN = { sale:['manager','accountant','rop','director','admin'], expense:['accountant','director','admin'], week:['rop','director','admin'], settings:['admin','owner'] };
const KEY = 'chalet/9518b7f277dbb91826e66c4ea0a6da85/fin.json';
async function load(){
  const { blobs } = await list({ prefix: KEY });
  const b = blobs.find(x=>x.pathname===KEY);
  if(!b) return { sales:[], expenses:[], weeks:{}, settings:null, log:[] };
  const r = await fetch(b.url + '?t=' + Date.now(), { cache:'no-store' });
  const db = await r.json();
  for (const k of ['sales','expenses','log']) if(!Array.isArray(db[k])) db[k]=[];
  if(!db.weeks || Array.isArray(db.weeks)) db.weeks = {};
  return db;
}
async function save(db){ await put(KEY, JSON.stringify(db), { access:'public', contentType:'application/json', addRandomSuffix:false, allowOverwrite:true, cacheControlMaxAge:60 }); }
const rid = () => Math.random().toString(16).slice(2,14);
module.exports = async (req, res) => {
  res.setHeader('Cache-Control','no-store');
  try{
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body) } catch(e){ body = {} } }
    body = body || {};
    const role = ROLES[String(body.pin||'')];
    if(!role) return res.status(403).json({ error:'Неверный код' });
    const a = body.a || 'load';
    let db = await load();
    if (!db.seed11){ const seed=require('./seed.json'); const has=new Set(db.sales.map(x=>x.id)); seed.sales.forEach(x=>{ if(!has.has(x.id)) db.sales.push(x) }); const he=new Set(db.expenses.map(x=>x.id)); seed.expenses.forEach(x=>{ if(!he.has(x.id)) db.expenses.push(x) }); db.seed11=true; await save(db); }
    if (a==='save' || a==='del'){
      const type = body.type||''; const item = body.item||{};
      if(!CAN[type] || !CAN[type].includes(role)) return res.status(403).json({ error:'Нет прав для этого действия' });
      if (type==='settings') db.settings = item;
      else if (type==='week'){
        const wk = String(item.week||'').replace(/[^0-9-]/g,'');
        const cur = db.weeks[wk] || {};
        const side = role==='rop' ? 'rop' : role==='director' ? 'dir' : (item.side||'dir');
        cur[side] = { ok:String(item.ok||''), name:String(item.name||'').slice(0,60), at:new Date().toISOString(), note:String(item.note||'').slice(0,300), snap:item.snap||null };
        db.weeks[wk] = cur;
      } else {
        const key = type==='sale' ? 'sales' : 'expenses';
        const id = String(item.id||'').replace(/[^a-z0-9]/gi,'');
        if (a==='del') db[key] = db[key].filter(x=>x.id!==id);
        else {
          const it = Object.assign({}, item, { id: id||rid(), by: role, ts: new Date().toISOString() });
          const i = db[key].findIndex(x=>x.id===it.id);
          if (i>=0) db[key][i]=it; else db[key].push(it);
        }
      }
      db.log.push({ at:new Date().toISOString(), role, a, type }); if (db.log.length>500) db.log = db.log.slice(-500);
      await save(db);
    }
    const out = Object.assign({}, db); delete out.log;
    res.status(200).json({ ok:true, role, db: out });
  }catch(e){ res.status(500).json({ error:'Ошибка сервера: '+e.message }); }
};
