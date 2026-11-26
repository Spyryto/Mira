(function(){
  'use strict';
  const DAY=86400000,MAX=3652058;
  function parse(text){
    if(typeof text!=='string'||text.length!==10||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(text)||text.startsWith('0000-'))return null;
    const date=new Date(text+'T00:00:00.000Z');
    if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==text)return null;
    return date;
  }
  function checked(text){
    const date=parse(text);
    if(!date)throw Error('invalid_date');
    return date;
  }
  function add(count,text){
    const date=checked(text);
    if(!Number.isSafeInteger(count)||Math.abs(count)>MAX)throw Error('invalid_day_count');
    const next=new Date(date.getTime()+count*DAY);
    if(next.getUTCFullYear()<1||next.getUTCFullYear()>9999)throw Error('date_out_of_range');
    return next.toISOString().slice(0,10);
  }
  globalThis.MiraDateHost=Object.freeze({
    'native valid date':text=>parse(text)!==null,
    'native checked date':text=>{checked(text);return text;},
    'native weekday':text=>checked(text).getUTCDay()||7,
    'native add days:to:':add,
    'native days between:and:':(first,last)=>(checked(last).getTime()-checked(first).getTime())/DAY
  });
})();
