/* PowerAI ONE — historical reverse-analysis primitives
 * Descriptive statistics only; never feeds official learning or predicts draw outcomes.
 */
(function(root){
  "use strict";
  function create(domain){
    if(!domain||typeof domain.normalizeDraw!=="function")throw new TypeError("Canonical domain API is required");
    function analyze(rows){
      const valid=[],rejected=[],seen=new Set();
      (Array.isArray(rows)?rows:[]).forEach((row,index)=>{
        const parsed=domain.normalizeDraw(row);
        if(!parsed.ok){rejected.push({index,id:row?.id??null,errors:parsed.errors});return;}
        if(seen.has(parsed.draw.id)){rejected.push({index,id:parsed.draw.id,errors:["DUPLICATE_DRAW_ID"]});return;}
        seen.add(parsed.draw.id);valid.push(parsed.draw);
      });
      valid.sort((a,b)=>a.id-b.id);
      const n=valid.length;
      if(!n)throw new Error("NO_VALID_DRAWS_FOR_REVERSE_ANALYSIS");
      const main=Array(56).fill(0),special=Array(56).fill(0),pairs=new Map();
      const sums=[],oddCounts=[],lowCounts=[],consecutiveDraws=[],drawOverlaps=[];
      const gapByNumber=Array.from({length:56},()=>[]);
      let specialMissing=0;
      for(let i=0;i<n;i++){
        const d=valid[i],set=new Set(d.main);
        d.main.forEach(v=>{main[v]++;gapByNumber[v].push(i);});
        if(d.special===null)specialMissing++;else special[d.special]++;
        for(let a=0;a<6;a++)for(let b=a+1;b<6;b++){
          const key=d.main[a]+"-"+d.main[b];pairs.set(key,(pairs.get(key)||0)+1);
        }
        sums.push(d.main.reduce((a,b)=>a+b,0));
        oddCounts.push(d.main.filter(v=>v%2===1).length);
        lowCounts.push(d.main.filter(v=>v<=27).length);
        consecutiveDraws.push(d.main.some((v,j)=>j>0&&v===d.main[j-1]+1));
        if(i>0){
          const prev=new Set(valid[i-1].main);
          drawOverlaps.push(d.main.filter(v=>prev.has(v)).length);
        }
      }
      const mean=arr=>arr.reduce((a,b)=>a+b,0)/arr.length;
      const sd=arr=>{const m=mean(arr);return Math.sqrt(mean(arr.map(x=>(x-m)**2)));};
      const mainValues=main.slice(1),specialValues=special.slice(1);
      const mainExpected=n*6/55,specialExpected=(n-specialMissing)/55;
      const mainMean=mean(mainValues),specialMean=mean(specialValues);
      const numberStats=Array.from({length:55},(_,i)=>{
        const number=i+1,positions=gapByNumber[number],last=positions.length?positions[positions.length-1]:null;
        return {number,mainCount:main[number],mainZ:mainExpected?((main[number]-mainExpected)/Math.sqrt(mainExpected*(1-6/55))):0,
          specialCount:special[number],lastSeenDrawIndex:last===null?null:last,
          drawsSinceLast:last===null?n:n-1-last};
      });
      const topPairs=[...pairs.entries()].map(([pair,count])=>({pair:pair.split("-").map(Number),count}))
        .sort((a,b)=>b.count-a.count||a.pair[0]-b.pair[0]).slice(0,20);
      const parityHistogram=Array.from({length:7},(_,k)=>({odd:k,draws:oddCounts.filter(x=>x===k).length}));
      const lowHighHistogram=Array.from({length:7},(_,k)=>({low:k,high:6-k,draws:lowCounts.filter(x=>x===k).length}));
      return {
        reportType:"POWERAI_ONE_HISTORICAL_REVERSE_ANALYSIS",
        descriptiveOnly:true,learningUpdated:false,
        data:{draws:n,firstDrawId:valid[0].id,lastDrawId:valid[n-1].id,firstDate:valid[0].date,lastDate:valid[n-1].date,rejectedRows:rejected.length,specialMissing},
        mainFrequency:{expectedPerNumber:mainExpected,mean:mainMean,sd:sd(mainValues),coefficientOfVariation:mainMean?sd(mainValues)/mainMean:0,min:Math.min(...mainValues),max:Math.max(...mainValues),range:Math.max(...mainValues)-Math.min(...mainValues)},
        specialFrequency:{expectedPerNumber:specialExpected,mean:specialMean,sd:sd(specialValues),coefficientOfVariation:specialMean?sd(specialValues)/specialMean:0,min:Math.min(...specialValues),max:Math.max(...specialValues),range:Math.max(...specialValues)-Math.min(...specialValues)},
        structure:{
          meanSum:mean(sums),sdSum:sd(sums),minSum:Math.min(...sums),maxSum:Math.max(...sums),
          meanOdd:mean(oddCounts),parityHistogram,
          meanLow:mean(lowCounts),lowHighHistogram,
          consecutiveDrawRate:consecutiveDraws.filter(Boolean).length/n,
          meanRepeatFromPreviousDraw:drawOverlaps.length?mean(drawOverlaps):0,
          pairCount:pairs.size,topPairs
        },
        numbers:numberStats,
        rejected
      };
    }
    return Object.freeze({analyze});
  }
  root.PowerAIOneReverseAnalysis={create};
  if(typeof module!=="undefined"&&module.exports)module.exports=root.PowerAIOneReverseAnalysis;
})(typeof globalThis!=="undefined"?globalThis:this);
