// Navegador: botão Excluir cadastro (dona) e Excluir minha conta (aluna)
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const { start } = require('./harness');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
(async () => {
  const h = await start({ port: 4610, mock: 4611 }); const B = await chromium.launch(); const errors = [];
  const mk = async (w, hh) => { const ctx = await B.newContext({ viewport: { width: w, height: hh }, deviceScaleFactor: 2 }); const p = await ctx.newPage(); p.on('pageerror', e => errors.push('PAGEERROR ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load resource|net::/.test(m.text())) errors.push('CONSOLE ' + m.text()); }); p.on('dialog', d => { errors.push('DIALOG nativo ' + d.message()); d.dismiss(); }); return p; };
  const sleep = (p, ms) => p.waitForTimeout(ms);
  const shot = async (p, n) => { await sleep(p, 300); await p.screenshot({ path: `/tmp/k_${n}.png` }); };
  const toast = p => p.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
  const dlg = async (p, label) => { await p.waitForSelector('.modal [data-act=dlg]'); await p.locator('.modal [data-act=dlg]', { hasText: label }).click(); await sleep(p, 250); };
  const login = async (p, email, pw) => { await p.goto(h.base + '/#/entrar'); await p.waitForSelector('form[data-form=login]'); await p.fill('form[data-form=login] input[name=email]', email); await p.fill('form[data-form=login] input[name=password]', pw); await p.click('form[data-form=login] button[type=submit]'); };
  const post = (p, path, body) => p.evaluate(([a, b]) => fetch('/api/act/' + a, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json()), [path, body]);
  const state = p => p.evaluate(() => fetch('/api/state').then(r => r.json()));
  const dona = await mk(1280, 900); await login(dona, 'dona@fany.com', 'senhaForte123');
  for (const [n, e, c, i] of [['Ana Souza', 'ana@x.com', '529.982.247-25', 1], ['Bia Lima', 'bia@x.com', '111.444.777-35', 2]]) { const p = await mk(390, 800); await p.goto(h.base + '/'); const r = await p.evaluate(([n, e, c, i]) => fetch('/api/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: n, email: e, phone: '(18) 9911' + i + '-000' + i, cpf: c, password: 'minhasenha1', acceptTerms: true }) }).then(r => r.status), [n, e, c, i]); ok(r === 200, 'cadastro ' + n); await p.close(); }
  await dona.reload(); await dona.waitForSelector('[data-act=atab]'); await dona.click('[data-act=atab][data-t=alunas]'); await dona.fill('#sq', 'Ana'); await sleep(dona, 300);
  await dona.locator('#slist [data-act=ostud]').first().click(); await sleep(dona, 300);
  ok(await dona.locator('[data-act=delstudent]').count() === 1 && await dona.locator('[data-act=block]').count() >= 1, 'ficha tem Bloquear e Excluir cadastro'); await shot(dona, 'excluir_ficha');
  await dona.locator('[data-act=delstudent]').click(); await dona.waitForSelector('.modal'); ok((await dona.locator('.modal').innerText()).includes('Excluir o cadastro de Ana Souza?') && (await dona.locator('.modal').innerText()).includes('Não dá para desfazer'), 'pede confirmação explicando o que acontece'); await shot(dona, 'excluir_confirma');
  await dlg(dona, 'Voltar'); ok((await state(dona)).db.users.some(u => u.email === 'ana@x.com'), 'Voltar não exclui nada');
  await dona.locator('[data-act=delstudent]').click(); await dlg(dona, 'Excluir cadastro'); await sleep(dona, 400);
  ok(/Cadastro excluído/.test(await toast(dona)) && !(await state(dona)).db.users.some(u => u.email === 'ana@x.com'), 'Ana excluída');
  await dona.fill('#sq', 'Ana'); await sleep(dona, 300); ok(!(await dona.locator('#slist').innerText()).includes('Ana Souza'), 'sumiu da lista de alunas');
  // aluna exclui a própria conta
  const bia = await mk(390, 800); await login(bia, 'bia@x.com', 'minhasenha1'); await bia.waitForSelector('text=Sua bike, seus créditos', { timeout: 8000 }).catch(() => {});
  await bia.locator('[data-act=stab][data-t=conta]').first().click(); await sleep(bia, 400); await bia.waitForSelector('[data-act=deleteme]'); await shot(bia, 'excluir_conta'); await bia.locator('[data-act=deleteme]').click(); await bia.waitForSelector('#dlg-input');
  await bia.fill('#dlg-input', 'EXCLUIR'); await dlg(bia, 'Continuar'); await bia.waitForSelector('#dlg-input'); ok(await bia.locator('#dlg-input').getAttribute('type') === 'password', 'senha é pedida com o campo escondido');
  await bia.fill('#dlg-input', 'minhasenha1'); await dlg(bia, 'Excluir conta'); await sleep(bia, 800);
  ok(await bia.locator('.hero').count() >= 1 || (await bia.url()).endsWith('/#/') || (await bia.url()).endsWith('/'), 'depois de excluir, volta para a página inicial (deslogada)');
  ok((await state(dona)).db.users.find(u => u.id && u.deleted && u.name === 'Cadastro excluído') !== undefined && !(await state(dona)).db.users.some(u => u.email === 'bia@x.com'), 'conta da Bia apagada');
  console.log('\nERROS NO NAVEGADOR:', errors.length ? errors : 'nenhum'); console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK'); await B.close(); h.stop(); process.exit(fails || errors.length ? 1 : 0);
})().catch(e => { console.error('EXCEÇÃO', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
