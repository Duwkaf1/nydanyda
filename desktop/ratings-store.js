import {readFileSync,writeFileSync,rmSync} from 'node:fs';
export function ratingsStore(file,safeStorage){
 let key='',persisted=false;
 const secure=()=>safeStorage.isEncryptionAvailable()&&safeStorage.getSelectedStorageBackend?.()!=='basic_text';
 try{if(secure()){key=safeStorage.decryptString(readFileSync(file));persisted=!!key;}}catch{}
 return {get:()=>key,status:()=>({configured:!!key,persisted}),set(value){if(typeof value!=='string'||value!==''&&!/^[a-zA-Z0-9]{4,64}$/.test(value))throw new Error('Некорректный ключ OMDb.');key=value;persisted=false;rmSync(file,{force:true});if(key&&secure()){try{writeFileSync(file,safeStorage.encryptString(key),{mode:0o600});persisted=true;}catch{}}return this.status();}};
}
