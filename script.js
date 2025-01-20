/* =========================================
   1) グローバル変数・定義
========================================= */

// CSVの公開URL（必要なら書き換えてください）
const SPREADSHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOpH43k0f6Cc0Qn1gzXsnJNDybSce7CTW1hOWBgvTJIfTPuaZsEpcbO1u9E7CIQSSGzAHa4ZST7fFw/pub?output=csv";

// 全会話データ (id順で並べる)
let conversations = [];

// 現在選択中の speaker_id
let currentSpeakerId = null;

// 各スピーカーの会話履歴
let speakerConversations = {};

// サイドバーに表示中の speaker_id
let displayedSpeakerIds = [];

// タイピング演出用
let typingIndicatorDiv = null;
let typingIndicatorInterval = null;

// DOM要素
const talkList = document.getElementById("talkList");
const messageContainer = document.getElementById("messageContainer");
const inputArea = document.getElementById("inputArea");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const choicesArea = document.getElementById("choicesArea");

// 追加: 会話の二重実行を防ぐフラグ
let isConversationRunning = false;

/* =========================================
   2) ページロード時: CSVを取得
========================================= */
window.addEventListener("load", async () => {
  messageContainer.textContent = "データ取得中...";

  try {
    const response = await fetch(SPREADSHEET_URL);
    const csvText = await response.text();
    const rows = csvText.split("\n").map((r) => r.split(","));

    console.log("[DEBUG] rows.length =", rows.length);

    // 1行目はヘッダー想定
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      console.log(`[DEBUG] Row #${i}`, row, " length=", row.length);

      // 28列以上あるかチェック (最低でも AB列=27 が必要と想定)
      if (row.length < 28) {
        console.log("[DEBUG] row.length < 28 → スキップ:", row);
        continue;
      }
      
      const id = parseInt(row[0], 10);
      if (!id) continue;

      // A=0, B=1, C=2, ... のカラムに対応
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

      // S列/T列 (image, imageURL)
      const imageRaw = (row[18] || "");
      const imageURLRaw = (row[19] || "");
      const image = imageRaw.replace(/\r/g, "").trim();
      let imageURL = imageURLRaw.replace(/\r/g, "").trim();

      // U列～AB列
      const choice1URL = (row[20] || "").trim();   // U列
      const Tweettext1 = (row[21] || "").trim();   // V列
      const choice2URL = (row[22] || "").trim();   // W列
      const Tweettext2 = (row[23] || "").trim();   // X列
      const choice3URL = (row[24] || "").trim();   // Y列
      const Tweettext3 = (row[25] || "").trim();   // Z列
      const choice4URL = (row[26] || "").trim();   // AA列
      const Tweettext4 = (row[27] || "").trim();   // AB列

      // [DEBUG] 確認ログ
      console.log(`[DEBUG] i=${i} image=${image}, imageURL=${imageURL}`);

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

        // ここで読み込んだけど、URLは使わない
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

    // ID昇順
    conversations.sort((a, b) => a.id - b.id);

    // "最初のスピーカー1人" をサイドバーに追加
    for (const c of conversations) {
      if (c.speakerId && c.speakerId !== "USER") {
        const isUnread = (c.readstatus === "unread");
        addSpeakerToList(c.speakerId, c.speakerName, isUnread);
        break;
      }
    }

    messageContainer.textContent = "スピーカーを選んでください。";

  } catch (err) {
    console.error(err);
    messageContainer.textContent =
      "データ取得失敗。URLや公開設定などを確認してください。";
  }
});

/* =========================================
   2') すでにサイドバーにある .talk-item を探す
========================================= */
function findTalkItemById(speakerId) {
  const items = document.querySelectorAll(".talk-item");
  for (const it of items) {
    if (it.dataset.speakerId === speakerId) {
      return it;
    }
  }
  return null;
}

/* =========================================
   3) サイドバーにスピーカー追加
========================================= */
function addSpeakerToList(speakerId, speakerName, unread = false) {
  const existingItem = findTalkItemById(speakerId);
  if (existingItem) {
    if (unread) {
      if (!existingItem.querySelector(".unread-icon")) {
        const unreadIcon = document.createElement("div");
        unreadIcon.className = "unread-icon";
        existingItem.appendChild(unreadIcon);
      }
    }
    return;
  }

  displayedSpeakerIds.push(speakerId);

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
    if (icon) icon.remove();
    startConversation(speakerId);
  });

  talkList.appendChild(item);
}

/* =========================================
   4) 会話開始
========================================= */
async function startConversation(speakerId) {
  // すでに同じスピーカーで会話実行中なら何もしない
  if (currentSpeakerId === speakerId && isConversationRunning) {
    return;
  }

  // 会話フロー開始
  isConversationRunning = true;

  currentSpeakerId = speakerId;

  // 画面クリア
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
    // 会話フロー終了
    isConversationRunning = false;
    return;
  }

  await displayFromId(speakerConversations[speakerId].currentId);

  // 会話フロー終了
  isConversationRunning = false;
}

/* =========================================
   5) 過去ログ再描画
========================================= */
function restoreConversationHistory(speakerId) {
  const info = speakerConversations[speakerId];
  if (!info) return;

  const history = info.messages;
  for (const msg of history) {
    const rowDiv = document.createElement("div");
    rowDiv.className =
      "message-row " + (msg.speakerName === "あなた" ? "message-right" : "message-left");

    const bubbleDiv = document.createElement("div");
    bubbleDiv.className = "message-bubble";

    if (msg.image === "ON") {
      bubbleDiv.innerHTML = `<img src="${msg.imageURL}" style="max-width: 100%; height:auto;">`;
    } else {
      bubbleDiv.innerHTML = msg.text.replace(/\n/g, "<br>");
    }

    rowDiv.appendChild(bubbleDiv);
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
    // もし途中でスピーカーが切り替わったら停止
    if (currentSpeakerId !== initialSpeakerId) break;

    const waitSec = parseInt(currentRow.waittime_seconds || "0", 10);
    if (waitSec > 0) {
      await sleep(waitSec * 1000);
    } else {
      await sleep(getDelayForMessage(currentRow.message));
    }

    const rowSpeakerId = currentRow.speakerId;
    const rowSpeakerName = currentRow.speakerName;
    const nextRow = conversations.find(c => c.id === currentRow.id + 1);

    console.log("[DEBUG] displayFromId - currentRow:", currentRow);

    // A) 同じスピーカーID & "USER"でない
    if (rowSpeakerId === initialSpeakerId && rowSpeakerId !== "USER") {
      showTypingIndicator();
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
    }
    // B) USER or speakerIdが無い
    else if (!rowSpeakerId || rowSpeakerId === "USER") {
      speakerConversations[initialSpeakerId].currentId = currentRow.id;

      if (currentRow.message.trim() !== "") {
        showTypingIndicator();
        await sleep(getTypingWaitTime());
        hideTypingIndicator();

        addMessageToChat(
          "USER",
          "あなた",
          currentRow.message,
          currentRow.image,
          currentRow.imageURL
        );
        if (!nextRow) break;
        currentRow = nextRow;
        continue;
      }

      if (
        currentRow.input ||
        currentRow.choice1 || currentRow.choice2 ||
        currentRow.choice3 || currentRow.choice4
      ) {
        await handleUserTurn(currentRow);
      }
      break;
    }
    // C) 別のスピーカー
    else {
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
    input,
    answer,
    TrueId,
    NGid,
    choice1, choice2, choice3, choice4,
    nextId1, nextId2, nextId3, nextId4,

    choice1URL,  // 使わない
    Tweettext1,
    choice2URL,
    Tweettext2,
    choice3URL,
    Tweettext3,
    choice4URL,
    Tweettext4
  } = row;

  // 表示リセット
  inputArea.style.display = "none";
  choicesArea.style.display = "none";
  userInput.value = "";

  // (A) 選択肢がある場合
  if (choice1 || choice2 || choice3 || choice4) {
    choicesArea.innerHTML = "";
    choicesArea.style.display = "block";

    const choices = [];
    if (choice1) {
      choices.push({ text: choice1, nextId: nextId1, tweetText: Tweettext1 });
    }
    if (choice2) {
      choices.push({ text: choice2, nextId: nextId2, tweetText: Tweettext2 });
    }
    if (choice3) {
      choices.push({ text: choice3, nextId: nextId3, tweetText: Tweettext3 });
    }
    if (choice4) {
      choices.push({ text: choice4, nextId: nextId4, tweetText: Tweettext4 });
    }

    await new Promise((resolve) => {
      choices.forEach((ch) => {
        const btn = document.createElement("button");
        btn.textContent = ch.text;

        btn.onclick = async () => {
          // 二重押下防止
          if (btn.disabled) return;
          btn.disabled = true;

          // 他の選択肢ボタンも無効化
          const otherButtons = choicesArea.querySelectorAll("button");
          otherButtons.forEach((b) => (b.disabled = true));

          showTypingIndicator();
          await sleep(getTypingWaitTime());
          hideTypingIndicator();

          // ユーザー発話をチャット欄に追加
          addMessageToChat("USER", "あなた", ch.text);

          // 選択肢コンテナ非表示
          choicesArea.style.display = "none";

          // ツイート処理 (画面遷移)
          if (ch.tweetText) {
            const tweetBase = "https://twitter.com/intent/tweet";
            const fullURL = tweetBase + "?text=" + encodeURIComponent(ch.tweetText);
            window.open(fullURL, "_blank", "noopener");
          }

          // 会話ID遷移
          if (ch.nextId) {
            speakerConversations[currentSpeakerId].currentId = parseInt(ch.nextId, 10);
            await displayFromId(parseInt(ch.nextId, 10));
          }

          resolve();
        };

        choicesArea.appendChild(btn);
      });
    });

  }
  // (B) 自由入力の場合
  else if (input === "自由入力") {
    inputArea.style.display = "flex";

    // 現在の onclick ハンドラを退避
    const originalOnclick = sendBtn.onclick;

    // 新たな onclick を設定
    sendBtn.onclick = async () => {
      // 二重押下防止
      if (sendBtn.disabled) return;
      sendBtn.disabled = true;

      const userText = userInput.value.trim();
      if (!userText) {
        sendBtn.disabled = false; // 再度入力できるように
        return;
      }

      showTypingIndicator();
      await sleep(getTypingWaitTime());
      hideTypingIndicator();

      // ユーザーの発話をチャット欄に表示
      addMessageToChat("USER", "あなた", userText);
      userInput.value = "";

      // 一旦押下無効
      sendBtn.onclick = originalOnclick;

      await sleep(500);
      showTypingIndicator();
      await sleep(getTypingWaitTime());
      hideTypingIndicator();

      // 入力の正解判定
      if (answer) {
        const validAnswers = answer.split("|");
        if (validAnswers.includes(userText)) {
          // 正解
          if (TrueId) {
            speakerConversations[currentSpeakerId].currentId = parseInt(TrueId, 10);
            await displayFromId(parseInt(TrueId, 10));
          }
        } else {
          // 不正解
          if (NGid) {
            speakerConversations[currentSpeakerId].currentId = parseInt(NGid, 10);
            await displayFromId(parseInt(NGid, 10));
          }
        }
      }

      // 処理終了後に再度有効化
      sendBtn.disabled = false;
    };
  }
}

/* =========================================
   8) メッセージ表示 & 履歴追加
========================================= */
function addMessageToChat(speakerId, speakerName, text, image = "", imageURL = "") {
  if (!speakerConversations[currentSpeakerId]) {
    speakerConversations[currentSpeakerId] = {
      speakerName: speakerId,
      messages: [],
      currentId: null
    };
  }

  speakerConversations[currentSpeakerId].messages.push({
    speakerName,
    text,
    image,
    imageURL
  });

  const rowDiv = document.createElement("div");
  rowDiv.className =
    "message-row " + (speakerName === "あなた" ? "message-right" : "message-left");

  const bubbleDiv = document.createElement("div");
  bubbleDiv.className = "message-bubble";

  if (image === "ON") {
    bubbleDiv.innerHTML = `<img src="${imageURL}" style="max-width: 100%; height: auto;">`;
  } else {
    bubbleDiv.innerHTML = text.replace(/\n/g, "<br>");
  }

  rowDiv.appendChild(bubbleDiv);
  messageContainer.appendChild(rowDiv);
  messageContainer.scrollTop = messageContainer.scrollHeight;
}

/* =========================================
   9) タイピング演出
========================================= */
function showTypingIndicator() {
  hideTypingIndicator();
  typingIndicatorDiv = document.createElement("div");
  typingIndicatorDiv.className = "message-row message-left";

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
    if (stateIndex >= states.length) {
      stateIndex = 0;
      cycleCount++;
    }
    bubble.innerHTML = states[stateIndex];
    if (cycleCount >= 2 && stateIndex === states.length - 1) {
      clearInterval(typingIndicatorInterval);
      typingIndicatorInterval = null;
    }
    messageContainer.scrollTop = messageContainer.scrollHeight;
  }, 500);
}

function hideTypingIndicator() {
  if (typingIndicatorInterval) {
    clearInterval(typingIndicatorInterval);
    typingIndicatorInterval = null;
  }
  if (typingIndicatorDiv && typingIndicatorDiv.parentNode) {
    typingIndicatorDiv.parentNode.removeChild(typingIndicatorDiv);
    typingIndicatorDiv = null;
  }
}

/* =========================================
   10) 補助関数
========================================= */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getDelayForMessage(msg) {
  const perCharTime = 75;
  const length = msg.length;
  const base = length * perCharTime;
  const factor = Math.random() * (1.6 - 1.0) + 1.0;
  return Math.floor(base * factor);
}

function getTypingWaitTime() {
  const min = 1200;
  const max = 2500;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
