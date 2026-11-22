/* Keep potentially large chronological comparisons off the main UI thread. */
importScripts('weight-research-model.js?v=20261122-1');
self.onmessage=event=>{try{self.postMessage({ok:true,result:self.WeightResearchModel.analyze(event.data.rows)});}catch(error){self.postMessage({ok:false,error:error.message||String(error)});}};
