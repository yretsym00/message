/* =========================================
   1) グローバル
========================================= */
const SPREADSHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOpH43k0f6Cc0Qn1gzXsnJNDybSce7CTW1hOWBgvTJIfTPuaZsEpcbO1u9E7CIQSSGzAHa4ZST7fFw/pub?gid=1835455716&single=true&output=csv";

let conversations = [];
let currentSpeakerId = null;
let speakerConversations = {};
let typingIndicatorDiv = null;
let typingIndicatorInterval = null;

const talkList = document.getElementById("talkList");
const messageContainer = document.getElementById("messageContainer");
const inputArea = document.getElementById("inputArea");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const addBtn = document.getElementById("addBtn");
const choicesArea = document.getElementById("choicesArea");
const sidebarToggleBtn = document.getElementById("sidebarToggle");

let isConversationRunning = false;
let freeInputKeyHandler = null;

/* ===== 入力UI露出の待ち時間（拡張） ===== */
const INPUT_REVEAL_MIN = 1100;
const INPUT_REVEAL_MAX = 2600;

/* =========================================
   100vh対策
========================================= */
function setVhVar() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty("--vh", `${vh}px`);
}
window.addEventListener("resize", setVhVar);
window.addEventListener("orientationchange", setVhVar);
setVhVar();

/* =========================================
   起動
========================================= */
window.addEventListener("load", async () => {
  messageContainer.textContent = "データ取得中...";
  try {
    const res = await fetch(SPREADSHEET_URL);
    const csvText = await res.text();
    const rows = csvText.split("\n").map(r => r.split(","));

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]; if (r.length < 28) continue;
      const id = parseInt(r[0], 10); if (!id) continue;

      conversations.push({
        id,
        speakerName:(r[1]||"").trim(),
        message:(r[2]||"").trim(),
        input:(r[3]||"").trim(),
        answer:(r[4]||"").trim(),
        TrueId:(r[5]||"").trim(),
        NGid:(r[6]||"").trim(),
        choice1:(r[7]||"").trim(),
        choice2:(r[8]||"").trim(),
        choice3:(r[9]||"").trim(),
        choice4:(r[10]||"").trim(),
        nextId1:(r[11]||"").trim(),
        nextId2:(r[12]||"").trim(),
        nextId3:(r[13]||"").trim(),
        nextId4:(r[14]||"").trim(),
        speakerId:(r[15]||"").trim(),
        waittime_seconds:(r[16]||"").trim(),
        readstatus:(r[17]||"").trim(),
        image:(r[18]||"").replace(/\r/g,"").trim(),
        imageURL:(r[19]||"").replace(/\r/g,"").trim(),
        choice1URL:(r[20]||"").trim(),
        Tweettext1:(r[21]||"").trim(),
        choice2URL:(r[22]||"").trim(),
        Tweettext2:(r[23]||"").trim(),
        choice3URL:(r[24]||"").trim(),
        Tweettext3:(r[25]||"").trim(),
        choice4URL:(r[26]||"").trim(),
        Tweettext4:(r[27]||"").trim()
      });
    }

    conversations.sort((a,b) => a.id - b.id);
    const first = conversations.find(c => c.speakerId && c.speakerId !== "USER");
    if (first) addSpeakerToList(first.speakerId, first.speakerName, first.readstatus === "unread");

    messageContainer.textContent = "";
  } catch(e) {
    console.error(e);
    messageContainer.textContent = "データ取得失敗。URLや公開設定などを確認してください。";
  }

  sidebarToggleBtn.addEventListener("click", () => {
    talkList.classList.toggle("open");
    document.body.classList.toggle("drawer-open", talkList.classList.contains("open"));
  });

  addBtn.addEventListener("click", () => { alert("左ボタンがクリックされました（例）"); });

  userInput.blur();  // 初回自動ズーム抑止
  padBottomForInput();
});

const inputResizeObserver = new ResizeObserver(padBottomForInput);
inputResizeObserver.observe(inputArea);

/* =========================================
   サイドバー
========================================= */
function findTalkItemById(speakerId) {
  const items = document.querySelectorAll(".talk-item");
  for (const it of items) if (it.dataset.speakerId === speakerId) return it;
  return null;
}
function updateSidebarToggleUnreadIndicator() {
  const unreadIcons = talkList.querySelectorAll(".unread-icon");
  const id = "sidebarUnreadIndicator";
  if (unreadIcons.length > 0) {
    if (!document.getElementById(id)) {
      const d = document.createElement("div");
      d.id = id; d.className = "sidebar-unread";
      sidebarToggleBtn.appendChild(d);
    }
  } else {
    const d = document.getElementById(id);
    if (d) d.remove();
  }
}
function addSpeakerToList(speakerId, speakerName, unread=false) {
  const exist = findTalkItemById(speakerId);
  if (exist) {
    if (unread && !exist.querySelector(".unread-icon")) {
      const dot = document.createElement("div");
      dot.className = "unread-icon"; exist.appendChild(dot);
    }
    updateSidebarToggleUnreadIndicator(); return;
  }
  const item = document.createElement("div");
  item.className = "talk-item"; item.dataset.speakerId = speakerId;

  const nameDiv = document.createElement("div");
  nameDiv.className = "talk-item-name"; nameDiv.textContent = speakerName;
  item.appendChild(nameDiv);

  if (unread) {
    const dot = document.createElement("div");
    dot.className = "unread-icon"; item.appendChild(dot);
  }

  item.addEventListener("click", () => {
    const dot = item.querySelector(".unread-icon");
    if (dot) { dot.remove(); updateSidebarToggleUnreadIndicator(); }
    startConversation(speakerId);
    if (talkList.classList.contains("open")) {
      talkList.classList.remove("open"); document.body.classList.remove("drawer-open");
    }
    blurActive();
  });

  talkList.appendChild(item);
  updateSidebarToggleUnreadIndicator();
}

/* =========================================
   会話本体
========================================= */
async function startConversation(speakerId) {
  if (currentSpeakerId === speakerId && isConversationRunning) return;
  isConversationRunning = true;
  currentSpeakerId = speakerId;

  messageContainer.innerHTML = "";
  inputArea.style.display = "none";
  choicesArea.style.display = "none";
  userInput.value = "";

  if (!speakerConversations[speakerId]) {
    const first = conversations.find(c => c.speakerId === speakerId);
    speakerConversations[speakerId] = {
      speakerName: first ? first.speakerName : speakerId,
      messages: [],
      currentId: first ? first.id : null
    };
  }

  restoreConversationHistory(speakerId);

  if (!speakerConversations[speakerId].currentId) { isConversationRunning = false; return; }

  await displayFromId(speakerConversations[speakerId].currentId);
  isConversationRunning = false;
}

function restoreConversationHistory(speakerId) {
  const info = speakerConversations[speakerId]; if (!info) return;
  for (const msg of info.messages) {
    const rowDiv = document.createElement("div");
    rowDiv.className = "message-row " + (msg.speakerName === "あなた" ? "message-right" : "message-left");

    if (msg.speakerName !== "あなた") {
      const iconDiv = document.createElement("div");
      iconDiv.className = getSpeakerIconClassName(speakerId);
      rowDiv.appendChild(iconDiv);
    }

    const wrap = document.createElement("div"); wrap.className = "bubble-wrapper";
    const bubble = document.createElement("div"); bubble.className = "message-bubble";
    if (msg.image === "ON") {
      bubble.innerHTML = `<img src="${msg.imageURL}" style="max-width: 100%; height:auto;">`;
    } else {
      bubble.innerHTML = msg.text.replace(/\n/g, "<br>");
    }
    wrap.appendChild(bubble);

    const meta = document.createElement("div"); meta.classList.add("metadata");
    if (msg.speakerName === "あなた") {
      meta.classList.add("metadata-user"); meta.innerHTML = `<div>既読</div><div>${msg.timestamp || "--:--"}</div>`;
    } else {
      meta.classList.add("metadata-speaker"); meta.innerHTML = `<div>${msg.timestamp || "--:--"}</div>`;
    }
    wrap.appendChild(meta);

    rowDiv.appendChild(wrap);
    messageContainer.appendChild(rowDiv);
  }
  messageContainer.scrollTop = messageContainer.scrollHeight;
}

async function displayFromId(startId) {
  const idx = conversations.findIndex(c => c.id === startId);
  if (idx === -1) return;

  let currentRow = conversations[idx];
  const initialSpeakerId = currentSpeakerId;

  while (true) {
    if (!currentRow) break;
    if (currentSpeakerId !== initialSpeakerId) break;

    const waitSec = parseInt(currentRow.waittime_seconds || "0", 10);
    if (waitSec > 0) await sleep(waitSec * 1000);
    else await sleep(getDelayForMessage(currentRow.message));

    const rowSpeakerId = currentRow.speakerId;
    const rowSpeakerName = currentRow.speakerName;
    const nextRow = conversations.find(c => c.id === currentRow.id + 1);

    if (rowSpeakerId === initialSpeakerId && rowSpeakerId !== "USER") {
      showTypingIndicator(false);
      await sleep(getTypingWaitTime());
      hideTypingIndicator();

      addMessageToChat(rowSpeakerId, rowSpeakerName, currentRow.message, currentRow.image, currentRow.imageURL);

      speakerConversations[initialSpeakerId].currentId = currentRow.id;
      if (!nextRow) break;
      currentRow = nextRow;
      continue;

    } else if (!rowSpeakerId || rowSpeakerId === "USER") {
      speakerConversations[initialSpeakerId].currentId = currentRow.id;

      if (currentRow.message.trim() !== "") {
        addMessageToChat("USER", "あなた", currentRow.message, currentRow.image, currentRow.imageURL);
        if (!nextRow) break;
        currentRow = nextRow;
        continue;
      }

      if (currentRow.input || currentRow.choice1 || currentRow.choice2 || currentRow.choice3 || currentRow.choice4) {
        await handleUserTurn(currentRow);
      }
      break;

    } else {
      if (rowSpeakerId && rowSpeakerId !== "USER") {
        if (!speakerConversations[rowSpeakerId]) {
          speakerConversations[rowSpeakerId] = { speakerName: rowSpeakerName || rowSpeakerId, messages: [], currentId: currentRow.id };
        } else {
          speakerConversations[rowSpeakerId].currentId = currentRow.id;
        }
        addSpeakerToList(rowSpeakerId, rowSpeakerName, currentRow.readstatus === "unread");
      }
      speakerConversations[initialSpeakerId].currentId = currentRow.id;
      break;
    }
  }
}

/* =========================================
   入力UI露出の準備（待機＋余白＋スクロール）
========================================= */
async function prepareToRevealInput() {
  const bubbles = messageContainer.querySelectorAll(".message-bubble");
  const lastBubble = bubbles[bubbles.length - 1];

  let wait = INPUT_REVEAL_MIN;
  if (lastBubble) {
    const h = lastBubble.getBoundingClientRect().height || 0;
    wait = Math.round(Math.min(INPUT_REVEAL_MAX, Math.max(INPUT_REVEAL_MIN, h * 6)));
  }

  padBottomForInput();
  await nextFrame(); await nextFrame();
  scrollToBottom();

  if (document.querySelector(".typing-indicator")) {
    wait = Math.max(wait, 1000);
  }
  await sleep(wait);
  scrollToBottom();
}

function nextFrame() { return new Promise(r => requestAnimationFrame(() => r())); }
function scrollToBottom() { messageContainer.scrollTop = messageContainer.scrollHeight; }

/* =========================================
   入力ターン
========================================= */
async function handleUserTurn(row) {
  const {
    input, answer, TrueId, NGid,
    choice1, choice2, choice3, choice4,
    nextId1, nextId2, nextId3, nextId4,
    Tweettext1, Tweettext2, Tweettext3, Tweettext4
  } = row;

  inputArea.style.display = "none";
  choicesArea.style.display = "none";
  userInput.value = "";

  // リスナー初期化
  sendBtn.onclick = null;
  sendBtn.disabled = false;
  if (freeInputKeyHandler) { userInput.removeEventListener("keydown", freeInputKeyHandler); freeInputKeyHandler = null; }

  // 入力UIを出す前に「見せ待ち」
  await prepareToRevealInput();

  // ——— 選択肢 ———
  if (choice1 || choice2 || choice3 || choice4) {
    choicesArea.innerHTML = "";
    choicesArea.style.display = "block";
    padBottomForInput();
    await nextFrame(); scrollToBottom();

    const choices = [];
    if (choice1) choices.push({ text: choice1, nextId: nextId1, tweetText: Tweettext1 });
    if (choice2) choices.push({ text: choice2, nextId: nextId2, tweetText: Tweettext2 });
    if (choice3) choices.push({ text: choice3, nextId: nextId3, tweetText: Tweettext3 });
    if (choice4) choices.push({ text: choice4, nextId: nextId4, tweetText: Tweettext4 });

    await new Promise((resolve) => {
      choices.forEach((ch) => {
        const btn = document.createElement("button");
        btn.textContent = ch.text;

        btn.onclick = async () => {
          if (btn.disabled) return;
          btn.disabled = true;

          addMessageToChat("USER", "あなた", ch.text);
          choicesArea.style.display = "none";
          blurActive();

          if (ch.tweetText) {
            const u = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(ch.tweetText);
            window.open(u, "_blank", "noopener");
          }

          if (ch.nextId) {
            speakerConversations[currentSpeakerId].currentId = parseInt(ch.nextId, 10);
            await displayFromId(parseInt(ch.nextId, 10));
          }
          resolve();
        };

        choicesArea.appendChild(btn);
      });
    });

  // ——— 自由入力 ———
  } else if (input === "自由入力") {
    inputArea.style.display = "block";
    sendBtn.disabled = false;

    padBottomForInput();
    await nextFrame(); scrollToBottom();

    userInput.blur();
    setTimeout(() => userInput.focus(), 80);

    freeInputKeyHandler = (e) => {
      if (e.isComposing) return;
      if (e.key === "Enter") { e.preventDefault(); sendBtn.click(); }
    };
    userInput.addEventListener("keydown", freeInputKeyHandler);

    sendBtn.onclick = async () => {
      if (sendBtn.disabled) return;

      const userText = userInput.value.trim();
      if (!userText) { userInput.focus(); return; }

      sendBtn.disabled = true;

      addMessageToChat("USER", "あなた", userText);
      userInput.value = "";
      blurActive();
      await sleep(300);

      if (answer) {
        const ok = answer.split("|").map(s => s.trim());
        if (ok.includes(userText)) { await proceed(TrueId); return; }
        if (NGid) { await proceed(NGid); return; }
        sendBtn.disabled = false; userInput.focus(); return;
      } else {
        if (TrueId) { await proceed(TrueId); return; }
        sendBtn.disabled = false; userInput.focus(); return;
      }
    };

    async function proceed(nextId) {
      sendBtn.onclick = null;
      if (freeInputKeyHandler) { userInput.removeEventListener("keydown", freeInputKeyHandler); freeInputKeyHandler = null; }
      inputArea.style.display = "none";
      padBottomForInput();
      showTypingIndicator(false);
      await sleep(getTypingWaitTime());
      hideTypingIndicator();
      if (nextId) {
        speakerConversations[currentSpeakerId].currentId = parseInt(nextId, 10);
        await displayFromId(parseInt(nextId, 10));
      }
    }
  }
}

/* =========================================
   表示ヘルパ
========================================= */
function addMessageToChat(speakerId, speakerName, text, image="", imageURL="") {
  if (!speakerConversations[currentSpeakerId]) {
    speakerConversations[currentSpeakerId] = { speakerName: speakerId, messages: [], currentId: null };
  }

  const now = getCurrentTimeString();

  speakerConversations[currentSpeakerId].messages.push({
    speakerName, text, image, imageURL, timestamp: now
  });

  const row = document.createElement("div");
  row.className = "message-row " + (speakerName === "あなた" ? "message-right" : "message-left");

  if (speakerName !== "あなた") {
    const iconDiv = document.createElement("div");
    iconDiv.className = getSpeakerIconClassName(speakerId);
    row.appendChild(iconDiv);
  }

  const wrap = document.createElement("div"); wrap.className = "bubble-wrapper";
  const bubble = document.createElement("div"); bubble.className = "message-bubble";
  bubble.innerHTML = image === "ON" ? `<img src="${imageURL}" style="max-width: 100%; height: auto;">`
                                    : text.replace(/\n/g, "<br>");
  wrap.appendChild(bubble);

  const meta = document.createElement("div"); meta.classList.add("metadata");
  if (speakerName === "あなた") {
    meta.classList.add("metadata-user"); meta.innerHTML = `<div>既読</div><div>${now}</div>`;
  } else {
    meta.classList.add("metadata-speaker"); meta.innerHTML = `<div>${now}</div>`;
  }
  wrap.appendChild(meta);

  row.appendChild(wrap);
  messageContainer.appendChild(row);

  // ダミー行が末尾にあることを保証（初回のみ追加）
  ensureBottomSpacer();
  messageContainer.scrollTop = messageContainer.scrollHeight;
}

/* =========================================
   タイピング
========================================= */
function showTypingIndicator(isUserSide=false) {
  hideTypingIndicator();
  typingIndicatorDiv = document.createElement("div");
  typingIndicatorDiv.className = isUserSide ? "message-row message-right typing-indicator"
                                            : "message-row message-left typing-indicator";
  if (!isUserSide) {
    const iconDiv = document.createElement("div");
    iconDiv.className = getSpeakerIconClassName(currentSpeakerId);
    typingIndicatorDiv.appendChild(iconDiv);
  }
  const bubble = document.createElement("div");
  bubble.className = "message-bubble"; bubble.innerHTML = ".";
  typingIndicatorDiv.appendChild(bubble);
  messageContainer.appendChild(typingIndicatorDiv);
  messageContainer.scrollTop = messageContainer.scrollHeight;

  let states = [".","..","..."]; let cycle = 0; let i = 0;
  typingIndicatorInterval = setInterval(() => {
    i = (i+1) % states.length; bubble.innerHTML = states[i];
    if (i === states.length-1) { cycle++; if (cycle >= 2) { clearInterval(typingIndicatorInterval); typingIndicatorInterval = null; } }
    messageContainer.scrollTop = messageContainer.scrollHeight;
  }, 500);
}
function hideTypingIndicator() {
  if (typingIndicatorInterval) { clearInterval(typingIndicatorInterval); typingIndicatorInterval = null; }
  if (typingIndicatorDiv && typingIndicatorDiv.parentNode) {
    typingIndicatorDiv.parentNode.removeChild(typingIndicatorDiv); typingIndicatorDiv = null;
  }
}

/* =========================================
   小物
========================================= */
function getSpeakerIconClassName(spId) {
  if (!spId || spId === "USER") return "";
  const id = spId.toUpperCase();
  if (id === "SP001") return "icon sp001-icon";
  if (id === "SP002") return "icon sp002-icon";
  return "icon speaker-icon";
}
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
function getDelayForMessage(msg){ const t=75, n=msg?.length||1, base=n*t, f=Math.random()*(1.6-1.0)+1.0; return Math.floor(base*f); }
function getTypingWaitTime(){ const min=1200, max=2500; return Math.floor(Math.random()*(max-min+1))+min; }
function getCurrentTimeString(){ const n=new Date(), h=String(n.getHours()).padStart(2,"0"), m=String(n.getMinutes()).padStart(2,"0"); return `${h}:${m}`; }

/* 入力UIの高さぶんの余白をCSS変数とダミー行に反映 */
function padBottomForInput(){
  if(!inputArea||!messageContainer) return;
  const h = inputArea.getBoundingClientRect().height || 0;
  const pad = h + 8;
  messageContainer.style.paddingBottom = `${pad}px`;
  document.documentElement.style.setProperty("--input-h", `${pad}px`);
  ensureBottomSpacer(pad);
}

/* 末尾に高さ可変のスペーサーを常駐させる */
function ensureBottomSpacer(heightPx){
  let spacer = document.getElementById("bottomSpacer");
  if (!spacer) {
    spacer = document.createElement("div");
    spacer.id = "bottomSpacer";
    messageContainer.appendChild(spacer);
  }
  if (heightPx != null) spacer.style.height = `${heightPx}px`;
}

function blurActive(){
  if (document.activeElement && typeof document.activeElement.blur === "function") {
    document.activeElement.blur();
  }
}
