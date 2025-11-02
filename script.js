/* =========================================
   1) グローバル変数・定義
========================================= */
const SPREADSHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOpH43k0f6Cc0Qn1gzXsnJNDybSce7CTW1hOWBgvTJIfTPuaZsEpcbO1u9E7CIQSSGzAHa4ZST7fFw/pub?gid=1835455716&single=true&output=csv"; // 闇バイト
// "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOpH43k0f6Cc0Qn1gzXsnJNDybSce7CTW1hOWBgvTJIfTPuaZsEpcbO1u9E7CIQSSGzAHa4ZST7fFw/pub?output=csv"; // 山野井

let conversations = [];
let currentSpeakerId = null;
let speakerConversations = {};
let displayedSpeakerIds = [];
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

/* =========================================
   1') 100vh対策のCSS変数更新
========================================= */
function setVhVar() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty("--vh", `${vh}px`);
}
window.addEventListener("resize", setVhVar);
window.addEventListener("orientationchange", setVhVar);
setVhVar();

/* =========================================
   2) ページロード時: CSVを取得
========================================= */
window.addEventListener("load", async () => {
  messageContainer.textContent = "データ取得中...";

  try {
    const response = await fetch(SPREADSHEET_URL);
    const csvText = await response.text();
    const rows = csvText.split("\n").map((r) => r.split(","));

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < 28) continue;

      const id = parseInt(row[0], 10);
      if (!id) continue;

      const speakerName      = (row[1]  || "").trim();
      const message          = (row[2]  || "").trim();
      const input            = (row[3]  || "").trim();
      const answer           = (row[4]  || "").trim();
      const TrueId           = (row[5]  || "").trim();
      const NGid             = (row[6]  || "").trim();
      const choice1          = (row[7]  || "").trim();
      const choice2          = (row[8]  || "").trim();
      const choice3          = (row[9]  || "").trim();
      const choice4          = (row[10] || "").trim();
      const nextId1          = (row[11] || "").trim();
      const nextId2          = (row[12] || "").trim();
      const nextId3          = (row[13] || "").trim();
      const nextId4          = (row[14] || "").trim();
      const speakerId        = (row[15] || "").trim();
      const waittime_seconds = (row[16] || "").trim();
      const readstatus       = (row[17] || "").trim();

      const imageRaw   = (row[18] || "");
      const imageURLRaw = (row[19]  || "");
      const image    = imageRaw.replace(/\r/g, "").trim();
      const imageURL = imageURLRaw.replace(/\r/g, "").trim();

      const choice1URL  = (row[20] || "").trim();
      const Tweettext1  = (row[21] || "").trim();
      const choice2URL  = (row[22] || "").trim();
      const Tweettext2  = (row[23] || "").trim();
      const choice3URL  = (row[24] || "").trim();
      const Tweettext3  = (row[25] || "").trim();
      const choice4URL  = (row[26] || "").trim();
      const Tweettext4  = (row[27] || "").trim();

      conversations.push({
        id,
        speakerName,
        speakerId,
        message,
        input,
        answer,
        TrueId,
        NGid,
        choice1,
        choice2,
        choice3,
        choice4,
        nextId1,
        nextId2,
        nextId3,
        nextId4,
        waittime_seconds,
        readstatus,
        image,
        imageURL,
        choice1URL,
        Tweettext1,
        choice2URL,
        Tweettext2,
        choice3URL,
        Tweettext3,
        choice4URL,
        Tweettext4
      });
    }

    conversations.sort((a, b) => a.id - b.id);

    for (const c of conversations) {
      if (c.speakerId && c.speakerId !== "USER") {
        const isUnread = (c.readstatus === "unread");
        addSpeakerToList(c.speakerId, c.speakerName, isUnread);
        break;
      }
    }

    messageContainer.textContent = "";

  } catch (err) {
    console.error(err);
    messageContainer.textContent =
      "データ取得失敗。URLや公開設定などを確認してください。";
  }

  // サイドバートグル（ドロワー用にbodyクラスを付け外し）
  sidebarToggleBtn.addEventListener("click", () => {
    talkList.classList.toggle("open");
    const isOpen = talkList.classList.contains("open");
    document.body.classList.toggle("drawer-open", isOpen);
  });

  // 左ボタン例
  addBtn.addEventListener("click", () => {
    alert("左ボタンがクリックされました（例）");
  });

  // 入力エリア高さぶんの下余白をメッセージ領域に確保
  padBottomForInput();
});

/* 入力エリア高さ監視で下余白調整 */
const inputResizeObserver = new ResizeObserver(padBottomForInput);
inputResizeObserver.observe(inputArea);

/* =========================================
   2') 既存 .talk-item を探す
========================================= */
function findTalkItemById(speakerId) {
  const items = document.querySelectorAll(".talk-item");
  for (const it of items) if (it.dataset.speakerId === speakerId) return it;
  return null;
}

/* =========================================
   サイドバー未読インジケータ更新
========================================= */
function updateSidebarToggleUnreadIndicator() {
  const unreadIcons = talkList.querySelectorAll(".unread-icon");
  if (unreadIcons.length > 0) {
    if (!document.getElementById("sidebarUnreadIndicator")) {
      const indicator = document.createElement("div");
      indicator.id = "sidebarUnreadIndicator";
      indicator.className = "sidebar-unread";
      sidebarToggleBtn.appendChild(indicator);
    }
  } else {
    const indicator = document.getElementById("sidebarUnreadIndicator");
    if (indicator) indicator.remove();
  }
}

/* =========================================
   3) サイドバーにスピーカー追加
========================================= */
function addSpeakerToList(speakerId, speakerName, unread = false) {
  const existingItem = findTalkItemById(speakerId);
  if (existingItem) {
    if (unread && !existingItem.querySelector(".unread-icon")) {
      const unreadIcon = document.createElement("div");
      unreadIcon.className = "unread-icon";
      existingItem.appendChild(unreadIcon);
    }
    updateSidebarToggleUnreadIndicator();
    return;
  }

  const item = document.createElement("div");
  item.className = "talk-item";
  item.dataset.speakerId = speakerId;

  const nameDiv = document.createElement("div");
  nameDiv.className = "talk-item-name";
  nameDiv.textContent = speakerName;
  item.appendChild(nameDiv);

  if (unread) {
    const unreadIcon = document.createElement("div");
    unreadIcon.className = "unread-icon";
    item.appendChild(unreadIcon);
  }

  item.addEventListener("click", () => {
    const icon = item.querySelector(".unread-icon");
    if (icon) {
      icon.remove();
      updateSidebarToggleUnreadIndicator();
    }
    startConversation(speakerId);

    // ドロワーは閉じる
    if (talkList.classList.contains("open")) {
      talkList.classList.remove("open");
      document.body.classList.remove("drawer-open");
    }
  });

  talkList.appendChild(item);
  updateSidebarToggleUnreadIndicator();
}

/* =========================================
   4) 会話開始
========================================= */
async function startConversation(speakerId) {
  if (currentSpeakerId === speakerId && isConversationRunning) return;

  isConversationRunning = true;
  currentSpeakerId = speakerId;

  if (isSPid(speakerId)) disableAllSpeakers();

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

  if (!speakerConversations[speakerId].currentId) {
    isConversationRunning = false;
    return;
  }

  await displayFromId(speakerConversations[speakerId].currentId);

  isConversationRunning = false;
}

/* =========================================
   5) 過去ログ再描画
========================================= */
function restoreConversationHistory(speakerId) {
  const info = speakerConversations[speakerId];
  if (!info) return;

  for (const msg of info.messages) {
    const rowDiv = document.createElement("div");
    rowDiv.className =
      "message-row " + (msg.speakerName === "あなた" ? "message-right" : "message-left");

    if (msg.speakerName !== "あなた") {
      const iconDiv = document.createElement("div");
      iconDiv.className = getSpeakerIconClassName(speakerId);
      rowDiv.appendChild(iconDiv);
    }

    const wrapperDiv = document.createElement("div");
    wrapperDiv.className = "bubble-wrapper";

    const bubbleDiv = document.createElement("div");
    bubbleDiv.className = "message-bubble";

    if (msg.image === "ON") {
      bubbleDiv.innerHTML = `<img src="${msg.imageURL}" style="max-width: 100%; height:auto;">`;
    } else {
      bubbleDiv.innerHTML = msg.text.replace(/\n/g, "<br>");
    }
    wrapperDiv.appendChild(bubbleDiv);

    const metaDiv = document.createElement("div");
    metaDiv.classList.add("metadata");
    if (msg.speakerName === "あなた") {
      metaDiv.classList.add("metadata-user");
      metaDiv.innerHTML = `<div>既読</div><div>${msg.timestamp || "--:--"}</div>`;
    } else {
      metaDiv.classList.add("metadata-speaker");
      metaDiv.innerHTML = `<div>${msg.timestamp || "--:--"}</div>`;
    }
    wrapperDiv.appendChild(metaDiv);

    rowDiv.appendChild(wrapperDiv);
    messageContainer.appendChild(rowDiv);
  }
  messageContainer.scrollTop = messageContainer.scrollHeight;
}

/* =========================================
   6) displayFromId
========================================= */
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

      addMessageToChat(
        rowSpeakerId,
        rowSpeakerName,
        currentRow.message,
        currentRow.image,
        currentRow.imageURL
      );

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

      if (currentRow.input ||
          currentRow.choice1 || currentRow.choice2 ||
          currentRow.choice3 || currentRow.choice4) {
        await handleUserTurn(currentRow);
      }
      break;

    } else {
      if (isSPid(initialSpeakerId) && isSPid(rowSpeakerId) && initialSpeakerId !== rowSpeakerId) {
        enableAllSpeakers();
      }

      if (rowSpeakerId && rowSpeakerId !== "USER") {
        if (!speakerConversations[rowSpeakerId]) {
          speakerConversations[rowSpeakerId] = {
            speakerName: rowSpeakerName || rowSpeakerId,
            messages: [],
            currentId: currentRow.id
          };
        } else {
          speakerConversations[rowSpeakerId].currentId = currentRow.id;
        }
        const isUnread = (currentRow.readstatus === "unread");
        addSpeakerToList(rowSpeakerId, rowSpeakerName, isUnread);
      }

      speakerConversations[initialSpeakerId].currentId = currentRow.id;
      break;
    }
  }
}

/* =========================================
   7) ユーザー操作 (選択肢/自由入力)
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

  // ——— 選択肢 ———
  if (choice1 || choice2 || choice3 || choice4) {
    choicesArea.innerHTML = "";
    choicesArea.style.display = "block";

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

          if (ch.tweetText) {
            const tweetBase = "https://twitter.com/intent/tweet";
            const fullURL = tweetBase + "?text=" + encodeURIComponent(ch.tweetText);
            window.open(fullURL, "_blank", "noopener");
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

  // ——— 自由入力（自動進行しない） ———
  } else if (input === "自由入力") {
    inputArea.style.display = "block";

    // 送信ボタンの動作を上書き（空送信は無視）
    sendBtn.onclick = async () => {
      if (sendBtn.disabled) return;

      const userText = userInput.value.trim();
      if (!userText) { userInput.focus(); return; }

      sendBtn.disabled = true;

      // ユーザー発言を表示
      addMessageToChat("USER", "あなた", userText);
      userInput.value = "";
      await sleep(300);

      // バリデーションあり
      if (answer) {
        const validAnswers = answer.split("|").map(s => s.trim());
        if (validAnswers.includes(userText)) {
          await proceed(TrueId);
        } else if (NGid) {
          await proceed(NGid);
        } else {
          // 不正解かつNG遷移なし → 再入力待ち
          sendBtn.disabled = false;
        }
      } else {
        // バリデーションなし → TrueId があれば進む。無ければ待機
        if (TrueId) {
          await proceed(TrueId);
        } else {
          sendBtn.disabled = false;
        }
      }
    };

    // 共通遷移。自動では呼ばない
    async function proceed(nextId) {
      inputArea.style.display = "none";
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
   8) メッセージ表示 & 履歴追加
========================================= */
function addMessageToChat(speakerId, speakerName, text, image = "", imageURL = "") {
  if (!speakerConversations[currentSpeakerId]) {
    speakerConversations[currentSpeakerId] = { speakerName: speakerId, messages: [], currentId: null };
  }

  const nowString = getCurrentTimeString();

  speakerConversations[currentSpeakerId].messages.push({
    speakerName, text, image, imageURL, timestamp: nowString
  });

  const rowDiv = document.createElement("div");
  rowDiv.className =
    "message-row " + (speakerName === "あなた" ? "message-right" : "message-left");

  if (speakerName !== "あなた") {
    const iconDiv = document.createElement("div");
    iconDiv.className = getSpeakerIconClassName(speakerId);
    rowDiv.appendChild(iconDiv);
  }

  const wrapperDiv = document.createElement("div");
  wrapperDiv.className = "bubble-wrapper";

  const bubbleDiv = document.createElement("div");
  bubbleDiv.className = "message-bubble";

  if (image === "ON") {
    bubbleDiv.innerHTML = `<img src="${imageURL}" style="max-width: 100%; height: auto;">`;
  } else {
    bubbleDiv.innerHTML = text.replace(/\n/g, "<br>");
  }
  wrapperDiv.appendChild(bubbleDiv);

  const metaDiv = document.createElement("div");
  metaDiv.classList.add("metadata");
  if (speakerName === "あなた") {
    metaDiv.classList.add("metadata-user");
    metaDiv.innerHTML = `<div>既読</div><div>${nowString}</div>`;
  } else {
    metaDiv.classList.add("metadata-speaker");
    metaDiv.innerHTML = `<div>${nowString}</div>`;
  }
  wrapperDiv.appendChild(metaDiv);

  rowDiv.appendChild(wrapperDiv);
  messageContainer.appendChild(rowDiv);
  messageContainer.scrollTop = messageContainer.scrollHeight;
}

/* =========================================
   9) タイピング演出
========================================= */
function showTypingIndicator(isUserSide = false) {
  hideTypingIndicator();

  typingIndicatorDiv = document.createElement("div");
  typingIndicatorDiv.className = isUserSide
    ? "message-row message-right typing-indicator"
    : "message-row message-left typing-indicator";

  if (!isUserSide) {
    const iconDiv = document.createElement("div");
    iconDiv.className = getSpeakerIconClassName(currentSpeakerId);
    typingIndicatorDiv.appendChild(iconDiv);
  }

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.innerHTML = ".";

  typingIndicatorDiv.appendChild(bubble);
  messageContainer.appendChild(typingIndicatorDiv);
  messageContainer.scrollTop = messageContainer.scrollHeight;

  let states = [".", "..", "..."];
  let cycleCount = 0;
  let stateIndex = 0;

  typingIndicatorInterval = setInterval(() => {
    stateIndex++;
    if (stateIndex >= states.length) { stateIndex = 0; cycleCount++; }
    bubble.innerHTML = states[stateIndex];
    if (cycleCount >= 2 && stateIndex === states.length - 1) {
      clearInterval(typingIndicatorInterval);
      typingIndicatorInterval = null;
    }
    messageContainer.scrollTop = messageContainer.scrollHeight;
  }, 500);
}

function hideTypingIndicator() {
  if (typingIndicatorInterval) { clearInterval(typingIndicatorInterval); typingIndicatorInterval = null; }
  if (typingIndicatorDiv && typingIndicatorDiv.parentNode) {
    typingIndicatorDiv.parentNode.removeChild(typingIndicatorDiv);
    typingIndicatorDiv = null;
  }
}

/* =========================================
   10) アイコン切り替え関数
========================================= */
function getSpeakerIconClassName(spId) {
  if (!spId || spId === "USER") return "";
  const idUpper = spId.toUpperCase();
  if (idUpper === "SP001") return "icon sp001-icon";
  else if (idUpper === "SP002") return "icon sp002-icon";
  else return "icon speaker-icon";
}

/* =========================================
   補助関数
========================================= */
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function getDelayForMessage(msg) {
  const perCharTime = 75;
  const length = msg?.length || 1;
  const base = length * perCharTime;
  const factor = Math.random() * (1.6 - 1.0) + 1.0;
  return Math.floor(base * factor);
}

function getTypingWaitTime() {
  const min = 1200, max = 2500;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getCurrentTimeString() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2,"0");
  const mm = String(now.getMinutes()).padStart(2,"0");
  return `${hh}:${mm}`;
}

function disableAllSpeakers() { talkList.style.pointerEvents = "none"; talkList.style.opacity = "0.6"; }
function enableAllSpeakers() { talkList.style.pointerEvents = "auto"; talkList.style.opacity = ""; }
function isSPid(spId) { return !!spId && spId.toUpperCase().startsWith("SP"); }

/* メッセージ領域の下余白を入力欄の高さに合わせる */
function padBottomForInput() {
  if (!inputArea || !messageContainer) return;
  const h = inputArea.getBoundingClientRect().height || 0;
  messageContainer.style.paddingBottom = `${h + 8}px`;
}
