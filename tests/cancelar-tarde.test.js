// Cancelar fora do prazo: aviso, "cancelar mesmo assim" perde o crédito; configurável no Estúdio
const { start } = require('./harness');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
function client(base) { let cookie = ''; return async (method, p, body) => { const r = await fetch(base + p, { method, headers: { 'content-type': 'application/json', cookie, origin: base }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' }); const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0]; let j = null; try { j = await r.json(); } catch (e) {} return { s: r.status, j }; }; }
(async () => {
  const h = await start({ port: 4650, mock: 4651 }); const B = h.base, owner = client(B), ana = client(B), bia = client(B);
  await owner('POST', '/api/login', { email: 'dona@fany.com', password: 'senhaForte123' });
  let r = await ana('POST', '/api/signup', { name: 'Ana', email: 'ana@x.com', phone: '(18) 99111-0001', cpf: '529.982.247-25', password: 'minhasenha1', acceptTerms: true }); const aid = r.j.db.users[0].id;
  r = await bia('POST', '/api/signup', { name: 'Bia', email: 'bia@x.com', phone: '(18) 99111-0002', cpf: '111.444.777-35', password: 'minhasenha1', acceptTerms: true }); const bid = r.j.db.users[0].id;
  const st0 = (await owner('GET', '/api/state')).j.db.settings || {};
  r = await owner('POST', '/api/act/studio', { name: 'Spinning Fany', whatsapp: '18999990000', duration: 45, cancelHours: '1', lateCancel: true, lateCancelMsg: 'Faltam menos de {prazo}. Se cancelar perde o crédito.' }); ok(r.s === 200, 'dona configura prazo de 1h e aviso no Estúdio');
  const mk = async (t, min) => (await owner('POST', '/api/act/classSave', { title: t, instructor: 'Fany', start: new Date(Date.now() + min * 6e4).toISOString(), duration: 45, maxBikes: 1, level: 'x', notes: '' })).j.state.db.classes.find(c => c.title === t).id;
  const soon = await mk('Em 40 min', 40), later = await mk('Em 3 horas', 180);
  for (const id of [aid, bid]) await owner('POST', '/api/act/adjust', { userId: id, amount: 3, reason: 't' });
  const cred = async c => (await c('GET', '/api/state')).j.db.users[0].credits;
  await ana('POST', '/api/act/reserve', { classId: later, bike: 1 }); let res = (await ana('GET', '/api/state')).j.db.reservations.find(x => x.classId === later);
  r = await ana('POST', '/api/act/cancel', { id: res.id }); ok(r.s === 200 && await cred(ana) === 3, 'dentro do prazo: cancela e devolve o crédito');
  await ana('POST', '/api/act/reserve', { classId: soon, bike: 1 }); await bia('POST', '/api/act/wait', { classId: soon });
  res = (await ana('GET', '/api/state')).j.db.reservations.find(x => x.classId === soon && x.status === 'confirmed');
  r = await ana('POST', '/api/act/cancel', { id: res.id }); ok(r.s === 200 && r.j.needLate && /Faltam menos de 1h\. Se cancelar perde o crédito/.test(r.j.warn), 'faltando 40 min: não cancela direto, devolve o aviso configurado');
  ok((await ana('GET', '/api/state')).j.db.reservations.find(x => x.id === res.id).status === 'confirmed', 'sem confirmar, a reserva continua');
  r = await ana('POST', '/api/act/cancel', { id: res.id, late: true }); ok(r.s === 200 && /não foi devolvido/.test(r.j.msg), '"cancelar mesmo assim" cancela');
  ok(await cred(ana) === 2, 'o crédito NÃO volta (3 → 2)');
  ok((await bia('GET', '/api/state')).j.db.reservations.some(x => x.userId === bid && x.classId === soon && x.status === 'confirmed'), 'a bike foi para a primeira da fila');
  // desligado
  await owner('POST', '/api/act/studio', { name: 'Spinning Fany', whatsapp: '18999990000', duration: 45, cancelHours: '1', lateCancel: false });
  const rb = (await bia('GET', '/api/state')).j.db.reservations.find(x => x.classId === soon && x.status === 'confirmed');
  r = await bia('POST', '/api/act/cancel', { id: rb.id, late: true }); ok(r.s === 400 && /só até 1h/.test(r.j.error), 'com a opção desligada no Estúdio, não deixa cancelar fora do prazo');
  r = await owner('POST', '/api/act/studio', { name: 'Spinning Fany', whatsapp: '18999990000', duration: 45, cancelHours: '0,5', lateCancel: true });
  ok((await owner('GET', '/api/state')).j.db.settings.cancelHours === 0.5, 'prazo aceita meia hora (0,5)');
  console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK'); const bad = h.log().split('\n').filter(l => /TypeError|ReferenceError|erro interno/.test(l)); if (bad.length) console.log('LOG:', bad.slice(0, 5)); h.stop(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('EXCEÇÃO', e); process.exit(1); });
