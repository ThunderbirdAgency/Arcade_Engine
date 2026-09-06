export const encounters = [
 {id:'gate',name:'The falling gate',chapter:'I · THE APPROACH',art:'gate',cue:'Stone on the right. Dodge left!',correct:'left',choices:[{id:'left',label:'Dodge left',key:'← / A',icon:'←'},{id:'right',label:'Run right',key:'→ / D',icon:'→'}],lesson:'Look before you leap. A moment of attention can save a costly mistake.',failure:'Wrong turn. The gate gets the last word.',success:'A close call. On to the merchant.',open:.52,close:.93},
 {id:'merchant',name:'The golden offer',chapter:'II · THE FINE PRINT',art:'merchant',cue:'600 outright. Or 100 + six payments of 120. Inspect first!',correct:'inspect',choices:[{id:'inspect',label:'Read the contract',key:'← / A',icon:'⌕'},{id:'sign',label:'Grab the offer',key:'→ / D',icon:'✎'}],lesson:'100 + (6 × 120) = 820 coins. That is 220 more than the 600-coin price. You kept your old armor and all 1,000 coins.',failure:'You got wrapped up in the offer.',success:'Fine print read. Paper trap avoided.',open:.48,close:.93},
 {id:'dragon',name:'The keeper of gold',chapter:'III · THE VAULT',art:'dragon',cue:'Watch the dragon. Duck below the flame!',correct:'duck',choices:[{id:'duck',label:'Duck!',key:'↓ / S / Space',icon:'↓'},{id:'strike',label:'Strike!',key:'↑ / W',icon:'↑'}],lesson:'You protected your reserve and earned 400 coins. Final purse: 1,400. In this fictional quest, keeping a cushion beat buying the shiny upgrade.',failure:'A bold strategy. A lightly toasted result.',success:'Flame dodged. The vault is yours.',open:.48,close:.93}
];
export function judgeInput(time,open,close,choice,correct){
 if(time<open)return 'early';
 if(time>close)return 'late';
 return choice===correct?'win':'fail';
}
