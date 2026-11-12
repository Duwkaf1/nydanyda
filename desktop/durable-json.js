import {closeSync, fsyncSync, openSync, readFileSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import {dirname} from 'node:path';

export function durableJSON(filename, fallback) {
 let value = fallback;
 try { value = JSON.parse(readFileSync(filename, 'utf8')) ?? fallback; } catch {}
 return {
  read: () => value,
  write(next) {
   const json = JSON.stringify(next);
   if (Buffer.byteLength(json) > 1024 * 1024) throw new Error('Файл прогресса слишком большой.');
   const temp = filename + '.tmp';
   try {
    const file = openSync(temp, 'w', 0o600);
    try { writeFileSync(file, json); fsyncSync(file); } finally { closeSync(file); }
    renameSync(temp, filename);
   } catch (error) {
    try { rmSync(temp, {force:true}); } catch {}
    throw error;
   }
   value = next;
   // Directory fsync is unavailable on Windows. The file itself was flushed
   // before replacing the previous committed checkpoint on either platform.
   if (process.platform !== 'win32') {
    try { const dir = openSync(dirname(filename),'r'); try { fsyncSync(dir); } finally { closeSync(dir); } } catch {}
   }
  },
 };
}
