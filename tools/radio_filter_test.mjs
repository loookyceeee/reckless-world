// Radio title filter check: node tools/radio_filter_test.mjs (fail 0 = pass). Obfuscated swears caught; Essex/Arsenal/Scunthorpe/Cocktail pass.
import { cleanTitle } from '../src/music.js';
const bad=['F*ck It Up','Sh!t Hot','B!tch Better','Fkn Banger','MOTHERF***ER (Extended)','fuckin rave','Bullshit Detector','Arsehole','Sh1te Mix','FCKN LOUD','C*nt','Dick','Wh0re','N!gga','Explicit Mix','f.u.c.k'];
const good=['Essex Hardcore Mix','Middlesex Rave','Scunthorpe','Arsenal Anthem','Cocktail Hour','Dicky Bow','Grass Roots','Hardcore Classics Vol 1','Lorimer - Pipe Kick [RR007]','Power','Shift Change','Folk Song','Sussex','Classic','Assassin','Pass The Mic','Cockney Rejects','Kickdrum','Count To Ten','Shiitake'];
let fail=0; for(const t of bad) if(!cleanTitle(t,'X').includes('RECKLESS RADIO')){fail++;console.log('MISS',t)} for(const t of good) if(cleanTitle(t,'X')!==t){fail++;console.log('FALSE+',t)} console.log('fail',fail);
