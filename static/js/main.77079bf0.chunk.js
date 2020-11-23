(this.webpackJsonpklipping=this.webpackJsonpklipping||[]).push([[0],{41:function(e,t,n){},72:function(e,t,n){"use strict";n.r(t);n(5);var i=n(0),r=n.n(i),c=n(14),a=n.n(c),o=(n(41),n(7)),s=n(9),u=n(4),d=n(3),l=n(10),b=Object(l.c)({name:"mainMenuState",initialState:{value:"Cutting"},reducers:{setState:function(e,t){e.value=t.payload}}}),p=b.actions.setState,f=function(e){return e.mainMenuState.value},j=b.reducer,O=n(1),m=function(e){var t=e.iconName,n=e.stateName,i=Object(d.b)(),r=Object(d.c)(f),c=Object(o.a)(Object(o.a)({backgroundColor:"snow",borderRadius:"10px",fontSize:"medium",width:"100%",height:"100px",cursor:"pointer",transitionDuration:"0.3s",transitionProperty:"transform"},r===n&&{backgroundColor:"lightblue"}),{},{"&:hover":{transform:"scale(1.1)"},"&:active":{transform:"scale(0.9)"},display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",textAlign:"center",gap:"10px"});return Object(O.b)("div",{css:c,title:n,onClick:function(){i(p(n))}},Object(O.b)(s.a,{icon:t,size:"2x"}),Object(O.b)("div",null,n))},g=function(){return Object(O.b)("div",{style:{backgroundColor:"snow",borderRight:"1px solid #BBB",width:"100px",display:"flex",flexDirection:"column",alignItems:"center",padding:"20px",gap:"30px"},title:"MainMenu"},Object(O.b)(m,{iconName:u.d,stateName:"Cutting"}),Object(O.b)(m,{iconName:u.e,stateName:"Metadata"}),Object(O.b)(m,{iconName:u.g,stateName:"Thumbnail"}),Object(O.b)(m,{iconName:u.i,stateName:"Start Workflow"}))},v=n(12),x=n(16),y=function(e,t){var n=Math.pow(10,t);return Math.round((e+Number.EPSILON)*n)/n},h=Object(l.c)({name:"videoState",initialState:{isPlaying:!1,currentlyAt:0,segments:[{id:Object(l.d)(),startTime:0,endTime:64733,state:"alive"}]},reducers:{setIsPlaying:function(e,t){e.isPlaying=t.payload},setCurrentlyAt:function(e,t){e.currentlyAt=y(t.payload,3)},setCurrentlyAtInSeconds:function(e,t){e.currentlyAt=y(1e3*t.payload,3)},addSegment:function(e,t){e.segments.push(t.payload)},cut:function(e){var t=e.segments.findIndex((function(t){return t.startTime<=e.currentlyAt&&t.endTime>=e.currentlyAt}));if(e.segments[t].startTime===e.currentlyAt||e.segments[t].endTime===e.currentlyAt)return e;var n={id:Object(l.d)(),startTime:e.segments[t].startTime,endTime:e.currentlyAt,state:"dead"},i={id:Object(l.d)(),startTime:e.currentlyAt,endTime:e.segments[t].endTime,state:"dead"};e.segments.splice(t,1,n,i)}}}),w=h.actions,C=w.setIsPlaying,S=w.setCurrentlyAt,k=w.setCurrentlyAtInSeconds,N=(w.addSegment,w.cut),R=function(e){return e.videoState.isPlaying},T=function(e){return e.videoState.currentlyAt},I=function(e){return e.videoState.currentlyAt/1e3},A=function(e){return e.videoState.segments},D=h.reducer,L=n(15),U=n.n(L),P=n(19),z=n(35);function M(e){return B.apply(this,arguments)}function B(){return(B=Object(P.a)(U.a.mark((function e(t){var n,i,r,c,a,s,u,d,l,b=arguments;return U.a.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return n=b.length>1&&void 0!==b[1]?b[1]:{},i=n.body,r=Object(z.a)(n,["body"]),c={"Content-Type":"application/json"},a=btoa(unescape(encodeURIComponent("admin:opencast"))),s={Authorization:"Basic ".concat(a)},u=Object(o.a)(Object(o.a)({method:i?"POST":"GET"},r),{},{headers:Object(o.a)(Object(o.a)(Object(o.a)({},c),r.headers),s)}),i&&(u.body=JSON.stringify(i)),e.prev=6,e.next=9,window.fetch(t,u);case 9:return l=e.sent,e.next=12,l.json();case 12:if(d=e.sent,!l.ok){e.next=15;break}return e.abrupt("return",d);case 15:throw new Error(l.statusText);case 18:return e.prev=18,e.t0=e.catch(6),e.abrupt("return",Promise.reject(e.t0.message?e.t0.message:d));case 21:case"end":return e.stop()}}),e,null,[[6,18]])})))).apply(this,arguments)}M.get=function(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{};return M(e,Object(o.a)(Object(o.a)({},t),{},{method:"GET"}))},M.post=function(e,t){var n=arguments.length>2&&void 0!==arguments[2]?arguments[2]:{};return M(e,Object(o.a)(Object(o.a)({},n),{},{body:t}))};var E=Object(l.b)("videoURL/fetchVideoURL",Object(P.a)(U.a.mark((function e(){var t;return U.a.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return e.next=2,M.get("https://legacy.opencast.org/admin-ng/tools/ID-dual-stream-demo/editor.json");case 2:return t=e.sent,e.abrupt("return",t);case 4:case"end":return e.stop()}}),e)})))),V=Object(l.c)({name:"videoURL",initialState:{videoURLs:[],videoCount:0,duration:0,title:"",presenters:[],status:"idle",error:null},reducers:{},extraReducers:function(e){e.addCase(E.pending,(function(e,t){e.status="loading"})),e.addCase(E.fulfilled,(function(e,t){e.status="success",e.videoURLs=t.payload.previews.reduce((function(e,t){return e.push(t.uri),e}),[]),e.videoCount=t.payload.previews.length,e.duration=t.payload.duration,e.title=t.payload.title,e.presenters=t.payload.presenters})),e.addCase(E.rejected,(function(e,t){e.status="failed",e.error=t.error.message}))}}),F=function(e){return e.videoURL.videoURLs},W=function(e){return e.videoURL.videoCount},J=function(e){return e.videoURL.duration},G=function(e){return e.videoURL.duration/1e3},H=function(e){return e.videoURL.title},q=function(e){return e.videoURL.presenters},Y=V.reducer,_=n(32),K=n.n(_);var Q={name:"1p6g5ly",styles:"min-width:320px;min-height:240px;"},X=function(e){var t=e.url,n=e.isMuted,r=Object(d.b)(),c=Object(d.c)(R),a=Object(d.c)(I),o=Object(d.c)(G),s=Object(i.useState)(!1),u=Object(x.a)(s,2),l=u[0],b=u[1],p=Object(i.useRef)(null);Object(i.useEffect)((function(){!c&&p.current&&l&&p.current.seekTo(a,"seconds")}));var f=Q;return Object(O.b)(K.a,{url:t,ref:p,width:"100%",height:"auto",playing:c,muted:n,css:f,onProgress:function(e){y(a,3)!==y(e.playedSeconds,3)&&r(k(e.playedSeconds))},progressInterval:100,onReady:function(){b(!0)},onEnded:function(){r(C(!1)),r(k(o))}})},Z=function(){var e=Object(d.b)(),t=Object(d.c)(R),n=Object(d.c)(T),r=Object(i.useState)(!1),c=Object(x.a)(r,2),a=c[0],o=c[1];return Object(O.b)("div",{css:{display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",width:"100%",padding:"10px"},title:"Video Controls"},Object(O.b)("div",{css:{display:"flex",flexDirection:"row",justifyContent:"center",alignItems:"center",width:"100%",padding:"10px",gap:"20px"},title:"Video Controls Top Row"},Object(O.b)("div",null,Object(O.b)(s.a,{icon:u.c,size:"2x"}),Object(O.b)(s.a,{css:{cursor:"pointer",transitionDuration:"0.3s",transitionProperty:"transform","&:hover":{transform:"scale(1.05)"}},icon:a?u.k:u.j,size:"2x",onClick:function(){return o(!a)}})),Object(O.b)(s.a,{css:{cursor:"pointer",transitionDuration:"0.3s",transitionProperty:"transform","&:hover":{transform:"scale(1.1)"},"&:active":{transform:"scale(0.9)"}},icon:t?u.f:u.h,size:"5x",onClick:function(){return e(C(!t))}}),new Date(n||0).toISOString().substr(11,12)))},$=function(){var e=Object(d.c)(H),t=Object(d.c)(q);return Object(O.b)("div",{title:"Video Area Header"},Object(O.b)("div",{css:{fontSize:"large"},title:"Video Title"},e),Object(O.b)("div",{title:"Video Presenters"},"by ",t.join(", ")))},ee=function(){var e,t=Object(d.b)(),n=Object(d.c)(F),r=Object(d.c)(W),c=Object(d.c)((function(e){return e.videoURL.status})),a=Object(d.c)((function(e){return e.videoURL.error}));Object(i.useEffect)((function(){"idle"===c&&t(E())}),[c,t]),"loading"===c?e=Object(O.b)("div",{className:"loader"},"Loading..."):"success"===c?e="":"failed"===c&&(e=Object(O.b)("div",null,a));for(var o=[],s=0;s<r;s++)o.push(Object(O.b)(X,{key:s,url:n[s],isMuted:0===s}));return Object(O.b)("div",{css:{backgroundColor:"snow",display:"flex",width:"auto",flex:"7",flexDirection:"column",justifyContent:"center",alignItems:"center",padding:"10px",borderBottom:"1px solid #BBB"},title:"Video Area"},e,Object(O.b)($,null),Object(O.b)("div",{css:{backgroundColor:"black",display:"flex",flexDirection:"row",justifyContent:"center",alignItems:"center",width:"100%"},title:"Video Player Area"},o),Object(O.b)(Z,null))},te=n(33),ne=n.n(te),ie=n(34),re=n.p+"static/media/placeholder_waveform.d23b087b.png";var ce={name:"190c1k3",styles:"height:230px;"},ae={name:"blfv16",styles:"background-color:rgba(255, 255, 255, 1);border-radius:10px;height:50px;display:flex;justify-content:center;align-items:center;box-shadow:0 0 10px rgba(0, 0, 0, 0.3);cursor:pointer;transition-duration:0.3s;transition-property:transform;&:hover{transform:scale(1.1);}&:active{transform:scale(0.9);}"},oe={name:"2q5poe",styles:"transform:scaleY(1.5) rotate(90deg);padding:5px;"},se=function(e){var t=e.timelineWidth,n=Object(d.b)(),r=Object(d.c)(R),c=Object(d.c)(T),a=Object(d.c)(J),o=Object(i.useState)({x:0,y:0}),l=Object(x.a)(o,2),b=l[0],p=l[1],f=Object(i.useRef)(0);Object(i.useEffect)((function(){c!==f.current&&(j(),f.current=c)}));var j=function(){var e=b.y;p({x:c/a*t,y:e})},m=Object(O.a)({backgroundColor:"rgba(255, 0, 0, 1)",height:"250px",width:"1px",position:"absolute",zIndex:2,boxShadow:"0 0 10px rgba(0, 0, 0, 0.3)",display:"flex",justifyContent:"center",alignItems:"center"},""),g=ae,v=oe;return Object(O.b)(ne.a,{onStop:function(e,i){var r=i.x,c=i.y;p({x:r,y:c}),n(S(r/t*a))},axis:"x",bounds:"parent",position:b,disabled:r},Object(O.b)("div",{css:m,title:"Scrubber"},Object(O.b)("div",{css:g,title:"dragHandle"},Object(O.b)(s.a,{css:v,icon:u.a,size:"1x"}))))},ue=function(e){e.timelineWidth;var t=Object(d.c)(A),n=Object(d.c)(J),i=Object(O.a)({display:"flex",flexDirection:"row",paddingTop:"10px"},"");return Object(O.b)("div",{css:i,title:"Segments"},t.map((function(e){return Object(O.b)("div",{key:e.id,title:"Segment",css:Object(v.a)({backgroundColor:"alive"===e.state?"rgba(0, 0, 255, 0.4)":"rgba(255, 0, 0, 0.4)",borderRadius:"25px",borderStyle:"solid",borderBlockColor:"black",borderWidth:"1px",boxSizing:"border-box",width:(e.endTime-e.startTime)/n*100+"%",height:"230px",zIndex:1},"")})})))},de=function(){var e=Object(ie.a)(),t=e.ref,n=e.width,i=void 0===n?1:n,r=Object(O.a)({position:"relative",borderRadius:"10px",backgroundColor:"snow",height:"250px",width:"100%"},"");return Object(O.b)("div",{ref:t,css:r,title:"Timeline"},Object(O.b)(se,{timelineWidth:i}),Object(O.b)("div",{css:ce},Object(O.b)("img",{alt:"waveform2",src:re,style:{position:"absolute",height:"230px",width:"100%",top:"10px"}}),Object(O.b)(ue,{timelineWidth:i})))},le=function(e){var t=e.iconName,n=e.actionName,i=e.action,r=Object(d.b)();return Object(O.b)("div",{css:{backgroundColor:"snow",borderRadius:"10px",fontSize:"medium",width:"100px",height:"100px",boxShadow:"0 0 10px rgba(0, 0, 0, 0.3)",cursor:"pointer",justifyContent:"center",alignContent:"center",transitionDuration:"0.3s",transitionProperty:"transform","&:hover":{transform:"scale(1.1)"},"&:active":{transform:"scale(0.9)"},display:"flex",flexDirection:"column",alignItems:"center",gap:"10px",textAlign:"center"},title:n,onClick:function(){return r(i())}},Object(O.b)(s.a,{icon:t,size:"2x"}),Object(O.b)("div",null,n))},be=function(){var e=Object(O.a)({backgroundColor:"snow",flex:"3",display:"flex",flexDirection:"row",justifyContent:"space-between",padding:"00px",gap:"30px"},""),t=Object(O.a)({backgroundColor:"snow",display:"flex",flexDirection:"row",gap:"30px"},""),n=Object(O.a)({backgroundColor:"snow",display:"flex",flexDirection:"row",gap:"30px"},"");return Object(O.b)("div",{css:e},Object(O.b)("div",{css:t},Object(O.b)(le,{iconName:u.b,actionName:"Cut",action:N}),Object(O.b)(le,{iconName:u.m,actionName:"Mark as Deleted",action:N}),Object(O.b)(le,{iconName:u.i,actionName:"Concatenate Left",action:N}),Object(O.b)(le,{iconName:u.i,actionName:"Concatenate Right",action:N})),Object(O.b)("div",{css:n},Object(O.b)(le,{iconName:u.i,actionName:"Reset changes",action:N}),Object(O.b)(le,{iconName:u.i,actionName:"Undo",action:N})))},pe=function(){var e=Object(d.c)(f),t=Object(O.a)({flex:"1",display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",paddingRight:"20px",gap:"20px"},"");return Object(O.b)("div",{css:t,title:"MainMenuContext"},function(e){switch(e){case"Cutting":return Object(O.b)(r.a.Fragment,null,Object(O.b)("div",{css:Object(v.a)({width:"100%",display:"flex",flexDirection:"column",justifyContent:"space-around",gap:"20px"},"")},Object(O.b)(ee,null),Object(O.b)(be,null)),Object(O.b)(de,null));default:return Object(O.b)(r.a.Fragment,null,Object(O.b)(s.a,{icon:u.l,size:"10x"}),"Under Construction")}}(e))},fe=function(){return Object(O.b)("div",{css:{display:"flex",flex:"1",flexDirection:"row",gap:"75px"},title:"Body"},Object(O.b)(g,null),Object(O.b)(pe,null))};var je={name:"x7gdnd",styles:"background-color:snow;"};var Oe=function(){return Object(O.b)("div",{css:je,className:"App"},Object(O.b)(fe,null))},me=function(e){e&&e instanceof Function&&n.e(3).then(n.bind(null,73)).then((function(t){var n=t.getCLS,i=t.getFID,r=t.getFCP,c=t.getLCP,a=t.getTTFB;n(e),i(e),r(e),c(e),a(e)}))},ge=Object(l.a)({reducer:{mainMenuState:j,videoState:D,videoURL:Y}});a.a.render(Object(O.b)(r.a.StrictMode,null,Object(O.b)(d.a,{store:ge},Object(O.b)(Oe,null))),document.getElementById("root")),me()}},[[72,1,2]]]);
//# sourceMappingURL=main.77079bf0.chunk.js.map