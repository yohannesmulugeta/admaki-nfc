// Insert-only, parameterized statements. Redirect to a private local file.
// No accounts, credentials, existing card contents, or versions are changed.
import {loadCompanies} from './company-registry.mjs';
const batch=[];
for(const company of loadCompanies()){
 batch.push({sql:'INSERT INTO organizations(id,name,logo_url,accent) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING',params:[company.id,company.name,company.logo,company.accent]});
 batch.push({sql:"UPDATE organizations SET logo_url=?,accent=? WHERE id=? AND logo_url=''",params:[company.logo,company.accent,company.id]});
 for(const profile of company.profiles){const id=company.id+'-'+profile.slug.replaceAll('/','-');
  batch.push({sql:'INSERT INTO cards(id,organization_id,slug,label,published_json) VALUES(?,?,?,?,?) ON CONFLICT(slug) DO NOTHING',params:[id,company.id,profile.slug,profile.name+' · '+profile.slug.split('/').at(-1),JSON.stringify(profile)]});
  batch.push({sql:'INSERT INTO card_revisions(card_id,version,profile_json) SELECT id,version,published_json FROM cards WHERE slug=? AND organization_id=? AND NOT EXISTS(SELECT 1 FROM card_revisions r WHERE r.card_id=cards.id)',params:[profile.slug,company.id]});
 }
}
process.stdout.write(JSON.stringify({batch}));
