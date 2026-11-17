// Compatibility entry point: enriched content is maintained under content/.
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const result=spawnSync(process.execPath,[path.join(__dirname,'build-research.mjs')],{stdio:'inherit'});
process.exit(result.status??1);
