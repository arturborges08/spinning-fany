// Excluir cadastro (equipe e a própria aluna) e bloquear
const { start } = require('./harness');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function client(base) { let cookie = ''; return async (method, p, body) => { const r = await fetch(base + p, { method, headers: { 'content-type': 'application/json', cookie, origin: base }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' }); const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0]; let j = null; try { j = await r.json(); } catch (e) {} return { s: r.status, j }; }; }
const CPF = ['529.982.247-25', '111.444.777-35', '390.533.447-05'];
(async () => {
  const h = await start({ port: 4590, mock: 4591, email: true }); const B = h.base, owner = client(B);
  await owner('POST', '/api/login', { email: 'dona@fany.com', password: 'senhaForte123' });
  const nm = ['Ana', 'Bia', 'Carla'], cs = {}, ids = {};
  for (let i = 0; i < 3; i++) { cs[nm[i]] = client(B); const r = await cs[nm[i]]('POST', '/api/signup', { name: nm[i], email: nm[i].toLowerCase() + '@x.com', phone: `(18) 9911${i}-000${i}`, cpf: CPF[i], password: 'minhasenha1', acceptTerms: true, mktOptIn: true }); ids[nm[i]] = r.j.db.users[0].id; }
  const when = new Date(Date.now() + 3 * 864e5).toISOString();
  let r = await owner('POST', '/api/act/classSave', { title: 'Aula X', instructor: 'Fany', start: when, duration: 45, maxBikes: 1, level: 'x', notes: '' }); const cls = r.j.state.db.classes.find(c => c.title === 'Aula X');
  for (const n of nm) await owner('POST', '/api/act/adjust', { userId: ids[n], amount: 3, reason: 't' });
  r = await cs.Ana('POST', '/api/act/reserve', { classId: cls.id, bike: 1 }); ok(r.s === 200, 'Ana reserva');
  r = await cs.Bia('POST', '/api/act/wait', { classId: cls.id }); ok(r.s === 200, 'Bia entra na fila');
  // bloquear continua funcionando
  r = await owner('POST', '/api/act/block', { id: ids.Carla }); ok(r.s === 200, 'bloquear'); r = await cs.Carla('POST', '/api/act/reserve', { classId: cls.id, bike: 1 }); ok(r.s === 400 && /bloqueada/.test(r.j.error), 'bloqueada não reserva');
  await owner('POST', '/api/act/block', { id: ids.Carla });
  // aluna não pode excluir os outros
  r = await cs.Bia('POST', '/api/act/deleteStudent', { id: ids.Ana }); ok(r.s === 403, 'aluna não exclui cadastro de outra');
  // dona exclui a Ana: aula futura cancelada, Bia entra pela fila, dados apagados
  r = await owner('POST', '/api/act/deleteStudent', { id: ids.Ana }); ok(r.s === 200, 'dona exclui o cadastro da Ana');
  const u = r.j.state.db.users.find(x => x.id === ids.Ana);
  ok(u && u.deleted && u.name === 'Cadastro excluído' && !u.email && !u.phone && !u.hasCpf && !u.hasAccess, 'dados pessoais apagados');
  ok(!JSON.stringify(r.j.state).includes('ana@x.com') && !JSON.stringify(r.j.state).includes('52998224725'), 'e-mail e CPF dela não aparecem mais em lugar nenhum');
  ok(r.j.state.db.reservations.some(x => x.userId === ids.Bia && x.classId === cls.id && x.status === 'confirmed'), 'a vaga dela foi liberada e a Bia (fila) entrou direto');
  r = await cs.Ana('GET', '/api/state'); ok(!r.j.sess, 'a sessão da Ana foi encerrada');
  r = await client(B)('POST', '/api/login', { email: 'ana@x.com', password: 'minhasenha1' }); ok(r.s === 400, 'ela não consegue mais entrar');
  r = await client(B)('POST', '/api/signup', { name: 'Ana Nova', email: 'ana@x.com', phone: '(18) 99110-0000', cpf: CPF[0], password: 'minhasenha1', acceptTerms: true }); ok(r.s === 200, 'o mesmo e-mail e CPF podem se cadastrar de novo depois');
  r = await owner('POST', '/api/act/deleteStudent', { id: 'dona' }); ok(r.s === 400, 'id inválido recusado');
  const ownerId = (await owner('GET', '/api/state')).j.db.users.find(x => x.role === 'owner').id; r = await owner('POST', '/api/act/deleteStudent', { id: ownerId }); ok(r.s === 400, 'a dona não pode ser excluída por aqui');
  // a própria aluna exclui
  r = await cs.Bia('POST', '/api/act/deleteMe', { confirm: 'oi', password: 'minhasenha1' }); ok(r.s === 400 && /EXCLUIR/.test(r.j.error), 'precisa digitar EXCLUIR');
  r = await cs.Bia('POST', '/api/act/deleteMe', { confirm: 'EXCLUIR', password: 'errada123' }); ok(r.s === 400 && /senha/.test(r.j.error), 'senha errada não exclui');
  r = await cs.Bia('POST', '/api/act/deleteMe', { confirm: 'EXCLUIR', password: 'minhasenha1' }); ok(r.s === 200 && r.j.loggedOut, 'Bia exclui a própria conta');
  r = await owner('GET', '/api/state'); ok(r.j.db.users.find(x => x.id === ids.Bia).deleted && !r.j.db.reservations.some(x => x.userId === ids.Bia && x.status === 'confirmed'), 'conta da Bia apagada e aula futura cancelada');
  r = await owner('POST', '/api/act/block', { id: ids.Bia }); ok(r.s === 400, 'não dá para bloquear cadastro já excluído');
  console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK'); const bad = h.log().split('\n').filter(l => /TypeError|ReferenceError|erro interno/.test(l)); if (bad.length) console.log('LOG:', bad.slice(0, 5)); h.stop(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('EXCEÇÃO', e); process.exit(1); });
