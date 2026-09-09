const CONFIG={supabaseUrl:"https://zmojpxezljwooiloxwdv.supabase.co",supabaseKey:"sb_publishable_TN_HpU6oxVgQx8i8ijI1RA_nUWgaDWB"};
const {createClient}=supabase;
const db=createClient(CONFIG.supabaseUrl,CONFIG.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true}});
let state={businesses:[],selectedBusiness:null,conversation:null,messages:[],memory:[],busy:false};

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
function toast(t){const e=$("#toast");e.textContent=t;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),2800)}
function escapeHtml(s=""){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function md(s=""){let x=escapeHtml(s);x=x.replace(/^### (.+)$/gm,"<h3>$1</h3>").replace(/^## (.+)$/gm,"<h3>$1</h3>").replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/^\s*[-•]\s+(.+)$/gm,"<li>$1</li>").replace(/^\s*\d+\.\s+(.+)$/gm,"<li>$1</li>").replace(/\n\n/g,"<br><br>").replace(/\n/g,"<br>");return x.replace(/(<li>.*?<\/li>)(?:<br>)?/g,"<ul>$1</ul>")}
function setConnection(ok,text){$("#connectionDot").style.background=ok?"#a9c98d":"#d98b8b";$("#connectionText").textContent=text;$("#settingsConnection").textContent=text}
function showView(v){$$(".view").forEach(x=>x.classList.toggle("active",x.id===v+"View"));$$(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.view===v));$("#sidebar").classList.remove("open")}
async function getUser(){const {data}=await db.auth.getUser();return data.user}
async function checkAI(){
  const el=document.getElementById("aiStatus"); if(!el)return;
  el.className="ai-status checking"; el.innerHTML='<span class="status-dot"></span><div><strong>Checking AI connection…</strong><p>Testing Bonnie’s secure reasoning layer.</p></div>';
  try{
    const r=await fetch(CONFIG.supabaseUrl+"/functions/v1/bonnie-ai",{method:"POST",headers:{"Content-Type":"application/json","apikey":CONFIG.supabaseKey,"Authorization":`Bearer ${CONFIG.supabaseKey}`},body:JSON.stringify({message:"Return exactly: AI connection OK",mode:"connection_test",business:{memory:[],business:null},conversation:[]})});
    const body=await r.json().catch(()=>({}));
    if(r.ok){el.className="ai-status ready";el.innerHTML='<span class="status-dot"></span><div><strong>AI connection configured</strong><p>Bonnie’s secure reasoning layer is reachable and responding.</p></div>'}
    else if(r.status===401){el.className="ai-status error";el.innerHTML='<span class="status-dot"></span><div><strong>Authentication needs attention</strong><p>The AI function is reachable, but the current Supabase session is not authorized.</p></div>'}
    else if(r.status===503){el.className="ai-status error";el.innerHTML='<span class="status-dot"></span><div><strong>AI key is not configured</strong><p>Add OPENAI_API_KEY to the Supabase Edge Function secrets.</p></div>'}
    else{throw new Error(body.error||"AI function unavailable")}
  }catch(e){el.className="ai-status error";el.innerHTML='<span class="status-dot"></span><div><strong>AI connection unavailable</strong><p>Bonnie could not reach the secure reasoning layer. Check the Edge Function deployment and secrets.</p></div>'}
}
async function loadBusinesses(){
  // Read-only discovery. Bonnie never creates/changes PITCH tables.
  const candidates=["businesses","pitch_businesses","companies"];
  let found=[];
  for(const table of candidates){
    const r=await db.from(table).select("*").limit(100);
    if(!r.error&&r.data?.length){found=r.data.map(x=>({raw:x,id:x.id,name:x.name||x.business_name||x.company_name||x.title||"Unnamed business"}));break}
  }
  state.businesses=found;
  const sel=$("#businessSelect");sel.innerHTML='<option value="">Everything</option>'+found.map(x=>`<option value="${escapeHtml(String(x.id))}">${escapeHtml(x.name)}</option>`).join("");
  $("#businessList").innerHTML=found.length?found.map(x=>`<article class="business-card"><div class="meta">PITCH BUSINESS</div><h3>${escapeHtml(x.name)}</h3><p>${escapeHtml([x.category,x.location,x.stage||x.pipeline_stage].filter(Boolean).join(" · "))}</p></article>`).join(""):'<div class="empty">Bonnie doesn’t know anyone yet.<br><br>Connect PITCH data by configuring the table mapping in <code>app.js</code>.</div>';
}
async function loadMemory(){
  const {data,error}=await db.from("bonnie_memory").select("*").order("updated_at",{ascending:false}).limit(100);
  state.memory=data||[];
  $("#memoryList").innerHTML=state.memory.length?state.memory.map(m=>`<article class="list-item"><div class="meta">${escapeHtml(m.memory_type||"MEMORY")} · ${new Date(m.updated_at||m.created_at).toLocaleDateString()}</div><p>${escapeHtml(m.content||"")}</p></article>`).join(""):'<div class="empty">Nothing here yet. Bonnie will only save useful, durable context.</div>';
}
async function loadConversations(){
  const {data}=await db.from("bonnie_conversations").select("*").order("updated_at",{ascending:false}).limit(50);
  $("#conversationList").innerHTML=data?.length?data.map(c=>`<article class="list-item" data-id="${c.id}"><div class="meta">${escapeHtml(c.mode||"CONVERSATION")} · ${new Date(c.updated_at||c.created_at).toLocaleString()}</div><h3>${escapeHtml(c.title||"Untitled thought")}</h3><p>${escapeHtml(c.business_name||"Everything")}</p></article>`).join(""):'<div class="empty">Nothing here yet.</div>';
  $$("#conversationList .list-item").forEach(e=>e.onclick=()=>openConversation(e.dataset.id));
}
async function openConversation(id){
  const c=(await db.from("bonnie_conversations").select("*").eq("id",id).single()).data;if(!c)return;
  const m=(await db.from("bonnie_messages").select("*").eq("conversation_id",id).order("created_at")).data||[];
  state.conversation=c;state.messages=m;showView("home");renderMessages();
}
function renderMessages(){
  const box=$("#messages");box.innerHTML=state.messages.length?state.messages.map(m=>`<div class="message ${m.role==="user"?"user":"assistant"}"><div class="bubble"><div class="role">${m.role==="user"?"YOU":"BONNIE"}</div><div class="content">${m.role==="assistant"?md(m.content):escapeHtml(m.content)}</div></div></div>`).join(""):'<div class="welcome-message"><span class="orb">B</span><div><strong>Bonnie</strong><p>I’m here. Tell me what you’re dealing with.</p></div></div>';
  box.scrollTop=box.scrollHeight;
}
function selectedRaw(){return state.businesses.find(x=>String(x.id)===$("#businessSelect").value)?.raw||null}
async function relevantContext(){
  const business=selectedRaw();
  let context={business, memory:state.memory.slice(0,30), recent_messages:state.messages.slice(-12)};
  // Add only the selected PITCH record; do not bulk-dump the database.
  return context;
}
async function saveConversation(userText,answer,mode){
  const user=await getUser(); if(!user)return null;
  if(!state.conversation){
    const {data,error}=await db.from("bonnie_conversations").insert({user_id:user.id,title:userText.slice(0,90),mode,business_id:$("#businessSelect").value||null,business_name:state.selectedBusiness?.name||null}).select().single();
    if(error)throw error; state.conversation=data;
  }else await db.from("bonnie_conversations").update({mode,updated_at:new Date().toISOString()}).eq("id",state.conversation.id);
  const rows=[{conversation_id:state.conversation.id,user_id:user.id,role:"user",content:userText},{conversation_id:state.conversation.id,user_id:user.id,role:"assistant",content:answer}];
  const r=await db.from("bonnie_messages").insert(rows);if(r.error)throw r.error;
}
async function callBonnie(userText,mode){
  const user=await getUser();
  const payload={message:userText,mode,business:await relevantContext(),conversation:state.messages.slice(-12)};
  const r=await fetch(CONFIG.supabaseUrl+"/functions/v1/bonnie-ai",{method:"POST",headers:{"Content-Type":"application/json","apikey":CONFIG.supabaseKey,Authorization:`Bearer ${CONFIG.supabaseKey}`},body:JSON.stringify(payload)});
  const body=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(body.error||"AI request failed");
  return body.answer;
}
async function send(text,mode="chat"){
  if(state.busy||!text.trim())return;state.busy=true;$("#sendBtn").disabled=true;
  state.messages.push({role:"user",content:text});renderMessages();
  try{const answer=await callBonnie(text,mode);state.messages.push({role:"assistant",content:answer});renderMessages();await saveConversation(text,answer,mode);await maybeExtractMemory(text,answer);loadConversations();loadMemory()}
  catch(e){console.error(e);toast(e.message.includes("429")?"Bonnie is temporarily rate-limited. Please try again shortly.":"I couldn't reach Bonnie's reasoning layer. Your draft is safe.");}
  finally{state.busy=false;$("#sendBtn").disabled=false}
}
async function maybeExtractMemory(userText,answer){
  // Lightweight deterministic filter. The secure AI function can be extended later.
  const combined=(userText+" "+answer).toLowerCase();
  const signal=/decided|decision|next step|objection|they said|prospect|follow up|follow-up|budget|unhappy|interested/.test(combined);
  if(!signal)return;
  const user=await getUser();if(!user)return;
  const content=userText.length>500?userText.slice(0,500):userText;
  await db.from("bonnie_memory").insert({user_id:user.id,business_id:$("#businessSelect").value||null,memory_type:"conversation_signal",content,source:"bonnie"});
}
$("#composer").onsubmit=e=>{e.preventDefault();const t=$("#prompt").value;$("#prompt").value="";send(t)}
$("#prompt").addEventListener("input",e=>{e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,160)+"px"});
$$(".quick-actions button").forEach(b=>b.onclick=()=>{const prompts={move:"What's my strongest next move here?",brief:"Brief me for the next conversation with this business.",challenge:"Challenge this: ",investigate:"Investigate this situation and tell me exactly what we still need to find out.",read:"Read the situation.",decide:"Help me decide what to do.",pitch:"Prepare my pitch for this business."};$("#prompt").value=prompts[b.dataset.mode];$("#prompt").focus();if(b.dataset.mode!=="challenge")send(prompts[b.dataset.mode],b.dataset.mode)});
$$(".nav-item").forEach(b=>b.onclick=()=>showView(b.dataset.view));
$("#newChat").onclick=()=>{state.conversation=null;state.messages=[];renderMessages();showView("home")}
$("#menuBtn").onclick=()=>$("#sidebar").classList.toggle("open");
$("#refreshConvos").onclick=loadConversations;
$("#checkAI").onclick=checkAI;
$("#businessSelect").onchange=()=>{state.selectedBusiness=state.businesses.find(x=>String(x.id)==$("#businessSelect").value)||null}
(async function init(){
  try{const u=await getUser();setConnection(!!u,u?"Supabase connected":"Supabase reachable — sign-in not configured");await loadBusinesses();await loadMemory();await loadConversations();checkAI()}
  catch(e){console.error(e);setConnection(false,"Connection needs attention")}
})();
