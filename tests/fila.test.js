// Fila de espera: a 1ª da fila entra direto; quem está sem crédito é pulada e entra quando ganha crédito
const { start } = require('./harness');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function client(base) { let cookie = ''; return async (method, p, body) => { const r = await fetch(base + p, { method, headers: { 'content-type': 'application/json', cookie, origin: base }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' }); const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0]; let j = null; try { j = await r.json(); } catch (e) {} return { s: r.status, j }; }; }
const CPF = ['529.982.247-25', '111.444.777-35', '390.533.447-05', '935.411.347-80'];
(async () => {
  const h = await start({ port: 4580, mock: 4581, email: true }); const B = h.base, owner = client(B);
  await owner('POST', '/api/login', { email: 'dona@fany.com', password: 'senhaForte123' });
  const names = ['Ana', 'Bia', 'Carla', 'Dani'], cs = {}, ids = {};
  for (let i = 0; i < 4; i++) { cs[names[i]] = client(B); const r = await cs[names[i]]('POST', '/api/signup', { name: names[i], email: names[i].toLowerCase() + '@x.com', phone: `(18) 9911${i}-000${i}`, cpf: CPF[i], password: 'minhasenha1', acceptTerms: true }); ids[names[i]] = r.j.db.users[0].id; }
  const when = new Date(Date.now() + 3 * 864e5).toISOString();
  let r = await owner('POST', '/api/act/classSave', { title: 'Aula Lotada', instructor: 'Fany', start: when, duration: 45, maxBikes: 1, level: 'x', notes: '' }); const cls = r.j.state.db.classes.find(c => c.title === 'Aula Lotada');
  await owner('POST', '/api/act/adjust', { userId: ids.Ana, amount: 3, reason: 't' }); await owner('POST', '/api/act/adjust', { userId: ids.Dani, amount: 3, reason: 't' });
  r = await cs.Ana('POST', '/api/act/reserve', { classId: cls.id, bike: 1 }); ok(r.s === 200, 'Ana reserva a única bike');
  r = await cs.Bia('POST', '/api/act/wait', { classId: cls.id }); ok(r.s === 200 && /automaticamente/.test(r.j.msg), 'Bia (sem crédito) entra na fila e a mensagem explica a entrada automática');
  await sleep(50); r = await cs.Dani('POST', '/api/act/wait', { classId: cls.id }); ok(r.s === 200, 'Dani entra na fila depois');
  r = await cs.Ana('POST', '/api/act/cancel', { id: (await cs.Ana('GET', '/api/state')).j.db.reservations.find(x => x.classId === cls.id).id }); ok(r.s === 200, 'Ana desiste');
  r = await cs.Dani('GET', '/api/state'); const dres = r.j.db.reservations.find(x => x.classId === cls.id && x.userId === ids.Dani && x.status === 'confirmed');
  ok(!!dres && dres.bike === 1 && r.j.db.users[0].credits === 2, 'Bia está sem crédito: foi pulada e a Dani entrou direto (bike 1, gastou 1 crédito)');
  ok(!r.j.db.waitlist.some(w => w.userId === ids.Dani), 'Dani saiu da fila'); 
  r = await cs.Bia('GET', '/api/state'); ok(r.j.db.waitlist.some(w => w.userId === ids.Bia), 'Bia continua na fila');
  ok(!!(await h.mail(m => m.to === 'dani@x.com' && /Você entrou na aula/.test(m.subject))), 'Dani recebeu o e-mail com a bike');
  // Dani desiste; Bia ainda sem crédito → ninguém entra; ao ganhar crédito ela entra sozinha
  await cs.Dani('POST', '/api/act/cancel', { id: dres.id }); r = await cs.Bia('GET', '/api/state'); ok(!r.j.db.reservations.some(x => x.userId === ids.Bia && x.status === 'confirmed'), 'sem crédito, a Bia não entra (e a vaga fica livre)');
  await owner('POST', '/api/act/adjust', { userId: ids.Bia, amount: 1, reason: 'brinde' });
  r = await cs.Bia('GET', '/api/state'); ok(r.j.db.reservations.some(x => x.userId === ids.Bia && x.classId === cls.id && x.status === 'confirmed') && !r.j.db.waitlist.some(w => w.userId === ids.Bia), 'ao receber crédito, a Bia entra sozinha na vaga que estava livre');
  console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK'); const bad = h.log().split('\n').filter(l => /TypeError|ReferenceError|erro interno/.test(l)); if (bad.length) console.log('LOG:', bad.slice(0, 5)); h.stop(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('EXCEÇÃO', e); process.exit(1); });
