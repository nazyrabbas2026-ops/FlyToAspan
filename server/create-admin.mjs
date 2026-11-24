import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { checkPassword, normalizeEmail } from './api.mjs';
import { createAccount, openDatabase } from './store.mjs';

if (!process.stdin.isTTY) {
  console.error('Yönetici hesabı oluşturmak için bir terminal kullanın.');
  process.exitCode = 1;
} else {
  let muted = false;
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) process.stdout.write(chunk);
      callback();
    },
  });
  const input = createInterface({ input: process.stdin, output, terminal: true, historySize: 0 });
  let db;

  try {
    const email = normalizeEmail(await input.question('Yönetici e-postası: '));
    process.stdout.write('Yeni parola (en az 12 karakter): ');
    muted = true;
    const password = await input.question('');
    process.stdout.write('\n');
    checkPassword(password);
    db = openDatabase();
    const user = await createAccount(db, {
      email, password, role: 'admin', firstName: 'FlyToAspan', lastName: 'Yönetici',
      phone: '', accountType: 'individual',
    });
    if (!user) throw new Error('Bu e-posta adresi zaten kayıtlı.');
    console.log('Yönetici hesabı oluşturuldu.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    input.close();
    db?.close();
  }
}
