// Navegador: contador de aulas feitas (painel da dona e da aluna)
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const { start } = require('./harness');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
(async () => {
  const h = await start({ port: 4640, mock: 4641 }); const B = await chromium.launch(); const errors = [];
  const mk = async (w, hh) => { const ctx = await B.newContext({ viewport: { width: w, height: hh }, deviceScaleFactor: 2 }); const p = await ctx.newPage(); p.on('pageerror', e => errors.push('PAGEERROR ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load resource|net::/.test(m.text())) errors.push('CONSOLE ' + m.text()); }); p.on('dialog', d => { errors.push('DIALOG nativo ' + d.message()); d.dismiss(); }); return p; };
  const sleep = (p, ms) => p.waitForTimeout(ms);
  const shot = async (p, n) => { await sleep(p, 300); await p.screenshot({ path: `/tmp/k_${n}.png` }); };
  const toast = p => p.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
  const dlg = async (p, label) => { await p.waitForSelector('.modal [data-act=dlg]'); await p.locator('.modal [data-act=dlg]', { hasText: label }).click(); await sleep(p, 250); };
  const login = async (p, email, pw) => { await p.goto(h.base + '/#/entrar'); await p.waitForSelector('form[data-form=login]'); await p.fill('form[data-form=login] input[name=email]', email); await p.fill('form[data-form=login] input[name=password]', pw); await p.click('form[data-form=login] button[type=submit]'); };
  const post = (p, path, body) => p.evaluate(([a, b]) => fetch('/api/act/' + a, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json()), [path, body]);
  const state = p => p.evaluate(() => fetch('/api/state').then(r => r.json()));
  const dona = await mk(1280, 900); await login(dona, 'dona@fany.com', 'senhaForte123');
  const al = await mk(390, 844); await al.goto(h.base + '/');
  for (const [n, e, c, i] of [['Ana Souza', 'ana@x.com', '529.982.247-25', 1], ['Bia Lima', 'bia@x.com', '111.444.777-35', 2]]) await al.evaluate(([n, e, c, i]) => fetch('/api/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: n, email: e, phone: '(18) 9911' + i + '-000' + i, cpf: c, password: 'minhasenha1', acceptTerms: true }) }), [n, e, c, i]);
  await al.evaluate(() => fetch('/api/logout', { method: 'POST' }));
  let st = await state(dona); const ana = st.db.users.find(u => u.email === 'ana@x.com').id, bia = st.db.users.find(u => u.email === 'bia@x.com').id;
  const mkClass = async (title, days) => { const r = await post(dona, 'classSave', { title, instructor: 'Fany', start: new Date(Date.now() + days * 864e5).toISOString(), duration: 45, level: 'x', notes: '' }); return r.state.db.classes.find(c => c.title === title).id; };
  const past = []; for (let i = 1; i <= 4; i++) past.push(await mkClass('Passada ' + i, -i));
  const fut = await mkClass('Futura', 2);
  for (const c of past) await post(dona, 'book', { classId: c, bike: 1, userId: ana, method: 'FREE' });
  await post(dona, 'book', { classId: past[0], bike: 2, userId: bia, method: 'FREE' });
  st = await state(dona); const r1 = st.db.reservations.find(r => r.classId === past[0] && r.userId === ana), r2 = st.db.reservations.find(r => r.classId === past[1] && r.userId === ana), r3 = st.db.reservations.find(r => r.classId === past[2] && r.userId === ana);
  await post(dona, 'att', { id: r1.id, status: 'attended' }); await post(dona, 'att', { id: r3.id, status: 'no_show' });  // r2 e r4 ficam sem marcar → contam como feitas
  await post(dona, 'adjust', { userId: ana, amount: 2, reason: 't' });
  // aluna
  await login(al, 'ana@x.com', 'minhasenha1'); await al.waitForSelector('[data-stat=done]');
  await post(al, 'reserve', { classId: fut, bike: 3 }); await al.reload(); await al.waitForSelector('[data-stat=done]');
  ok((await al.locator('[data-stat=done] b').innerText()).trim() === '3', 'painel da aluna: "Aulas feitas" = 3 (presente + 2 sem marcar; a falta não conta)');
  await shot(al, 'aluna_topo');
  await al.locator('[data-act=stab][data-t=minhas]').click(); await sleep(al, 300); const mine = await al.locator('main').innerText();
  ok(/Histórico · 3 aulas feitas · 1 falta/.test(mine) && (mine.match(/✔ Feita/g) || []).length === 3 && /Faltou/.test(mine), 'Minhas aulas: histórico com 3 feitas e 1 falta');
  ok(!/Futura[\s\S]*✔ Feita/.test(mine.split('Histórico')[1] || ''), 'aula futura não aparece como feita'); await shot(al, 'aluna_hist');
  // dona
  await dona.reload(); await dona.waitForSelector('[data-act=atab]'); await dona.click('[data-act=atab][data-t=alunas]'); await dona.fill('#sq', 'Ana'); await sleep(dona, 300);
  const row = await dona.locator('#slist tbody tr').first().innerText(); ok(/Aulas feitas/.test(await dona.locator('#slist thead').innerText()) && /\b3\b/.test(row) && /1 falta/.test(row), 'lista de alunas: coluna "Aulas feitas" = 3 · 1 falta (' + row.replace(/\s+/g, ' ') + ')');
  await dona.locator('#slist [data-act=ostud]').first().click(); await sleep(dona, 300); const stats = await dona.locator(`[data-stats="${ana}"]`).innerText();
  ok(/Aulas feitas\s*3/.test(stats) && /Faltas\s*1/.test(stats) && /Próximas reservas\s*1/.test(stats) && /Última aula\s*\d\d\/\d\d/.test(stats), 'ficha da aluna: feitas 3, faltas 1, próximas 1, última aula');
  await shot(dona, 'ficha');
  await dona.click('[data-act=atab][data-t=visao]'); await dona.waitForSelector('[data-rank]'); const rk = await dona.locator('[data-rank]').innerText();
  ok(/Quem mais treinou/.test(rk) && rk.indexOf('Ana Souza') > -1 && rk.indexOf('Ana Souza') < rk.indexOf('Bia Lima') && /3 aulas/.test(rk) && /1 aula/.test(rk), 'Visão geral: ranking "Quem mais treinou" (Ana 3, Bia 1)');
  await dona.locator('[data-rank]').scrollIntoViewIfNeeded(); await shot(dona, 'ranking');
  console.log('\nERROS NO NAVEGADOR:', errors.length ? errors : 'nenhum'); console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK'); await B.close(); h.stop(); process.exit(fails || errors.length ? 1 : 0);
})().catch(e => { console.error('EXCEÇÃO', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
