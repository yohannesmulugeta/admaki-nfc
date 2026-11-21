import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {loadCompanies} from './company-registry.mjs';
const companies=loadCompanies();
const templates=new Map();
for(const company of companies)for(const profile of company.profiles){
 const source=`public/${profile.slug}/index.html`;
 if(templates.has(profile.theme))continue;templates.set(profile.theme,source);
 let html=readFileSync(source,'utf8');html=html.replace(/<script\b[^>]*src="\/profiles\/(?:profile|connect-share)\.js"[^>]*><\/script>/g,'').replace('</head>','<script type="module" src="/dashboard/preview.js"></script></head>').replace('noindex,follow','noindex,nofollow');
 const dir=profile.theme==='maison'?'public/dashboard/preview':`public/dashboard/preview/${profile.theme}`;mkdirSync(dir,{recursive:true});writeFileSync(dir+'/index.html',html);
}
mkdirSync('.local',{recursive:true});writeFileSync('.local/company-onboarding.json',JSON.stringify(companies,null,2));
console.log(`Shared workspaces ready: ${companies.length} companies, ${companies.reduce((sum,c)=>sum+c.profiles.length,0)} cards, ${templates.size} public layouts.`);
