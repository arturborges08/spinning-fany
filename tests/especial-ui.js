// Navegador: forma de pagamento da aula especial (painel + tela da aluna)
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const { start } = require('./harness');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
(async () => {
  const h = await start({ port: 4630, mock: 4631 }); const B = await chromium.launch(); const errors = [];
  const mk = async (w, hh) => { const ctx = await B.newContext({ viewport: { width: w, height: hh }, deviceScaleFactor: 2 }); const p = await ctx.newPage(); p.on('pageerror', e => errors.push('PAGEERROR ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load resource|net::/.test(m.text())) errors.push('CONSOLE ' + m.text()); }); p.on('dialog', d => { errors.push('DIALOG nativo ' + d.message()); d.dismiss(); }); return p; };
  const sleep = (p, ms) => p.waitForTimeout(ms);
  const shot = async (p, n) => { await sleep(p, 300); await p.screenshot({ path: `/tmp/k_${n}.png` }); };
  const toast = p => p.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
  const dlg = async (p, label) => { await p.waitForSelector('.modal [data-act=dlg]'); await p.locator('.modal [data-act=dlg]', { hasText: label }).click(); await sleep(p, 250); };
  const login = async (p, email, pw) => { await p.goto(h.base + '/#/entrar'); await p.waitForSelector('form[data-form=login]'); await p.fill('form[data-form=login] input[name=email]', email); await p.fill('form[data-form=login] input[name=password]', pw); await p.click('form[data-form=login] button[type=submit]'); };
  const post = (p, path, body) => p.evaluate(([a, b]) => fetch('/api/act/' + a, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json()), [path, body]);
  const state = p => p.evaluate(() => fetch('/api/state').then(r => r.json()));
  const dona = await mk(1280, 900); await login(dona, 'dona@fany.com', 'senhaForte123');
  await dona.click('[data-act=atab][data-t=especiais]'); await dona.waitForSelector('form[data-form=spec]');
  const f = dona.locator('form[data-form=spec]').first();
  ok(await f.locator('select[name=pay]').count() === 1 && await f.locator('input[name=credits]').count() === 1, 'formulário do modelo tem "Como a aluna paga" e "Créditos que usa"');
  await f.locator('select[name=pay]').selectOption('both'); await f.locator('input[name=credits]').fill('2'); await f.locator('button[type=submit]').click(); await sleep(dona, 500);
  let st = await state(dona); const sp = st.db.specials[0]; ok(sp.pay === 'both' && sp.credits === 2, 'dona escolheu "a aluna escolhe" com 2 créditos e salvou');
  await shot(dona, 'form');
  await post(dona, 'specSchedule', { id: sp.id, start: new Date(Date.now() + 3 * 864e5).toISOString() });
  const al = await mk(390, 844); await al.goto(h.base + '/'); await al.evaluate(() => fetch('/api/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Ana Souza', email: 'ana@x.com', phone: '(18) 99111-0001', cpf: '529.982.247-25', password: 'minhasenha1', acceptTerms: true }) }));
  st = await state(dona); const aid = st.db.users.find(u => u.email === 'ana@x.com').id; await post(dona, 'adjust', { userId: aid, amount: 3, reason: 't' });
  const cid = st.db.classes.find(c => c.event && c.event.tpl === sp.id).id;
  await al.goto(h.base + "/#/conta"); await al.reload(); await al.waitForSelector(`[data-class="${cid}"]`); const card = await al.locator(`[data-class="${cid}"]`).innerText();
  ok(/Pix\/cartão ou 2 créditos/.test(card) && /R\$\s?35,00 ou 2 créditos/.test(card), 'card da aula mostra "R$ 35,00 ou 2 créditos" (' + card.replace(/\n/g, ' | ').slice(0, 140) + ')');
  await al.locator(`[data-class="${cid}"] [data-act=pick]`).click(); await al.waitForSelector('.map2'); await al.locator('.bk:not([disabled])').nth(2).click(); await sleep(al, 200);
  ok(await al.locator('[data-act=seatok][data-how=direct]').count() === 1 && await al.locator('[data-act=seatok][data-how=credit]').count() === 1, 'tela das bikes mostra os dois botões: pagar e usar créditos');
  await shot(al, 'escolhe');
  await al.locator('[data-act=seatok][data-how=credit]').click(); await al.waitForSelector('.ticket'); ok((await state(al)).db.users[0].credits === 1, 'aluna usou 2 créditos (3 → 1)'); await al.click('.modal [data-act=close]');
  await al.waitForSelector(`[data-class="${cid}"]`); ok(/2 créditos/.test(await al.locator(`[data-class="${cid}"]`).innerText()) && await al.locator(`[data-class="${cid}"] [data-act=cancel]`).count() === 1, 'card mostra a vaga paga com créditos e o botão Cancelar');
  // só créditos e sem crédito suficiente
  await post(dona, 'specSave', { id: sp.id, name: sp.name, price: '35,00', pay: 'credits', credits: 2, theme: sp.theme, duration: sp.duration, desc: sp.desc, active: true, applyAll: true });
  await post(dona, 'specSchedule', { id: sp.id, start: new Date(Date.now() + 5 * 864e5).toISOString() }); st = await state(dona); const cid2 = st.db.classes.filter(c => c.event && c.event.tpl === sp.id).find(c => c.id !== cid).id;
  await al.reload(); await al.waitForSelector(`[data-class="${cid2}"]`); await al.locator(`[data-class="${cid2}"] [data-act=pick]`).click(); await al.waitForSelector('.map2'); await al.locator('.bk:not([disabled])').first().click(); await sleep(al, 200);
  ok(await al.locator('[data-act=seatok][data-how=direct]').count() === 0 && await al.locator('.modal [data-act=gobuy]').count() === 1, '"só créditos" sem crédito suficiente: sem botão de pagar, aparece "comprar créditos"'); await shot(al, 'socredito');
  console.log('\nERROS NO NAVEGADOR:', errors.length ? errors : 'nenhum'); console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK'); await B.close(); h.stop(); process.exit(fails || errors.length ? 1 : 0);
})().catch(e => { console.error('EXCEÇÃO', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
