'use strict';
require('node:child_process').execFileSync(process.execPath,[require('node:path').join(__dirname,'..','scripts','build-portable.cjs'),'--only',"codex"],{stdio:'inherit'});
