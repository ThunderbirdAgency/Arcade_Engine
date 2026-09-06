export function initialState(){return{coins:1000,debt:0,decision:0,inspected:false,armor:'old',charm:false,history:[],moves:0};}
export function applyEffect(state,effect){
 const s=structuredClone(state);s.moves++;
 switch(effect){
 case 'inspect':s.inspected=true;break;
 case 'cash':s.coins-=600;s.armor='gold';s.decision=1;s.history.push('Bought the armor for 600 coins. No armor payments remain.');break;
 case 'borrow':s.coins-=100;s.debt+=720;s.armor='gold';s.decision=1;s.history.push('Kept more cash today; committed to six payments of 120 coins.');break;
 case 'keep':s.decision=1;s.history.push('Kept the old armor and all 1,000 starting coins.');break;
 case 'charm':s.coins-=250;s.charm=true;s.decision=2;s.history.push('Bought the 250-coin charm before the next reward arrived.');break;
 case 'reserve':s.decision=2;s.history.push('Kept 250 coins available for the road ahead.');break;
 case 'repair':{const short=Math.max(0,250-s.coins);s.coins=Math.max(0,s.coins-250);if(short){s.debt+=short+50;s.history.push(`The repair needed a ${short}-coin advance plus a 50-coin fee.`);}else{s.history.push('Covered the 250-coin bridge repair from available coins.');}break;}
 case 'reward':s.coins+=400;break;
 case 'pay':{const paid=Math.min(s.debt,Math.max(0,s.coins-100));s.coins-=paid;s.debt-=paid;s.decision=3;s.history.push(paid?`Used ${paid} coins to reduce what was owed, keeping at least 100 coins.`:'Already owed nothing; kept the reward available.');break;}
 case 'buffer':s.decision=3;s.history.push('Kept the reward as a cash cushion. Existing payment commitments still remain.');break;
 case 'party':s.coins-=300;s.decision=3;s.history.push('Spent 300 coins on a feast. The kingdom enjoyed it immensely.');break;
 }
 if(s.coins<0||s.debt<0)throw new Error('Invalid game balance');return s;
}
export function ending(s){if(s.debt===0&&s.coins>=250)return{title:'Keeper of the kingdom',subtitle:'You leave with breathing room.',body:'The dragon closes his ledger. “Enough for today. Something for tomorrow. Annoyingly sensible.” Your commitments are settled, and you still have coins for the next adventure.'};if(s.coins>=250)return{title:'A plan worth defending',subtitle:'Your next move matters.',body:'You leave with coins available and commitments still to meet. The dragon hands you a calendar instead of a trophy. “A reserve is useful. So is remembering when payments are due.”'};return{title:'The sequel has a budget',subtitle:'You survived. Your cushion is thin.',body:'The castle is behind you, but little cash remains for a surprise. The dragon offers one parting gift: the chance to replay your choices before the next quest begins.'};}
