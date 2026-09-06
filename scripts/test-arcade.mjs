import assert from 'node:assert/strict';
import {encounters,judgeInput} from '../dist/arcade-scenes.mjs';
for(const room of encounters){
 const open=6*room.open,close=6*room.close;
 assert.equal(judgeInput(open-.01,open,close,room.correct,room.correct),'early');
 assert.equal(judgeInput(open,open,close,room.correct,room.correct),'win');
 assert.equal(judgeInput(close,open,close,room.correct,room.correct),'win');
 assert.equal(judgeInput(close+.01,open,close,room.correct,room.correct),'late');
 for(const choice of room.choices)assert.equal(judgeInput((open+close)/2,open,close,choice.id,room.correct),choice.id===room.correct?'win':'fail');
 assert(close>open&&open>0&&close<6);
}
console.log('All three room inputs and cue-window boundaries pass.');
