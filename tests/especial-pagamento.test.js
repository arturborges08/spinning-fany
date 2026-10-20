// Aula especial: dona escolhe se a aluna paga direto, usa créditos, ou escolhe entre os dois
const { start } = require('./harness');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
function client(base) { let cookie = ''; return async (method, p, body) => { const r = await fetch(base + p, { method, headers: { 'content-type': 'application/json', cookie, origin: base }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' }); const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0]; let j = null; try { j = await r.json(); } catch (e) {} return { s: r.status, j }; }; }
const CPF = ['529.982.247-25', '111.444.777-35', '390.533.447-05'];
(async () => {
  const h = await start({ port: 4620, mock: 4621 }); const B = h.base, owner = client(B);
  await owner('POST', '/api/login', { email: 'dona@fany.com', password: 'senhaForte123' });
  const nm = ['Ana', 'Bia', 'Carla'], cs = {}, ids = {};
  for (let i = 0; i < 3; i++) { cs[nm[i]] = client(B); const r = await cs[nm[i]]('POST', '/api/signup', { name: nm[i], email: nm[i].toLowerCase() + '@x.com', phone: `(18) 9911${i}-000${i}`, cpf: CPF[i], password: 'minhasenha1', acceptTerms: true }); ids[nm[i]] = r.j.db.users[0].id; }
  const credits = async n => (await cs[n]('GET', '/api/state')).j.db.users[0].credits;
  const when = d => new Date(Date.now() + d * 864e5).toISOString();
  // modelos
  let r = await owner('POST', '/api/act/specSave', { name: 'Aula Só Crédito', price: '', pay: 'credits', credits: 2, theme: 'havai', duration: 60, desc: 'x', active: true }); ok(r.s === 200, 'modelo "só com créditos" salvo sem preço');
  const spC = r.j.state.db.specials.find(s => s.name === 'Aula Só Crédito'); ok(spC.pay === 'credits' && spC.credits === 2, 'modelo guarda forma de pagamento e quantidade de créditos');
  r = await owner('POST', '/api/act/specSave', { name: 'Aula Escolhe', price: '35,00', pay: 'both', credits: 1, theme: 'havai', duration: 60, desc: 'x', active: true }); const spB = r.j.state.db.specials.find(s => s.name === 'Aula Escolhe');
  r = await owner('POST', '/api/act/specSave', { name: 'Aula Direta', price: '35,00', pay: 'direct', theme: 'havai', duration: 60, desc: 'x', active: true }); const spD = r.j.state.db.specials.find(s => s.name === 'Aula Direta');
  r = await owner('POST', '/api/act/specSave', { name: 'Sem preço', price: '', pay: 'direct', theme: 'havai', duration: 60, active: true }); ok(r.s === 400 && /Preço mínimo/.test(r.j.error), 'pagamento direto continua exigindo preço');
  for (const [sp, d] of [[spC, 2], [spB, 3], [spD, 4]]) { r = await owner('POST', '/api/act/specSchedule', { id: sp.id, start: when(d) }); ok(r.s === 200, 'agendou ' + sp.name); }
  const cl = n => (r.j.db || r.j.state.db).classes.find(c => c.title === n);
  r = await owner('GET', '/api/state'); const cC = cl('Aula Só Crédito'), cB = cl('Aula Escolhe'), cD = cl('Aula Direta');
  ok(cC.event.pay === 'credits' && cC.event.credits === 2 && cB.event.pay === 'both' && cD.event.pay === 'direct', 'datas herdam a forma de pagamento do modelo');
  // só crédito
  await owner('POST', '/api/act/adjust', { userId: ids.Ana, amount: 1, reason: 't' });
  r = await cs.Ana('POST', '/api/act/reserve', { classId: cC.id, bike: 1 }); ok(r.s === 400 && /2 créditos/.test(r.j.error), 'com 1 crédito não reserva aula que usa 2');
  await owner('POST', '/api/act/adjust', { userId: ids.Ana, amount: 4, reason: 't' });
  r = await cs.Ana('POST', '/api/act/checkoutEvent', { classId: cC.id, bike: 1 }); ok(r.s === 400 && /créditos/.test(r.j.error), 'aula só com créditos não abre pagamento direto');
  r = await cs.Ana('POST', '/api/act/reserve', { classId: cC.id, bike: 1 }); ok(r.s === 200 && r.j.bike === 1, 'reserva com créditos');
  ok(await credits('Ana') === 3, 'descontou 2 créditos (5 → 3)');
  r = await cs.Ana('GET', '/api/state'); const resC = r.j.db.reservations.find(x => x.classId === cC.id && x.status === 'confirmed'); ok(resC && resC.paidCredit && resC.creditCost === 2, 'reserva marcada como paga com 2 créditos');
  r = await cs.Ana('POST', '/api/act/cancel', { id: resC.id }); ok(r.s === 200, 'aluna pode cancelar a aula especial paga com créditos'); ok(await credits('Ana') === 5, 'os 2 créditos voltaram');
  // aluna escolhe
  r = await cs.Ana('POST', '/api/act/reserve', { classId: cB.id, bike: 2 }); ok(r.s === 200 && await credits('Ana') === 4, '"a aluna escolhe": reserva com 1 crédito');
  await owner('POST', '/api/act/adjust', { userId: ids.Bia, amount: 0, reason: 't' });
  r = await cs.Bia('POST', '/api/act/checkoutEvent', { classId: cB.id, bike: 3 }); ok(r.s === 200 && /checkout/.test(r.j.url || ''), '"a aluna escolhe": também pode pagar direto (link de pagamento criado)');
  // direto
  r = await cs.Ana('POST', '/api/act/reserve', { classId: cD.id, bike: 1 }); ok(r.s === 400 && /sem crédito/.test(r.j.error), 'pagamento direto não aceita crédito');
  r = await cs.Ana('POST', '/api/act/checkoutEvent', { classId: cD.id, bike: 1 }); ok(r.s === 200 && r.j.url, 'pagamento direto continua funcionando');
  // painel: reservar para aluna
  await owner('POST', '/api/act/adjust', { userId: ids.Carla, amount: 2, reason: 't' });
  r = await owner('POST', '/api/act/book', { classId: cC.id, bike: 3, userId: ids.Carla, method: 'CASH' }); ok(r.s === 400 && /só com créditos/.test(r.j.error), 'painel: aula só com créditos não aceita venda em dinheiro');
  r = await owner('POST', '/api/act/book', { classId: cC.id, bike: 3, userId: ids.Carla, method: 'CREDIT' }); ok(r.s === 200 && await credits('Carla') === 0, 'painel: reserva para a aluna usando os 2 créditos dela');
  r = await owner('POST', '/api/act/book', { classId: cD.id, bike: 5, userId: ids.Carla, method: 'CREDIT' }); ok(r.s === 400, 'painel: aula direta não usa crédito');
  // mudar forma de pagamento de uma data
  r = await owner('POST', '/api/act/classSave', { id: cD.id, title: cD.title, instructor: 'Fany', start: cD.start, duration: 60, level: 'Aula temática', notes: '', price: '35,00', theme: 'havai', pay: 'both', credits: 3 }); const nd = r.j.state.db.classes.find(c => c.id === cD.id); ok(r.s === 200 && nd.event.pay === 'both' && nd.event.credits === 3, 'dá para mudar a forma de pagamento de uma data específica');
  // atualizar modelo → datas
  r = await owner('POST', '/api/act/specSave', { id: spB.id, name: 'Aula Escolhe', price: '40,00', pay: 'credits', credits: 2, theme: 'havai', duration: 60, desc: 'x', active: true, applyAll: true }); ok(r.j.state.db.classes.find(c => c.id === cB.id).event.pay === 'credits', 'mudar o modelo atualiza as datas já agendadas');
  // cancelar aula: devolve créditos
  r = await owner('POST', '/api/act/classCancel', { id: cC.id, reason: 'teste' }); ok(r.s === 200 && await credits('Carla') === 2, 'aula especial cancelada pelo estúdio devolve os créditos');
  console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK'); const bad = h.log().split('\n').filter(l => /TypeError|ReferenceError|erro interno/.test(l)); if (bad.length) console.log('LOG:', bad.slice(0, 5)); h.stop(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('EXCEÇÃO', e); process.exit(1); });
