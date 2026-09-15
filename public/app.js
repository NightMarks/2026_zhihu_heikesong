/* ══════════════════════════════════════════════════════════════
   沙游心语 · 前端主逻辑
   ── 知乎接入说明 ─────────────────────────────────────────────
   ✓ 真实可用：OAuth 登录、站内搜索、热榜、直答、读本人创作
   ✗ 平台不提供：赞同/反对/评论/分享/发想法的写入接口
     → 这些互动通过「跳转知乎站内完成 + 回链校验归属」实现，
       而不是伪造一个假的 API 调用。
   ══════════════════════════════════════════════════════════════ */

/* ========== 沙具体系 ========== */
const CATEGORIES = [
  {
    id:'people', name:'人物类', icon:'🧑',
    desc:'每一个小人，都可能是你心里的某个角色。',
    query:'人际关系中扮演别人期待的角色 真实自我',
    // 查询词池：每次进入该类随机抽取若干个并发检索，凑够 20 条不重复内容。
    // 单个知乎搜索接口一次最多 10 条，所以多词是拿到 20 条的必要手段。
    queries:[
      '人际关系中扮演别人期待的角色 真实自我',
      '讨好型人格 如何建立边界感',
      '自我接纳 与自己和解',
      '人格面具 荣格 真实的自己',
      '如何面对他人的评价 内核稳定',
      '原生家庭 如何影响一个人的性格',
    ],
    toys:[
      {id:'child',name:'抱膝微光童',emoji:'👶',meaning:'投射创伤经历、极度缺乏安全感与脆弱'},
      {id:'student',name:'学生',emoji:'🧑‍🎓',meaning:'学习、成长、对未来既期待又不安的阶段。'},
      {id:'worker',name:'工人',emoji:'👷',meaning:'劳作、责任、用双手支撑生活的力量。'},
      {id:'doctor',name:'医生',emoji:'🧑‍⚕️',meaning:'疗愈的愿望，或希望"被照顾、被修好"的部分。'},
      {id:'police',name:'警察',emoji:'👮',meaning:'秩序、规则与保护，也可能是约束感的来源。'},
      {id:'elder',name:'老人',emoji:'🧓',meaning:'经验、智慧与时间，家族记忆的携带者。'},
      {id:'mystery',name:'神秘人',emoji:'🧙',meaning:'尚未看清的自己、潜意识里的未知力量。'}
    ]
  },
  {
    id:'animal', name:'动物类', icon:'🐾',
    desc:'动物常代表尚未被语言驯服的那部分自己：本能、依恋与野性。',
    query:'人为什么会从动物身上得到治愈',
    queries:[
      '人为什么会从动物身上得到治愈',
      '养宠物 陪伴 孤独感',
      '本能 直觉 要不要相信自己的第一感觉',
      '依恋关系 安全感 亲密',
      '野性 自由 不被驯服',
      '与自然相处 动物给人的启发',
    ],
    toys:[
      {id:'cat',name:'猫',emoji:'🐱',meaning:'保持距离的亲近：想靠近，又要守住自己的领地。'},
      {id:'dog',name:'狗',emoji:'🐶',meaning:'忠诚、依恋与无条件的接纳，也可能是讨好的一面。'},
      {id:'bird',name:'鸟',emoji:'🐦',meaning:'自由、离开的渴望，或俯瞰全局的视角。'},
      {id:'fish',name:'鱼',emoji:'🐟',meaning:'潜意识深处的流动，情绪与感受的领域。'},
      {id:'horse',name:'马',emoji:'🐴',meaning:'被驾驭的力量与热情，前进的动力。'},
      {id:'turtle',name:'乌龟',emoji:'🐢',meaning:'缓慢而稳妥的节奏，需要时可以缩回壳里。'},
      {id:'butterfly',name:'蝴蝶',emoji:'🦋',meaning:'蜕变与转化，破茧之后的轻盈。'}
    ]
  },
  {
    id:'building', name:'建筑类', icon:'🏠',
    desc:'房子是内心结构最经典的象征：你在住什么样的"心"？',
    query:'什么样的地方才算是家 归属感',
    queries:[
      '什么样的地方才算是家 归属感',
      '租房和买房 哪里才算安定下来',
      '一个人住 独居的感受',
      '故乡 回不去的地方',
      '理想的居住空间 什么样的房子让人放松',
      '安全感 来自哪里',
    ],
    toys:[
      {id:'thatch',name:'草房',emoji:'🛖',meaning:'简朴、自然、与土地的亲近，也可能是暂时的庇护。'},
      {id:'stone',name:'石头房',emoji:'🪨',meaning:'坚固、防御、经得起风雨的内在结构。'},
      {id:'cabin',name:'小木屋',emoji:'🏠',meaning:'温暖、质朴的归属感，想要"回到"的地方。'},
      {id:'flat',name:'公寓',emoji:'🏢',meaning:'日常、秩序与现实的居住状态。'},
      {id:'tower',name:'高楼大厦',emoji:'🏙️',meaning:'抱负、社会成就，或疏离感。'},
      {id:'ruin',name:'废墟',emoji:'🏚️',meaning:'结束、损耗，或等待被重建的旧有模式。'},
      {id:'castle',name:'城堡',emoji:'🏰',meaning:'理想、保护与边界，也可能是一层华丽的外壳。'}
    ]
  },
  {
    id:'nature', name:'自然类', icon:'🌳',
    desc:'山川草木是内心风景的底色，也是最能承接情绪的部分。',
    query:'为什么亲近自然会让人平静下来',
    queries:[
      '为什么亲近自然会让人平静下来',
      '看海 爬山 旅行 治愈',
      '四季更替 生命的节奏',
      '内心的平静 如何获得',
      '扎根 成长 需要时间',
      '天气 季节 如何影响心情',
    ],
    toys:[
      {id:'tree',name:'树',emoji:'🌳',meaning:'扎根与生长，连接大地与天空的稳定力量。'},
      {id:'flower',name:'花',emoji:'🌸',meaning:'绽放的时刻，美好而短暂的部分自己。'},
      {id:'mountain',name:'山',emoji:'⛰️',meaning:'需要翻越的障碍，也是可以依靠的屏障。'},
      {id:'water',name:'水',emoji:'🌊',meaning:'情绪的流动，柔软却有力量。'},
      {id:'sun',name:'太阳',emoji:'☀️',meaning:'意识、温暖与希望的来源。'},
      {id:'moon',name:'月亮',emoji:'🌙',meaning:'潜意识、阴柔面与夜晚的思绪。'},
      {id:'rock',name:'石头',emoji:'🪨',meaning:'沉默的坚持，不轻易改变的内核。'}
    ]
  },
  {
    id:'traffic', name:'交通类', icon:'🚗',
    desc:'移动的方式，往往就是你现在"前进"的方式。',
    query:'要不要离开现在的城市重新开始',
    queries:[
      '要不要离开现在的城市重新开始',
      '裸辞之后 人生的过渡期',
      '想去远方 旅行的意义',
      '人生方向 迷茫期怎么办',
      '换一条赛道 重新开始来得及吗',
      '按自己的节奏生活',
    ],
    toys:[
      {id:'bike',name:'自行车',emoji:'🚲',meaning:'依靠自己力量的前进，节奏由自己掌握。'},
      {id:'car',name:'汽车',emoji:'🚗',meaning:'自主与掌控，人生道路的驾驶感。'},
      {id:'train',name:'火车',emoji:'🚂',meaning:'既定的轨道、集体的节奏，按部就班的旅程。'},
      {id:'boat',name:'船',emoji:'⛵',meaning:'渡越、过渡期，从一个状态驶向另一个状态。'},
      {id:'plane',name:'飞机',emoji:'✈️',meaning:'超越、远大的目标，快速脱离当前处境的渴望。'}
    ]
  },
  {
    id:'symbol', name:'象征类', icon:'🗝️',
    desc:'钥匙、门、桥、镜子——沙盘游戏里最意味深长的一类。',
    query:'如何修复一段疏远的关系',
    queries:[
      '如何修复一段疏远的关系',
      '过渡期 空窗期 是什么体验',
      '和解 放下过去',
      '自我觉察 认识自己的方式',
      '人生的转折点 做选择',
      '亲密关系里的边界',
    ],
    toys:[
      {id:'key',name:'钥匙',emoji:'🗝️',meaning:'解决之道、新的可能性，等待开启的资源。'},
      {id:'door',name:'门',emoji:'🚪',meaning:'边界与选择：两个阶段之间的出入口。'},
      {id:'bridge',name:'桥',emoji:'🌉',meaning:'连接与过渡，把分离的两端重新连起来。'},
      {id:'mirror',name:'镜子',emoji:'🪞',meaning:'自我审视、觉察，看见真实自己的机会。'}
    ]
  },
  {
    id:'fantasy', name:'幻想类', icon:'🔮',
    desc:'童话与神话里的角色，承载着愿望、恐惧和说不出口的期待。',
    query:'成年人为什么还需要童话和幻想',
    queries:[
      '成年人为什么还需要童话和幻想',
      '白日梦 想象力 有什么意义',
      '英雄之旅 神话 原型',
      '如果有一个愿望 你会许什么',
      '逃避现实 还是自我保护',
      '童年 幻想 长大后失去了什么',
    ],
    toys:[
      {id:'fairy',name:'精灵',emoji:'🧚',meaning:'灵感与轻盈的想象，心里尚存的天真。'},
      {id:'unicorn',name:'独角兽',emoji:'🦄',meaning:'纯粹而稀有的愿望，不愿妥协的理想。'},
      {id:'wizard',name:'巫师',emoji:'🧙‍♂️',meaning:'转化的能力，相信事情可以变得不同。'},
      {id:'crystal',name:'水晶球',emoji:'🔮',meaning:'对未来的探问，想要预知与掌控的心情。'},
      {id:'star',name:'星星',emoji:'⭐',meaning:'指引方向的远景，也可能遥不可及。'},
      {id:'rainbow',name:'彩虹',emoji:'🌈',meaning:'风雨之后的希望，短暂却被记住的美好。'}
    ]
  },
  {
    id:'monster', name:'武器 / 怪兽类', icon:'🐉',
    desc:'冲突与力量并不可怕，它们常常是改变的先兆。',
    query:'长期的焦虑是怎么产生的 如何与情绪相处',
    queries:[
      '长期的焦虑是怎么产生的 如何与情绪相处',
      '内耗 怎么停止胡思乱想',
      '愤怒 情绪管理 如何表达',
      '恐惧 害怕失败 怎么面对',
      '压力太大 如何自我调节',
      '完美主义 对自己太苛刻',
    ],
    toys:[
      {id:'sword',name:'剑',emoji:'⚔️',meaning:'力量、决断，直面冲突的勇气或攻击性。'},
      {id:'shield',name:'盾',emoji:'🛡️',meaning:'自我保护、边界感，温柔而坚定的防御。'},
      {id:'dragon',name:'龙',emoji:'🐲',meaning:'巨大的、未被驯服的能量——恐惧，或潜能。'},
      {id:'beast',name:'怪兽',emoji:'👹',meaning:'被具象化的困扰；一旦被看见，就会缩小。'}
    ]
  }
];

/* 用户提供的实体沙具素材；emoji 只保留为图片加载失败时的文字语义。 */
const TOY_IMAGES={
  child:'/images/human/c2ce9c9043aa34923de4aae306af4a9b.webp',student:'/images/human/4ed59ecd8d0985ed1e92d233d0a64a51.webp',
  worker:'/images/human/a8883bc92c6a5ea1fe565a64be744a24.webp',doctor:'/images/human/02e0dcad2ca3696e4b98c8d8952020f8.webp',
  police:'/images/human/d1d3e66c2b9ed8caa805f5d7c7f5e768.webp',elder:'/images/human/227d793dfe8a7dbf81141378725f7929.webp',
  mystery:'/images/human/31188389f933efb9649502f437b3807f.webp',cat:'/images/animals/c6b8b59a57f5bf254c4f566befd54dc4.webp',
  dog:'/images/animals/80abfc4ab325cbe0e36e402b5d75bed4.webp',bird:'/images/animals/9ce5f4dd8b36c54b9cea4719c95b33bf.webp',
  fish:'/images/animals/4c6c5a9d546332349976c2f68f80782f.webp',horse:'/images/animals/51c2103c2d602144e2bf8d9d6852a9a5.webp',
  turtle:'/images/animals/f2cee562912600c9feaabd41f88f7840.webp',butterfly:'/images/animals/e7ad2e21f2ad7f56525b6269f23e0c5b.webp',
  thatch:'/images/buildings/858a519cdffdb913bd2cb4dc85726539.webp',stone:'/images/buildings/b922360754097bba52c523ecb8a54229.webp',
  cabin:'/images/buildings/04379daf871f13a84e249e66453f01ea.webp',flat:'/images/buildings/f17fcf4b8049920245ddf14d5af1c091.webp',
  tower:'/images/buildings/0fd9757ca3b0013e56bf78c5b4a5a02b.webp',ruin:'/images/buildings/91252af5667e803307304308cf85aab3.webp',
  castle:'/images/buildings/534cc6aa6fa5e687b65926cbcaa4c842.webp',tree:'/images/nature/e8efc7b750b6609f1727efdd3be9cab9.webp',
  flower:'/images/nature/dc7bf3689f32daf5b4ad6b01be4bfcda.webp',mountain:'/images/nature/61661e4c63c5e19fda84ddcac7f37239.webp',
  water:'/images/nature/570b3ae13416b5d709717ef245bf7e9e.webp',sun:'/images/nature/ba07e23bc19003963020d22cbee9fd30.webp',
  moon:'/images/nature/0976c1b9632cdae4467cac5648e273e6.webp',rock:'/images/nature/973bd06e24a808bfe23ebd02a5a193a3.webp',
  bike:'/images/transport/9ab477d608d85fb573bc38a9baeccb1b.webp',car:'/images/transport/978a465d4b3f872b57f93d5d558c96aa.webp',
  train:'/images/transport/dc873b8d457c8ae3146bcadea7678d93.webp',boat:'/images/transport/844cc9e71bd3ff88d463b57f9fc151ef.webp',
  plane:'/images/transport/f0f9afa0cb8b6e084b110987018ca546.webp',key:'/images/Symbol/8e081d0dffecc9d9535748dffdece301.webp',
  door:'/images/buildings/3666164c83f0a7da41c6adee494974ed.webp',bridge:'/images/buildings/fa78593fd9ac71f57c2825f8c7adf2ab.webp',
  mirror:'/images/Symbol/1912ba306bc34b519256d2d845371d30.webp',fairy:'/images/fantasy/936c50f5a292fa869d0ed0653f244901.webp',
  unicorn:'/images/fantasy/05aed826ad5f5f8a446d3f0ea27e0d34.webp',wizard:'/images/fantasy/c75a0e06803548c9c57a9242311be90f.webp',
  crystal:'/images/fantasy/b688a3ccfb056574cc2fc0d5388fef35.webp',star:'/images/fantasy/c34c3daab90de619711af1ce886d5359.webp',
  rainbow:'/images/fantasy/954db4511233bb8f3a51c5532601f673.webp',sword:'/images/attackandmonster/94d8c2876ccb653f144ce85abaec2bac.webp',
  shield:'/images/attackandmonster/265f9e67af041da6ccf0e4ebd1549e6c.webp',dragon:'/images/fantasy/d5f55647155cbe808e6bcf2dda0dfa51.webp',
  beast:'/images/attackandmonster/bdee96bae33e8fa4730e4d3e99005b20.webp',
};
CATEGORIES.forEach(category=>category.toys.forEach(toy=>{toy.image=TOY_IMAGES[toy.id]}));

const OPEN_QUESTIONS = {
  people:['沙盘里的这些"人"之间，是什么关系？谁离你最近？','如果有一个角色代表此刻的你，你觉得是哪一个？','有没有谁被你放在了角落？那是TA想要的位置吗？'],
  animal:['这些动物里，哪一只最像现在的你？','它们是靠近人群的，还是独自待着？','如果它们能开口，最想对你说什么？'],
  building:['这些建筑里，哪一栋最像你现在的状态？','如果把沙盘看作你的内心世界，"门"是开着的吗？','有没有什么地方，是这些"人"可以随时回去的？'],
  nature:['沙盘里的自然物，是背景还是主角？','如果要在这片风景里待上一天，你会待在哪里？','有没有哪一样东西，是你希望更多一些的？'],
  traffic:['交通工具们正朝向哪个方向？那是你想去的方向吗？','现在的你，更像是"赶路"还是"在路上散步"？','如果可以换乘任意一种交通工具，你会换成哪个？'],
  symbol:['钥匙对应的那扇门，找到了吗？','沙盘里有没有"连接不够"的地方，需要一座桥？','镜子照见了什么——那是意外，还是意料之中？'],
  fantasy:['这些幻想角色，是来帮忙的，还是来提醒什么的？','如果可以实现一个愿望，你会放在沙盘的哪个位置？','它们和现实里的沙具，相处得怎么样？'],
  monster:['武器是在保护什么？','那头怪兽，如果可以对话，它想说什么？','力量放在哪个位置，你会更安心？']
};
const ATMOS = {
  warm:'整体氛围偏温暖安定，人物与建筑占据了主要位置，像是内心正在寻找或已经找到了一处可以安放自己的地方。',
  tense:'画面中出现了明显的张力——武器与怪兽的存在提示着某些尚未化解的冲突或压力，它们值得被看见，而不是被推开。',
  transition:'象征类沙具（钥匙、门、桥、镜子）的密度较高，暗示你正处在一段"过渡期"：旧阶段正在收尾，新阶段尚未完全展开。',
  sparse:'沙具数量不多，摆放也较为舒展，留白本身就是一种表达——也许此刻的你需要的不多，一些空间和一些安静。',
  rich:'沙具丰富、排布紧凑，画面充满生机与细节，提示内心有很多正在酝酿的东西，值得慢慢梳理。'
};

/* ========== 状态 ========== */
let CAP={contentApi:false,oauth:false,loggedIn:false,user:null,aiReport:false,aiModel:null};
let POSTS={};              // catId -> 知乎内容数组（运行时从 API 拉取）
let state=ShaYuState.load(CATEGORIES);
function save(){ShaYuState.save(state)}

/* ========== 工具 ========== */
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const catOf=tid=>CATEGORIES.find(c=>c.toys.some(t=>t.id===tid));
const toyOf=tid=>{for(const c of CATEGORIES){const t=c.toys.find(t=>t.id===tid);if(t)return t}return null};
const toyNamed=name=>CATEGORIES.flatMap(c=>c.toys).find(t=>t.name===name);
const inspTotal=()=>Object.values(state.insp).reduce((a,b)=>a+b,0);
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('show'),2600)}
function closeModal(id){$('#'+id).classList.remove('open')}
function fmtTime(ts){const d=Date.now()-ts;if(d<60e3)return'刚刚';if(d<3600e3)return Math.floor(d/60e3)+' 分钟前';if(d<86400e3)return Math.floor(d/3600e3)+' 小时前';return Math.floor(d/86400e3)+' 天前'}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function formatAiReport(text){
  return String(text||'').split(/\r?\n/).map(line=>{
    const heading=line.match(/^##\s+(.*)$/);
    if(heading)return `<h3>${escapeHtml(heading[1])}</h3>`;
    const bullet=line.match(/^[-*]\s+(.*)$/);
    if(bullet)return `<p class="ai-report-bullet">${escapeHtml(bullet[1])}</p>`;
    return line.trim()?`<p>${escapeHtml(line)}</p>`:'';
  }).join('');
}
function toyAssetHTML(toy,className='toy-asset'){
  return `<img class="${className}" src="${toy.image}" alt="${escapeHtml(toy.name)}" loading="lazy" draggable="false">`;
}
function reportSymbolHTML(symbol){
  const src=symbol.image||toyNamed(symbol.name)?.image;
  return src?`<img src="${src}" alt="${escapeHtml(symbol.name)}">`:`<span>${symbol.emoji||'◆'}</span>`;
}
const ANON_NAME='一位旅人';
let ME='旅人No.7';

/* ══════════════════ 知乎接入层 ══════════════════ */

/** 启动时探测服务端能力：哪些是真的，哪些没配 */
async function probeCapabilities(){
  try{
    CAP=await ShaYuApi.capabilities();
    if(CAP.user?.nick) ME=CAP.user.nick;
  }catch(e){ /* 离线模式 */ }
  renderAuth(); renderCapBar(); updateJourneyGate();
}

function renderAuth(){
  const el=$('#auth-slot');
  if(CAP.loggedIn&&CAP.user){
    const u=CAP.user;
    const nick=u.nick||'知乎用户';
    // 有真实头像就用真实头像，取不到时降级为昵称首字，不放假图
    const av=u.avatar
      ? `<img class="av" src="${escapeHtml(u.avatar)}" alt="${escapeHtml(nick)}的头像"
             referrerpolicy="no-referrer" loading="lazy"
             onerror="this.outerHTML='<div class=\\'av\\'>${escapeHtml(nick[0]||'知')}</div>'">`
      : `<div class="av">${escapeHtml(nick[0]||'知')}</div>`;
    el.innerHTML=`<div class="user-chip" title="${escapeHtml(u.headline||nick)}">
      <button class="user-entry" onclick="openUserCenter()" aria-label="打开 ${escapeHtml(nick)} 的用户中心">
        ${av}
        <span class="nm" title="${escapeHtml(nick)}">${escapeHtml(nick)}</span>
      </button>
      <button class="out" onclick="logout()">退出</button></div>`;
  }else{
    // 登录入口只出现在旅程门禁中；右上角仅用于展示已登录身份。
    el.innerHTML='';
  }
}

function updateJourneyGate(){
  const button=$('#start-journey');
  const note=$('#journey-auth-note');
  if(!button||!note)return;
  button.disabled=false;
  if(CAP.loggedIn){
    button.textContent='进入我的沙盘世界 →';
    note.textContent=`已登录为 ${CAP.user?.nick||'知乎用户'}，可以开始探索。`;
  }else if(CAP.oauthReady){
    button.textContent='登录知乎并开始旅程 →';
    note.textContent='需要先完成知乎 OAuth 登录。若知乎提示网络环境异常，请关闭代理并先在同一浏览器登录知乎。';
  }else{
    button.textContent='当前环境暂时无法登录';
    button.disabled=true;
    note.textContent=CAP.oauth?'当前回调地址不是公网 HTTPS，请检查部署配置。':'服务端尚未配置知乎 OAuth。';
  }
}

function startJourney(){
  if(CAP.loggedIn){
    $('#onboard').classList.remove('open');
    enterGame();
    return;
  }
  if(CAP.oauthReady){
    const returnTo=`${location.pathname}${location.search}`;
    location.assign(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
}

function renderCapBar(){
  const srcLabel = CAP.sourceType==='api' ? '已接入（直连 API）'
                 : CAP.sourceType==='cli' ? '已接入（本地授权 CLI）'
                 : '未配置（用示例数据）';
  const idLabel = CAP.loggedIn ? '已登录'
                : CAP.oauthReady ? '可登录'
                : CAP.oauth ? '待部署后可登录'
                : CAP.sourceType==='cli' ? '本机凭证身份'
                : '未配置 OAuth';
  const items=[
    {on:CAP.contentApi, label:'知乎内容', v:srcLabel},
    // 凭证齐备但回调不可达时算"部分可用"，不标成绿色 on，避免虚假承诺
    {on:CAP.loggedIn||CAP.oauthReady||CAP.sourceType==='cli', label:'账号身份', v:idLabel},
    {on:CAP.aiReport, label:'AI 解读', v:CAP.aiReport?(CAP.aiModel||'已配置'):'本地规则兜底'},
  ];
  $('#cap-bar').innerHTML=`<div class="cap-bar">${items.map(i=>
    `<div class="cap-item ${i.no?'no':(i.on?'on':'off')}">
       <span class="dot"></span><b>${i.label}</b>：${i.v}</div>`).join('')}</div>`;
}

async function logout(){
  // 网络异常不应阻断本地登出，因此不让 fetch 的失败冒泡
  try{ await ShaYuApi.logout(); }
  catch(e){ /* 离线或服务端不可达：仍然清掉本地登录态 */ }
  CAP.loggedIn=false;CAP.user=null;ME='旅人No.7';
  if($('#view-user')?.classList.contains('active')) switchView('explore');
  renderAuth();renderCapBar();updateJourneyGate();
  $('#onboard').classList.add('open');
  toast('已退出知乎登录');
}

function openUserCenter(){
  ShaYuUserCenter.open();
}

window.addEventListener('shayu:unauthorized',()=>{
  CAP.loggedIn=false;CAP.user=null;gameEntered=false;
  renderAuth();renderCapBar();updateJourneyGate();
  $('#onboard').classList.add('open');
});

/** 从数组里随机抽 n 个（不改原数组） */
function pickRandom(arr,n){
  return [...arr].sort(()=>Math.random()-.5).slice(0,n);
}

/** 目标展示条数 */
const FEED_SIZE=20;

/**
 * 拉取某一大类的知乎内容
 * ─────────────────────────────────────────────────────────
 * 知乎搜索接口单次 Count 上限 10 条，想要 20 条必须多查询词并发。
 * 每次调用都随机抽取查询词并重新请求，因此反复点同一大类会出现不同帖子。
 * force=false 时若已有缓存则直接复用（用于返回已看过的分类，避免闪烁）。
 */
async function loadPosts(catId,force=false){
  if(!force&&POSTS[catId]?.length)return POSTS[catId];
  const cat=CATEGORIES.find(c=>c.id===catId);
  if(!CAP.contentApi){ POSTS[catId]=expandFallback(catId); return POSTS[catId]; }

  const pool=cat.queries?.length?cat.queries:[cat.query];
  // 抽 3 个词 × 10 条 = 最多 30 条原始结果，去重后通常能稳定超过 20
  const picked=pickRandom(pool,Math.min(3,pool.length));
  try{
    const results=await Promise.all(picked.map(q=>
      fetch(`/api/search?q=${encodeURIComponent(q)}&n=10`)
        .then(r=>r.json())
        .catch(()=>({items:[]}))
    ));
    // 按 URL 去重：同一问题下的不同回答 URL 不同，但转载/重复条目会被滤掉
    const seen=new Map();
    for(const d of results){
      for(const x of (d.items||[])){
        if(x.title&&x.url&&!seen.has(x.url)) seen.set(x.url,x);
      }
    }
    let list=[...seen.values()];
    // 打乱顺序，避免每次都是同一个查询词的结果排在最前
    list=list.sort(()=>Math.random()-.5).slice(0,FEED_SIZE);
    POSTS[catId]=list.length?list:expandFallback(catId);
  }catch(e){ POSTS[catId]=expandFallback(catId); }
  return POSTS[catId];
}

/** 离线兜底：示例数据只有 1 条，随机化后原样返回，不复制成假的 20 条 */
function expandFallback(catId){
  return [...(FALLBACK[catId]||[])].sort(()=>Math.random()-.5);
}

/* 离线兜底内容（服务端没配 Secret 时用） */
const FALLBACK={
  people:[{title:'为什么我们总在人际关系里扮演"别人期待的角色"？',author:'心流实验室',excerpt:'从人格面具聊到真实自我。小时候我们是父母眼中的乖孩子，长大后是同事眼里的靠谱伙伴……那个不加修饰的自己，去哪了？',url:'https://www.zhihu.com/search?q=%E4%BA%BA%E6%A0%BC%E9%9D%A2%E5%85%B7',votes:2381,comments:326,hotComments:[]}],
  building:[{title:'什么样的地方才算是家？',author:'凿户牖',excerpt:'有人想要一整面墙的书架，有人只想有一间能晒到下午四点太阳的屋子。',url:'https://www.zhihu.com/search?q=%E5%AE%B6%E7%9A%84%E6%84%8F%E4%B9%89',votes:5230,comments:766,hotComments:[]}],
  animal:[{title:'人为什么会从动物身上得到治愈？',author:'共栖笔记',excerpt:'它不评价你今天的表现，也不追问你的规划。这种无条件的在场，恰恰是人际关系里最稀缺的东西。',url:'https://www.zhihu.com/search?q=%E5%8A%A8%E7%89%A9%E6%B2%BB%E6%84%88',votes:4120,comments:538,hotComments:[]}],
  nature:[{title:'为什么亲近自然会让人平静下来？',author:'林间信',excerpt:'山不会催你，海也不会。在一个不以效率衡量你的地方待一会儿，紧绷的那根弦会自己松下来。',url:'https://www.zhihu.com/search?q=%E8%87%AA%E7%84%B6%E6%B2%BB%E6%84%88',votes:6890,comments:812,hotComments:[]}],
  fantasy:[{title:'成年人为什么还需要童话和幻想？',author:'造梦局',excerpt:'幻想不是逃避，而是给那些在现实里无处安放的愿望，先找一个暂时的容身之处。',url:'https://www.zhihu.com/search?q=%E6%88%90%E5%B9%B4%E4%BA%BA%E7%AB%A5%E8%AF%9D',votes:3760,comments:449,hotComments:[]}],
  traffic:[{title:'如果可以立刻出发去任何地方，你会去哪？',author:'远方信号站',excerpt:'不是旅行攻略，是心里那个"想去"的念头。它可能在提示你缺什么。',url:'https://www.zhihu.com/search?q=%E8%BF%9C%E6%96%B9',votes:9834,comments:1237,hotComments:[]}],
  symbol:[{title:'"过渡期"是一种什么样的体验？',author:'桥上的人',excerpt:'辞职后的空窗、毕业后的迷茫、分手后的适应……桥的这头已经离开，那头还没到达。',url:'https://www.zhihu.com/search?q=%E8%BF%87%E6%B8%A1%E6%9C%9F',votes:5660,comments:742,hotComments:[]}],
  monster:[{title:'如果内心的恐惧是一只怪兽，它长什么样？',author:'怪物研究所',excerpt:'deadline 怪兽、社交怪兽、体检报告怪兽……把它画出来、说出来，它就小了一号。',url:'https://www.zhihu.com/search?q=%E6%81%90%E6%83%A7',votes:8413,comments:1129,hotComments:[]}]
};

/* ══════════════════ 导航 ══════════════════ */
$('#nav').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  switchView(b.dataset.view);
});
function switchView(name){
  if(!CAP.loggedIn){$('#onboard').classList.add('open');return}
  $$('#nav button').forEach(x=>x.classList.toggle('active',x.dataset.view===name));
  $$('.view').forEach(v=>v.classList.remove('active'));
  $('#view-'+name).classList.add('active');
  if(name==='community')ShaYuCommunity.open();
  if(name==='tray'){renderLibrary();renderSandbox()}
  if(name==='report') state.report?renderReport():(state.tray.length?generateReport():renderReport());
}

/* ══════════════════ 随机沙具开场 ══════════════════ */
let randomPool=[];
function shuffleRandom(){
  const all=CATEGORIES.flatMap(c=>c.toys.map(t=>({...t,cat:c})));
  randomPool=all.sort(()=>Math.random()-.5).slice(0,10);
  renderRandom();
}
function renderRandom(){
  $('#random-grid').innerHTML=randomPool.map(t=>{
    const owned=state.unlocked[t.id];
    return `<div class="toy-card ${owned?'owned':''}" onclick="gotoCategory('${t.cat.id}','${t.id}')">
      ${toyAssetHTML(t,'emoji toy-asset')}
      <div class="name">${t.name}</div>
      <div class="cat">${t.cat.icon} ${t.cat.name} · ${owned?'已解锁':'去知乎解锁'}</div>
    </div>`;
  }).join('');
}
async function gotoCategory(catId,highlightToy){
  switchView('explore');
  // 用户每次点击大类都强制换一批内容（首屏由 init 直接调 renderZhihuFeed，不走这里）
  curCat=catId;
  renderCatTabs(catId);
  await renderZhihuFeed(catId,true);
  renderUnlockPanel(catId);
  if(highlightToy){
    setTimeout(()=>{
      const el=document.querySelector(`#unlock-panel [data-toy="${highlightToy}"]`);
      if(el){el.scrollIntoView({block:'center',behavior:'smooth'});el.style.background='#fdf0e3';setTimeout(()=>el.style.background='',1500)}
    },120);
  }
  document.querySelector('.cat-tabs').scrollIntoView({behavior:'smooth',block:'start'});
}

/* ══════════════════ 分类与知乎内容 ══════════════════ */
let curCat=CATEGORIES[0].id;
function renderCatTabs(active){
  curCat=active||curCat;
  $('#cat-tabs').innerHTML=CATEGORIES.map(c=>`
    <button class="${c.id===curCat?'active':''}" onclick="gotoCategory('${c.id}')">
      ${c.icon} ${c.name}<span class="insp">💡${state.insp[c.id]}</span>
    </button>`).join('');
}

async function renderZhihuFeed(catId,force=false){
  const cat=CATEGORIES.find(c=>c.id===catId);
  const feed=$('#zhihu-feed');

  feed.innerHTML=`
    <div class="card zhihu-card" style="background:linear-gradient(120deg,#f0f7ff,#fff)">
      <div style="display:flex;gap:14px;align-items:center">
        <div style="font-size:34px">${cat.icon}</div>
        <div>
          <div style="font-weight:700;font-size:16px">知乎 · ${cat.name}话题</div>
          <div style="font-size:13px;color:#6f665c">${cat.desc}</div>
        </div>
      </div>
    </div>
    <div class="card zhihu-card" style="text-align:center;color:#a29a8f">正在从知乎拉取内容…</div>`;

  const posts=await loadPosts(catId,force);

  feed.innerHTML=`
    <div class="card zhihu-card" style="background:linear-gradient(120deg,#f0f7ff,#fff)">
      <div style="display:flex;gap:14px;align-items:center">
        <div style="font-size:34px">${cat.icon}</div>
        <div style="flex:1">
          <div style="font-weight:700;font-size:16px">知乎 · ${cat.name}话题
            ${CAP.contentApi?'<span class="ai-badge">实时 API</span>':'<span class="ai-badge local">离线示例</span>'}</div>
          <div style="font-size:13px;color:#6f665c">${cat.desc}</div>
        </div>
        ${CAP.contentApi?`<button class="btn btn-ghost btn-sm" onclick="refreshFeed('${catId}')"
           style="white-space:nowrap">🔄 换一批</button>`:''}
      </div>
      ${posts.length?`<div style="font-size:12px;color:#a29a8f;margin-top:10px">
        本批 ${posts.length} 条 · 每次进入该分类都会重新随机抽取</div>`:''}
    </div>`+
    (posts.length?posts.map((p,i)=>renderPostCard(p,i,catId)).join('')
      :`<div class="card zhihu-card" style="text-align:center;color:#a29a8f">这一类暂时没有拉到内容</div>`);
}

/** 手动换一批：强制重新检索当前分类 */
async function refreshFeed(catId){
  await renderZhihuFeed(catId,true);
  toast('已换一批知乎内容');
}

function renderPostCard(p,i,catId){
  const key=p.url;
  const hasRead=!!state.read[key];
  return `<div class="card zhihu-card">
    <div class="zhihu-head">
      <div class="zhihu-ava">${escapeHtml((p.author||'知')[0])}</div>
      <div style="flex:1">
        <div class="zhihu-title">${escapeHtml(p.title)}</div>
        <div class="zhihu-meta">${escapeHtml(p.author||'知乎用户')}${p.badge?' · '+escapeHtml(p.badge):''}
          · ▲ ${p.votes||0} · 💬 ${p.comments||0}</div>
      </div>
    </div>
    <div class="zhihu-excerpt">${escapeHtml(p.excerpt||'')}</div>
    ${(p.hotComments||[]).map(c=>`<div class="hot-cmt">💬 ${escapeHtml(c)}</div>`).join('')}

    <div class="zhihu-actions">
      <a class="z-btn primary" href="${p.url}" target="_blank" rel="noopener"
         onclick="markOpened('${catId}',${i})">↗ 去知乎读原文</a>
      <button class="z-btn ${hasRead?'done':''}" onclick="toggleRead('${catId}',${i})">
        ${hasRead?'✓ 已写下感受':'✍️ 读完写感受 +1💡'}</button>
      <button class="z-btn" onclick="openVerify('${catId}')">🔗 我在知乎回应了 +3💡</button>
      <span class="z-reward">互动在知乎完成</span>
    </div>

    <div class="read-box" id="read-${catId}-${i}">
      <textarea id="rf-${catId}-${i}" placeholder="刚才读到的哪一句最戳你？写什么都可以，没有人会评判。">${escapeHtml(state.read[key]?.text||'')}</textarea>
      <div class="row">
        <button class="btn btn-primary btn-sm" onclick="submitRead('${catId}',${i})">记下来，+1 💡</button>
      </div>
    </div>
    ${hasRead?`<div class="done-tip">✍️ 你写下的：${escapeHtml(state.read[key].text)}</div>`:''}
  </div>`;
}

function markOpened(catId,i){
  const p=POSTS[catId][i];
  // 打开原文后自动展开感受框，降低操作成本
  setTimeout(()=>{
    const box=$(`#read-${catId}-${i}`);
    if(box&&!state.read[p.url]){box.classList.add('open')}
  },600);
}
function toggleRead(catId,i){
  const box=$(`#read-${catId}-${i}`);
  const open=box.classList.contains('open');
  $$('.read-box').forEach(b=>b.classList.remove('open'));
  if(!open){box.classList.add('open');box.querySelector('textarea').focus()}
}
function submitRead(catId,i){
  const p=POSTS[catId][i];
  const v=$(`#rf-${catId}-${i}`).value.trim();
  if(v.length<2){toast('随便写一点就好');return}
  const first=!state.read[p.url];
  state.read[p.url]={text:v,time:Date.now()};
  if(first){
    state.insp[catId]+=1;
    toast('💡 +1 灵感值（'+CATEGORIES.find(c=>c.id===catId).name+'）');
  }else toast('已更新你的感受');
  save();refreshTop();renderCatTabs(catId);renderZhihuFeed(catId);renderUnlockPanel(catId);
}

/* ══════════════════ 回链校验：互动真正回归知乎 ══════════════════ */
function openVerify(catId){
  // CLI 模式下服务端本身就是"本人账号"，无需 OAuth 也可校验
  const cliMode = CAP.sourceType==='cli';
  const canVerify = CAP.loggedIn || cliMode;
  $('#verify-flow').innerHTML=`
    <div class="note-inline" style="margin-bottom:18px">
      知乎开放平台<b>没有提供代替用户点赞/评论/发想法的写入接口</b>。
      所以真实的互动必须由你本人在知乎完成 —— 我们只负责校验这条创作确实属于你，然后发放奖励。
    </div>

    <div class="vstep">
      <div class="n">1</div><div class="c">
        <div class="t">确认身份${canVerify?' ✓':''}</div>
        <div class="d">${
          CAP.loggedIn
          ? `已登录为 <b>${escapeHtml(CAP.user.nick)}</b>，可以校验创作归属。`
          : cliMode
            ? '当前为<b>本地 CLI 模式</b>：服务端使用你本机已授权的知乎凭证，可直接校验本人创作。'
            : (CAP.oauth
              ? '走知乎 OAuth 授权，我们只读取你的创作列表用于核对归属。<br><a class="btn btn-zhihu btn-sm" style="margin-top:8px" href="/auth/login">🔐 去登录</a>'
              : '服务端尚未配置 OAuth 应用（app_id / app_key），也没有本地已授权 CLI。')}</div>
      </div>
    </div>

    <div class="vstep ${canVerify?'':'dim'}">
      <div class="n">2</div><div class="c">
        <div class="t">在知乎站内完成真实互动</div>
        <div class="d">打开上面任意一篇原文，在<b>知乎 App 或网页</b>里赞同、评论，
          或针对这个话题写一条回答 / 想法并发布。</div>
      </div>
    </div>

    <div class="vstep ${canVerify?'':'dim'}">
      <div class="n">3</div><div class="c">
        <div class="t">把你的创作链接贴回来</div>
        <div class="d">支持回答、文章、想法链接。系统会调用
          <code style="font-size:12px">/api/v1/user/contents</code> 核对它确实来自你的账号。</div>
        <div class="verify-input">
          <input id="verify-url" placeholder="https://www.zhihu.com/answer/… 或 zhuanlan.zhihu.com/p/…"
                 ${canVerify?'':'disabled'}>
          <button class="btn btn-zhihu btn-sm" onclick="doVerify('${catId}')" ${canVerify?'':'disabled'}>校验</button>
        </div>
        <div id="verify-result"></div>
      </div>
    </div>`;
  $('#verify-modal').classList.add('open');
}

async function doVerify(catId){
  const url=$('#verify-url').value.trim();
  const box=$('#verify-result');
  if(!url){box.innerHTML=`<div class="verify-result err">请先贴上链接</div>`;return}
  box.innerHTML=`<div class="verify-result">正在核对归属…</div>`;
  try{
    const r=await fetch('/api/verify-contribution',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({url})
    });
    const d=await r.json();
    if(!d.ok){box.innerHTML=`<div class="verify-result err">${escapeHtml(d.error)}</div>`;return}

    state.insp[catId]+=d.reward;
    state.verified[d.content.url]=d.content;
    save();refreshTop();renderCatTabs(catId);renderUnlockPanel(catId);

    box.innerHTML=`<div class="verify-result ok">
      ✓ 校验通过：<b>${escapeHtml(d.content.title||'你的创作')}</b><br>
      这是一条真实发布在知乎的${escapeHtml(d.content.type||'内容')}，已发放 <b>+${d.reward} 💡</b>。
      <a href="${d.content.url}" target="_blank" rel="noopener">查看原文 ↗</a></div>`;
    toast(`💡 +${d.reward} 灵感值 · 真实创作已校验`);
  }catch(e){
    box.innerHTML=`<div class="verify-result err">网络错误：${escapeHtml(e.message)}</div>`;
  }
}

/* ══════════════════ 解锁面板 ══════════════════ */
function renderUnlockPanel(catId){
  const cat=CATEGORIES.find(c=>c.id===catId);
  const insp=state.insp[catId];
  $('#unlock-panel').innerHTML=`
    <h3>${cat.icon} ${cat.name} <span class="pill">💡 ${insp}</span></h3>
    <div class="insp-big">当前灵感值 <b>${insp}</b>，点击沙具解锁</div>
    <div class="unlock-list">
      ${cat.toys.map((t,i)=>{
        const owned=state.unlocked[t.id];
        const cost=i+1;
        const afford=insp>=cost;
        return `<div class="unlock-item ${owned?'owned':''} ${afford||owned?'':'unaffordable'}" data-toy="${t.id}"
          ${owned?'':`onclick="tryUnlock('${catId}','${t.id}',${cost})"`}>
          ${toyAssetHTML(t,'emoji toy-asset'+(owned?'':' locked'))}
          <span class="nm">${t.name}</span>
          ${owned?'':`<span class="cost">💡${cost}</span>`}
        </div>`;
      }).join('')}
    </div>
    <div style="font-size:12px;color:var(--ink-3);margin-top:12px">解锁的沙具会自动进入「我的沙盘」沙具库。</div>`;
}
function tryUnlock(catId,toyId,cost){
  if(state.insp[catId]<cost){toast('灵感值不够，去读一篇或在知乎回应一下');return}
  state.insp[catId]-=cost;
  state.unlocked[toyId]=true;
  save();
  const t=toyOf(toyId);
  toast(`🎉 解锁「${t.name}」${t.emoji}`);
  refreshTop();renderUnlockPanel(catId);renderCatTabs(catId);renderRandom();renderLibrary();
}
function refreshTop(){$('#insp-total').textContent=inspTotal()}

/* ══════════════════ 沙盘编辑器 ══════════════════ */
let selectedLib=null,selectedPlaced=-1;
let undoStack=[],redoStack=[];
const traySnapshot=()=>JSON.parse(JSON.stringify(state.tray));
function recordTrayAction(action){
  const process=state.trayProcess||(state.trayProcess={startedAt:null,lastEditedAt:null,editCount:0,actions:{},nextOrder:1});
  const now=Date.now();
  process.startedAt ||= now;
  process.lastEditedAt=now;
  process.editCount=(process.editCount||0)+1;
  process.actions[action]=(process.actions[action]||0)+1;
}
function commitTray(previous,action='adjust'){
  if(JSON.stringify(previous)===JSON.stringify(state.tray))return;
  undoStack.push(previous);if(undoStack.length>50)undoStack.shift();
  redoStack=[];state.report=null;recordTrayAction(action);save();renderSandbox();
}
function updateTrayStory(value){state.trayStory=String(value||'').slice(0,500);state.report=null;save()}
function updateHistoryButtons(){
  if($('#undo-btn'))$('#undo-btn').disabled=!undoStack.length;
  if($('#redo-btn'))$('#redo-btn').disabled=!redoStack.length;
}
function ownedToys(){return CATEGORIES.flatMap(c=>c.toys.filter(t=>state.unlocked[t.id]).map(t=>({...t,cat:c})))}
function renderLibrary(){
  const toys=ownedToys();
  $('#lib-count').textContent=toys.length+' 件';
  if(!toys.length){
    $('#lib-grid').innerHTML=`<div class="lib-empty"><span class="big">🧺</span>沙具库还是空的<br>去「探索沙具」解锁吧</div>`;return;
  }
  $('#lib-grid').innerHTML=toys.map(t=>`
    <div class="lib-toy ${selectedLib===t.id?'selected':''}" data-id="${t.id}" title="${t.name} · ${t.cat.name}" draggable="true" aria-label="拖动${t.name}到沙盘">
      ${toyAssetHTML(t,'e toy-asset')}<span class="n">${t.name}</span>
    </div>`).join('');
  $$('#lib-grid .lib-toy').forEach(el=>{
    el.addEventListener('click',()=>{
      selectedLib=el.dataset.id;selectedPlaced=-1;
      renderLibrary();renderSandbox();
      toast('点击沙盘任意位置放置「'+toyOf(selectedLib).name+'」');
    });
    el.addEventListener('dragstart',event=>{
      selectedLib=el.dataset.id;
      event.dataTransfer.effectAllowed='copy';
      event.dataTransfer.setData('text/plain',selectedLib);
      el.classList.add('dragging');$('#sandbox').classList.add('drop-ready');
    });
    el.addEventListener('dragend',()=>{
      el.classList.remove('dragging');$('#sandbox').classList.remove('drop-ready');
    });
  });
}
function renderSandbox(){
  const sb=$('#sandbox');sb.innerHTML='';
  state.tray.forEach((it,i)=>{
    const t=toyOf(it.toyId);if(!t)return;
    const d=document.createElement('div');
    d.className='placed'+(i===selectedPlaced?' selected':'');
    d.style.left=it.x+'%';d.style.top=it.y+'%';d.style.zIndex=String(i+1);
    d.style.transform=`translate(-50%,-50%) rotate(${Number(it.rotation)||0}deg) scale(${Number(it.scale)||1})`;
    d.innerHTML=toyAssetHTML(t,'placed-asset');d.title=t.name;
    d.addEventListener('pointerdown',e=>startDrag(e,i));
    sb.appendChild(d);
  });
  $('#tray-count').textContent='已摆放 '+state.tray.length+' 件沙具';
  updateHistoryButtons();
}
function placeToyAt(toyId,x,y){
  if(!toyOf(toyId))return;
  const previous=traySnapshot();
  const process=state.trayProcess||(state.trayProcess={startedAt:null,lastEditedAt:null,editCount:0,actions:{},nextOrder:1});
  state.tray.push({toyId,x:Math.min(96,Math.max(4,x)),y:Math.min(94,Math.max(6,y)),rotation:0,scale:1,placedAt:Date.now(),placedOrder:process.nextOrder++});
  selectedPlaced=state.tray.length-1;selectedLib=toyId;commitTray(previous,'place');
}
$('#sandbox').addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';$('#sandbox').classList.add('drop-ready')});
$('#sandbox').addEventListener('dragleave',e=>{if(!$('#sandbox').contains(e.relatedTarget))$('#sandbox').classList.remove('drop-ready')});
$('#sandbox').addEventListener('drop',e=>{
  e.preventDefault();$('#sandbox').classList.remove('drop-ready');
  const toyId=e.dataTransfer.getData('text/plain');
  const r=$('#sandbox').getBoundingClientRect();
  placeToyAt(toyId,+(((e.clientX-r.left)/r.width)*100).toFixed(1),+(((e.clientY-r.top)/r.height)*100).toFixed(1));
  toast(`已把「${toyOf(toyId)?.name||'沙具'}」放进沙盘`);
});
$('#sandbox').addEventListener('click',e=>{
  if(e.target.closest('.placed'))return;
  if(!selectedLib){toast('先从左侧沙具库选一件沙具');return}
  const r=$('#sandbox').getBoundingClientRect();
  const x=+(((e.clientX-r.left)/r.width)*100).toFixed(1);
  const y=+(((e.clientY-r.top)/r.height)*100).toFixed(1);
  placeToyAt(selectedLib,x,y);
});
function startDrag(e,i){
  e.preventDefault();e.stopPropagation();
  const previous=traySnapshot();
  selectedPlaced=i;renderSandbox();
  const el=$('#sandbox').children[i],rect=$('#sandbox').getBoundingClientRect();
  const move=ev=>{
    const x=+(((ev.clientX-rect.left)/rect.width)*100).toFixed(1);
    const y=+(((ev.clientY-rect.top)/rect.height)*100).toFixed(1);
    state.tray[i].x=Math.min(96,Math.max(4,x));
    state.tray[i].y=Math.min(94,Math.max(6,y));
    el.style.left=state.tray[i].x+'%';el.style.top=state.tray[i].y+'%';
  };
  const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);commitTray(previous,'move')};
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);
}
document.addEventListener('keydown',e=>{
  if(e.key==='Delete'&&selectedPlaced>-1&&!/INPUT|TEXTAREA/.test(document.activeElement.tagName))removeSelected();
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!e.shiftKey){e.preventDefault();undoTray()}
  if(((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y')||((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==='z')){e.preventDefault();redoTray()}
});
function removeSelected(){
  if(selectedPlaced<0){toast('先点击选中沙盘上的一件沙具');return}
  const previous=traySnapshot();state.tray.splice(selectedPlaced,1);selectedPlaced=-1;commitTray(previous,'remove');
}
function clearTray(){
  if(!state.tray.length)return;
  const previous=traySnapshot();state.tray=[];selectedPlaced=-1;commitTray(previous,'clear');toast('沙盘已清空');
}
function undoTray(){
  if(!undoStack.length)return;
  redoStack.push(traySnapshot());state.tray=undoStack.pop();selectedPlaced=-1;state.report=null;recordTrayAction('undo');save();renderSandbox();
}
function redoTray(){
  if(!redoStack.length)return;
  undoStack.push(traySnapshot());state.tray=redoStack.pop();selectedPlaced=-1;state.report=null;recordTrayAction('redo');save();renderSandbox();
}
function rotateSelected(delta){
  if(selectedPlaced<0)return toast('先选中一件沙具');
  const previous=traySnapshot();
  state.tray[selectedPlaced].rotation=((Number(state.tray[selectedPlaced].rotation)||0)+delta)%360;
  commitTray(previous,'rotate');
}
function scaleSelected(delta){
  if(selectedPlaced<0)return toast('先选中一件沙具');
  const previous=traySnapshot();
  const current=Number(state.tray[selectedPlaced].scale)||1;
  state.tray[selectedPlaced].scale=Math.min(2,Math.max(.5,+(current+delta).toFixed(1)));
  commitTray(previous,'scale');
}
function layerSelected(direction){
  if(selectedPlaced<0)return toast('先选中一件沙具');
  const target=Math.min(state.tray.length-1,Math.max(0,selectedPlaced+direction));
  if(target===selectedPlaced)return;
  const previous=traySnapshot();
  const [item]=state.tray.splice(selectedPlaced,1);state.tray.splice(target,0,item);selectedPlaced=target;
  commitTray(previous,'layer');
}
function loadAsset(src){
  return new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>resolve(null);image.src=src});
}
async function exportTrayImage(){
  if(!state.tray.length)return toast('沙盘还是空的');
  const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=760;
  const ctx=canvas.getContext('2d');
  const sand=await loadAsset('/images/sandboard.jpg');
  if(sand)ctx.drawImage(sand,0,0,1200,700);
  else{const gradient=ctx.createLinearGradient(0,0,1200,760);gradient.addColorStop(0,'#f7e4b4');gradient.addColorStop(1,'#d8b97a');ctx.fillStyle=gradient;ctx.fillRect(0,0,1200,700)}
  ctx.strokeStyle='rgba(112,83,42,.28)';ctx.lineWidth=4;ctx.strokeRect(12,12,1176,676);
  const assets=new Map();
  await Promise.all([...new Set(state.tray.map(item=>toyOf(item.toyId)?.image).filter(Boolean))].map(async src=>assets.set(src,await loadAsset(src))));
  state.tray.forEach(item=>{
    const toy=toyOf(item.toyId);if(!toy)return;
    ctx.save();ctx.translate(item.x/100*1200,item.y/100*700);ctx.rotate((Number(item.rotation)||0)*Math.PI/180);
    const size=112*(Number(item.scale)||1),asset=assets.get(toy.image);
    if(asset){ctx.globalCompositeOperation='multiply';ctx.drawImage(asset,-size/2,-size/2,size,size)}
    else{ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${Math.round(72*(Number(item.scale)||1))}px "Segoe UI Emoji","Apple Color Emoji",sans-serif`;ctx.fillText(toy.emoji,0,0)}
    ctx.restore();
  });
  ctx.fillStyle='#40382d';ctx.textAlign='left';ctx.font='bold 24px "Microsoft YaHei",sans-serif';ctx.fillText('沙游心语 · 我的沙盘',28,726);
  ctx.textAlign='right';ctx.font='18px "Microsoft YaHei",sans-serif';ctx.fillStyle='#6f6558';ctx.fillText('仅供自我探索，不构成心理诊断',1172,726);
  canvas.toBlob(blob=>{
    if(!blob)return toast('图片导出失败');
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`沙游心语-${Date.now()}.png`;link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);toast('沙盘图片已导出');
  },'image/png');
}
function goReport(){
  if(!state.tray.length){toast('沙盘还是空的，先摆放一些沙具');return}
  state.report=null;save();switchView('report');
}

/* ══════════════════ 沙盘报告 ══════════════════ */
const ANALYSIS_ASPECTS=[
  {id:'observation',label:'客观画面'},
  {id:'narrative',label:'整体主题与心理动力'},
  {id:'space',label:'空间布局与心理联想'},
  {id:'relationships',label:'角色关系与心理边界'},
  {id:'emotion',label:'情绪氛围与防御线索'},
  {id:'resources',label:'内在资源与成长力量'},
  {id:'change',label:'变化方向与下一幕'},
  {id:'reflection',label:'开放式自我探索问题'},
];
const DEFAULT_ANALYSIS_ASPECTS=ANALYSIS_ASPECTS.map(item=>item.id);

function regenerateReport(){
  generateReport();
}

function analyzeTray(){
  const items=state.tray.map(it=>({...it,toy:toyOf(it.toyId),cat:catOf(it.toyId)}));
  const byCat={};items.forEach(i=>byCat[i.cat.id]=(byCat[i.cat.id]||0)+1);
  const counts=Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
  const n=items.length;
  const cx=items.reduce((a,i)=>a+i.x,0)/n, cy=items.reduce((a,i)=>a+i.y,0)/n;
  const quad={lt:0,rt:0,lb:0,rb:0};
  items.forEach(i=>{quad[(i.x<50?'l':'r')+(i.y<50?'t':'b')]+=1});
  const center=items.filter(i=>Math.abs(i.x-50)<18&&Math.abs(i.y-50)<18).length;
  const xs=items.map(i=>i.x),ys=items.map(i=>i.y);
  const spread=(Math.max(...xs)-Math.min(...xs))*(Math.max(...ys)-Math.min(...ys))/10000;
  // 最近邻均距
  let nn=[];
  items.forEach((a,i)=>{let m=Infinity;items.forEach((b,j)=>{if(i!==j)m=Math.min(m,Math.hypot(a.x-b.x,a.y-b.y))});if(m<Infinity)nn.push(m)});
  const avgNN=nn.length?nn.reduce((s,v)=>s+v,0)/nn.length:0;
  // 孤立件：少于4件不判；超半数孤立不点名
  const lone=n<4?[]:items.filter((a,i)=>{let m=Infinity;items.forEach((b,j)=>{if(i!==j)m=Math.min(m,Math.hypot(a.x-b.x,a.y-b.y))});return m>30});
  const lonely=lone.length>n/2?[]:lone;
  return {items,byCat,counts,n,cx,cy,quad,center,spread,avgNN,lonely};
}

/** 把结构特征转成给直答的描述文本 */
function featuresText(a){
  const catName=id=>CATEGORIES.find(c=>c.id===id).name;
  const placed=a.items.slice(0,40).map((i,index)=>`${index+1}.${i.toy.name}：横向${i.x}%、纵向${i.y}%、缩放${Number(i.scale)||1}倍`).join('；');
  const meanings=[...new Map(a.items.map(i=>[i.toyId,`${i.toy.name}：${i.toy.meaning}`])).values()].slice(0,24).join('；');
  const ordered=a.items.filter(i=>i.placedOrder).sort((x,y)=>x.placedOrder-y.placedOrder);
  const process=state.trayProcess||{};
  const processMinutes=process.startedAt&&process.lastEditedAt?Math.max(1,Math.round((process.lastEditedAt-process.startedAt)/60000)):null;
  const actionLabels={place:'放入',move:'移动',remove:'移除',clear:'清空',undo:'撤销',redo:'重做',rotate:'旋转',scale:'缩放',layer:'调整图层',adjust:'调整'};
  const actionText=Object.entries(process.actions||{}).map(([key,value])=>`${actionLabels[key]||key}${value}次`).join('、');
  const edge=a.items.filter(i=>i.x<=10||i.x>=90||i.y<=10||i.y>=90);
  const large=a.items.filter(i=>(Number(i.scale)||1)>=1.4),small=a.items.filter(i=>(Number(i.scale)||1)<=.7);
  return [
    `用户自述（最高优先级）：${state.trayStory?.trim()||'未填写；不要替用户虚构作品含义'}`,
    `沙具总数：${a.n} 件`,
    `类别构成：${a.counts.map(([k,v])=>catName(k)+' '+v+'件').join('、')}`,
    `使用的沙具：${a.items.map(i=>i.toy.name).join('、')}`,
    `空间分布：左上${a.quad.lt} 右上${a.quad.rt} 左下${a.quad.lb} 右下${a.quad.rb}，中心区${a.center}件`,
    `重心位置：横向 ${a.cx.toFixed(0)}%（0左100右），纵向 ${a.cy.toFixed(0)}%（0上100下）`,
    `平均最近邻距离：${a.avgNN.toFixed(1)}（小于13很紧密，大于26较疏离）`,
    `铺开程度：${(a.spread*100).toFixed(0)}%`,
    a.lonely.length?`明显孤立的沙具：${a.lonely.map(i=>i.toy.name).join('、')}`:'没有明显孤立的沙具',
    `边界接触：${edge.length?edge.map(i=>i.toy.name).join('、'):'无明显贴近边框的沙具'}`,
    `相对大小：放大突出的沙具为${large.length?large.map(i=>i.toy.name).join('、'):'无'}；缩小的沙具为${small.length?small.map(i=>i.toy.name).join('、'):'无'}`,
    `逐件位置（数组顺序仅代表当前图层，不等同于摆放顺序）：${placed}`,
    ordered.length?`可记录的摆放顺序：${ordered.map(i=>`${i.placedOrder}.${i.toy.name}`).join(' → ')}`:'摆放顺序：旧存档未记录',
    actionText?`制作过程：约${processMinutes||1}分钟，共编辑${process.editCount||0}次；${actionText}`:'制作过程：没有可用操作记录',
    `传统象征联想（只能作为提问线索，用户自己的解释优先）：${meanings}`,
    '可观察范围限制：系统无法观察挑选时的犹豫、过程中的非语言情绪，也没有记录挖沙、掩埋、抹平或真实加水行为；“水”沙具不等于加水。',
  ].join('\n');
}

/** 本地规则引擎（直答不可用时兜底） */
function localNarrate(a){
  const catName=id=>CATEGORIES.find(c=>c.id===id).name;
  const themes=[];
  if(a.byCat.people)themes.push('关系与角色');
  if(a.byCat.animal)themes.push('本能与陪伴');
  if(a.byCat.building)themes.push('安全感与归属');
  if(a.byCat.nature)themes.push('生长与休息');
  if(a.byCat.symbol)themes.push('过渡与转变');
  if(a.byCat.traffic)themes.push('方向与前进');
  if(a.byCat.fantasy)themes.push('愿望与想象');
  if(a.byCat.monster)themes.push('压力与力量');
  const dominant=a.counts[0][0];
  const allEven=a.counts.every(([,v])=>v===a.counts[0][1]);
  const themeText=(themes.length?'从沙具构成看，这幅沙盘的线索是「'+themes.join('」「')+'」。':'')+
    (a.counts.length===1?`整盘只用了${catName(dominant)}，是一种集中的选择。`
      :allEven?`${a.counts.length} 个类别各出现 ${a.counts[0][1]} 件，没有哪一类被特别偏重。`
      :`其中${catName(dominant)}占比最高，可能是当前内心的重心。`);

  let atmo=[];
  if(a.avgNN<13)atmo.push('沙具彼此靠得很近，像是被有意地聚在一起');
  else if(a.avgNN>26)atmo.push('沙具之间留出了明显的距离，各自占据着自己的位置');
  else atmo.push('疏密比较均匀，既没有紧贴，也没有刻意疏远');
  if(a.spread<0.18)atmo.push('整盘集中在一个不大的范围里，沙面还留着大片空白');
  else if(a.spread>0.55)atmo.push('它们铺开在沙盘的大部分区域');
  if(a.center>=Math.ceil(a.n*0.4))atmo.push('中心区域是被着重使用的');
  else if(a.center===0)atmo.push('沙盘的正中留着空位，东西都落在四周');

  const pos=[];
  if(a.cx<42)pos.push('整体重心偏左');else if(a.cx>58)pos.push('整体重心偏右');else pos.push('整体重心居中');
  if(a.cy<45)pos.push('偏上方偏多');else if(a.cy>55)pos.push('偏下方偏多');
  if(a.lonely.length)pos.push(`「${a.lonely.map(i=>i.toy.name).join('、')}」离其他沙具比较远`);

  const qs=[];
  for(const[catId]of a.counts)qs.push(...(OPEN_QUESTIONS[catId]||[]));
  qs.push('如果请你给这一盘取一个名字，你会叫它什么？');
  if(a.lonely.length)qs.push(`「${a.lonely[0].toy.name}」离得比较远，是你有意让它待在那儿的吗？`);
  const questions=[...new Set(qs)].sort(()=>Math.random()-.5).slice(0,4);

  return {themeText,atmos:atmo.join('；')+'。',pos:pos.join('；')+'。',questions};
}

function buildReport(){
  const a=analyzeTray();
  const local=localNarrate(a);
  const picked=[];const used=new Set();
  for(const[catId]of a.counts){
    const t=a.items.find(i=>i.cat.id===catId&&!used.has(i.toyId));
    if(t){picked.push(t);used.add(t.toyId)}
  }
  const titleCands={
    people:['人群之中','谁在谁的身边','小小剧团'],
    animal:['同行的伙伴','本能的那一面','安静的陪伴'],
    building:['心之所居','屋檐下','正在建造的家'],
    nature:['山水之间','四季流转','长出来的风景'],
    symbol:['门的另一侧','过渡期','桥上风景'],
    traffic:['启程','在路上','方向'],
    fantasy:['愿望清单','另一个世界','未说出口的期待'],
    monster:['与力量共处','守卫与怪兽','边界']
  };
  const dominant=a.counts[0][0];
  // 兜底：即使将来新增分类忘了补标题池，也不会因取 undefined 而报错
  const cands=titleCands[dominant]||['此刻的沙盘','沙上的风景','我的这一盘'];
  const title=cands[Math.floor(Math.random()*cands.length)];
  return {
    title, ...local,
    symbols:picked.slice(0,3).map(i=>({emoji:i.toy.emoji,image:i.toy.image,name:i.toy.name,meaning:i.toy.meaning,x:i.x,y:i.y})),
    stats:{n:a.n,cats:a.counts.length,density:(a.n/(a.spread*100+8)).toFixed(1)},
    features:featuresText(a),
    aiText:null, source:'local', time:Date.now()
  };
}

let generating=false;
async function generateReport(){
  if(!CAP.loggedIn){$('#onboard').classList.add('open');toast('请先登录知乎，再生成沙盘报告');return}
  if(generating)return;generating=true;
  const focus=[...DEFAULT_ANALYSIS_ASPECTS];
  $('#report-area').innerHTML=`<div class="card report-wrap generating">
    <span class="liukanshan-loader"><span class="loader-halo"></span><img src="/images/liukanshan-thinking.png" alt="刘看山正在等待分析结果"></span>
    <p style="margin-top:16px">刘看山正在从整体主题、空间、关系、制作过程与内在资源等方面阅读你的沙盘……</p></div>`;

  const r=buildReport();
  r.analysisFocus=focus;

  // 尝试用独立大模型生成解读；失败则保留本地规则报告
  if(CAP.aiReport){
    try{
      const res=await fetch('/api/report',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({features:r.features})
      });
      if(res.status===401){window.dispatchEvent(new CustomEvent('shayu:unauthorized'));generating=false;return}
      const d=await res.json();
      if(d.ok&&d.text){r.aiText=d.text;r.source='llm';r.model=d.model;r.analysisFocus=d.aspects||focus}
    }catch(e){/* 静默降级 */}
  }

  state.report=r;save();generating=false;renderReport();
}

function renderReport(){
  const r=state.report;
  if(!r){
    $('#report-area').innerHTML=`<div class="card report-wrap" style="padding:50px;text-align:center">
      <p style="color:var(--ink-2)">还没有报告。先去「我的沙盘」完成布置。</p>
      <button class="btn btn-primary" style="margin-top:18px" onclick="switchView('tray')">去布置沙盘</button></div>`;
    return;
  }
  const badge=r.source==='llm'
    ?`<span class="ai-badge">AI · ${escapeHtml(r.model||CAP.aiModel||'大模型')}</span>`
    :'<span class="ai-badge local">本地规则引擎</span>';
  const focusLabels=(r.analysisFocus||[]).map(id=>ANALYSIS_ASPECTS.find(item=>item.id===id)?.label).filter(Boolean);

  $('#report-area').innerHTML=`
  <div class="card report-wrap report-card">
    <h1>沙盘报告 · ${escapeHtml(r.title)}${badge}</h1>
    <div class="report-sub">生成于 ${new Date(r.time).toLocaleString('zh-CN')} · 温和探索，非诊断</div>
    <div class="report-stats">
      <div class="stat-chip"><b>${r.stats.n}</b><span>沙具总数</span></div>
      <div class="stat-chip"><b>${r.stats.cats}</b><span>涉及大类</span></div>
      <div class="stat-chip"><b>${r.stats.density}</b><span>布局密度</span></div>
    </div>

    ${focusLabels.length?`<div class="report-focus"><span>完整报告已覆盖</span>${focusLabels.map(label=>`<b>${escapeHtml(label)}</b>`).join('')}</div>`:''}

    ${r.aiText?`<div class="report-block ai-reading"><h2>🪶 AI 深度解读</h2>
      <div class="ai-report-text">${formatAiReport(r.aiText)}</div></div>`:''}

    <div class="report-block"><h2>🧭 主题线索</h2><p>${escapeHtml(r.themeText)}</p></div>
    <div class="report-block"><h2>🪞 沙具与位置</h2>
      <ul>${r.symbols.map(s=>`<li class="report-symbol">${reportSymbolHTML(s)}<span><b>${escapeHtml(s.name)}</b>（${s.x<50?'左':'右'}${s.y<50?'上':'下'}区）—— ${escapeHtml(s.meaning)}</span></li>`).join('')}</ul>
    </div>
    <div class="report-block"><h2>🌤️ 整体氛围</h2><p>${escapeHtml(r.atmos)}</p></div>
    <div class="report-block"><h2>📐 空间与结构</h2><p>${escapeHtml(r.pos)}</p></div>
    <div class="report-block"><h2>💭 几个可以继续想的问题</h2>
      <ul>${r.questions.map(q=>`<li>${escapeHtml(q)}</li>`).join('')}</ul>
    </div>
    <div class="disclaimer">
      ⚠️ 本报告依据最终画面的结构提供心理联想，不对你本人作确定判断，也无法观察完整制作过程。沙具的象征意义没有标准答案，
      你的感受与解释始终优先。本工具不是心理测评或医学诊断，也不能替代专业帮助；
      若有持续的情绪困扰，请联系心理咨询师或拨打心理援助热线。
    </div>
    <div class="report-actions" style="margin-top:22px">
      <button class="btn btn-ghost" onclick="regenerateReport()">🔄 重新生成完整报告</button>
      <button class="btn btn-warm" onclick="ShaYuCommunity.openPublish()">📤 发布到社群</button>
    </div>
  </div>`;
}

/* 社区与发布逻辑已经拆分到 public/js/community.js。 */

/* ══════════════════ 初始化 ══════════════════ */
let gameEntered=false;
async function enterGame(){
  if(gameEntered||!CAP.loggedIn)return;
  gameEntered=true;
  await renderZhihuFeed(curCat);
  renderUnlockPanel(curCat);
  await ShaYuCommunity.migrateLegacyPosts();
  const sharedWork=new URLSearchParams(location.search).get('work');
  if(sharedWork){
    switchView('community');
    await ShaYuCommunity.openPost(sharedWork);
    history.replaceState({},'',location.pathname);
  }
}

(async function init(){
  ShaYuUserCenter.init({
    escapeHtml,
    toast,
    switchView,
    getCapabilities:()=>CAP,
  });
  ShaYuCommunity.init({
    api:ShaYuApi,
    escapeHtml,
    fmtTime,
    toast,
    closeModal,
    switchView,
    toyOf,
    getState:()=>state,
    saveState:save,
    getCapabilities:()=>CAP,
  });
  refreshTop();
  shuffleRandom();
  renderCatTabs();
  renderLibrary();
  renderSandbox();
  $('#tray-story').value=state.trayStory||'';
  renderReport();
  await probeCapabilities();

  // OAuth 回跳后的提示
  if(new URLSearchParams(location.search).get('login')==='ok'){
    toast('✓ 知乎账号已登录');
  }
  if(CAP.loggedIn){
    $('#onboard').classList.remove('open');
    await enterGame();
    if(!new URLSearchParams(location.search).get('work')) history.replaceState({},'',location.pathname);
  }
})();
