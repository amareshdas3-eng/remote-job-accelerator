import fs from 'node:fs';import assert from 'node:assert';
const required=['app/api/ai/job-match/route.ts','app/api/ai/resume-tailor/route.ts','app/api/ai/interview/route.ts','app/api/ai/cover-letter/route.ts','app/api/resume/upload/route.ts','app/api/jobs/ingest/route.ts','app/api/webhooks/gumroad/[secret]/route.ts','app/api/extension/oauth/exchange/route.ts','app/api/account/export/route.ts','app/api/account/delete/route.ts','api/schema.sql','extension/manifest.json','docs/LAUNCH.md'];
for(const f of required)assert(fs.existsSync(f),f+' missing');
const pkg=JSON.parse(fs.readFileSync('package.json'));assert(pkg.version==='4.3.0');assert(pkg.dependencies['@supabase/ssr']);assert(pkg.dependencies['jose']);assert(pkg.dependencies['pdf-parse']);assert(pkg.dependencies['mammoth']);
const schema=fs.readFileSync('api/schema.sql','utf8');for(const s of ['rate_limits','consume_rate_limit','extension_oauth_codes'])assert(schema.includes(s));
const mwFile=fs.existsSync('proxy.ts')?'proxy.ts':'middleware.ts';const mw=fs.readFileSync(mwFile,'utf8');for(const h of ['Content-Security-Policy','X-Frame-Options','Strict-Transport-Security'])assert(mw.includes(h));
console.log('RJA v4.3 customer-ready smoke checks passed');
