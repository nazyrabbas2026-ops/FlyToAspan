import { createInterface } from 'node:readline/promises';
import { normalizeEmail } from './api.mjs';
import { openDatabase, recoverPanelMfa } from './store.mjs';

if (!process.stdin.isTTY) {
  console.error('Panel doğrulamasını kurtarmak için şirketin yetkili sunucu terminalini kullanın.');
  process.exitCode = 1;
} else {
  const prompt = createInterface({ input: process.stdin, output: process.stdout, terminal: true, historySize: 0 });
  let db;
  try {
    const email = normalizeEmail(await prompt.question('Kimliği doğrulanmış panel hesabının e-postası: '));
    const confirmed = await prompt.question('Oturumları kapatıp yeniden kayıt açmak için SIFIRLA yazın: ');
    if (confirmed !== 'SIFIRLA') throw new Error('Kurtarma iptal edildi.');
    db = openDatabase();
    if (!recoverPanelMfa(db, email)) throw new Error('Etkin panel hesabı bulunamadı.');
    console.log('Oturumlar kapatıldı. Hesap sahibi yeniden girişte iki aşamalı doğrulamayı kurmalı.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    prompt.close();
    db?.close();
  }
}
