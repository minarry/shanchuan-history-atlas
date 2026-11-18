import {spawnSync} from 'node:child_process';
import {rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const output=fileURLToPath(new URL('../dist/source.zip',import.meta.url));
rmSync(output,{force:true});
const result=spawnSync('/usr/bin/zip',['-q','-r',output,'dist','content','scripts','README.md','CONTENT-EXPANSION.md','LICENSE','package.json','.gitignore','-x','dist/source.zip'],{cwd:root,stdio:'inherit'});
if(result.status!==0)throw Error('Source package failed');
console.log('Source package refreshed');
