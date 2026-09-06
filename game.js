const story = window.GAME_STORY;
const rooms = story.rooms;

// Turn this on only while reviewing hitboxes.
const SHOW_HOTSPOT_DEBUG = false;

const state = {
  room: "living",
  visited: new Set(),
  scored: new Set(),
  inventory: new Set(),
  decisions: {},
  flags: {
    introRead: false,
    hasWorkNotebook: false,
    secretUnlocked: false,
    boxOpened: false,
    diaryOpened: false,
    laptopUnlocked: false,
    passwordTheaterSeen: false,
    cabinetOpened: false,
    letterRead: false,
    finaleStarted: false,
  },
  affection: 10,
  suspicion: 0,
};

const els = {
  gameShell: document.querySelector("#gameShell"),
  sceneImage: document.querySelector("#sceneImage"),
  hotspotLayer: document.querySelector("#hotspotLayer"),
  roomTitle: document.querySelector("#roomTitle"),
  affectionValue: document.querySelector("#affectionValue"),
  affectionBar: document.querySelector("#affectionBar"),
  affectionMeter: document.querySelector("#affectionMeter"),
  suspicionValue: document.querySelector("#suspicionValue"),
  suspicionBar: document.querySelector("#suspicionBar"),
  suspicionMeter: document.querySelector("#suspicionMeter"),
  roomMap: document.querySelector("#roomMap"),
  notebookPanel: document.querySelector("#notebookPanel"),
  mapToggle: document.querySelector("#mapToggle"),
  notebookToggle: document.querySelector("#notebookToggle"),
  roomTabs: [...document.querySelectorAll(".room-tab")],
  roomProgress: document.querySelector("#roomProgress"),
  notebookRoom: document.querySelector("#notebookRoom"),
  clueList: document.querySelector("#clueList"),
  inspectModal: document.querySelector("#inspectModal"),
  inspectType: document.querySelector("#inspectType"),
  inspectTitle: document.querySelector("#inspectTitle"),
  inspectMedia: document.querySelector("#inspectMedia"),
  inspectImage: document.querySelector("#inspectImage"),
  inspectText: document.querySelector("#inspectText"),
  inspectActions: document.querySelector("#inspectActions"),
  closeModal: document.querySelector("#closeModal"),
  keepLooking: document.querySelector("#keepLooking"),
  startButton: document.querySelector("#startButton"),
  introOverlay: document.querySelector("#introOverlay"),
  safetyOverlay: document.querySelector("#safetyOverlay"),
  safetyContinue: document.querySelector("#safetyContinue"),
  bridgeOverlay: document.querySelector("#bridgeOverlay"),
  storyOverlay: document.querySelector("#storyOverlay"),
  storyClose: document.querySelector("#storyClose"),
  storyIndex: document.querySelector("#storyIndex"),
  storyTitle: document.querySelector("#storyTitle"),
  storyBody: document.querySelector("#storyBody"),
  storyActions: document.querySelector("#storyActions"),
  theaterOverlay: document.querySelector("#theaterOverlay"),
  theaterSpeaker: document.querySelector("#theaterSpeaker"),
  theaterText: document.querySelector("#theaterText"),
  theaterNext: document.querySelector("#theaterNext"),
  soundToggle: document.querySelector("#soundToggle"),
  endingOverlay: document.querySelector("#endingOverlay"),
  endingLabel: document.querySelector("#endingLabel"),
  endingTitle: document.querySelector("#endingTitle"),
  endingText: document.querySelector("#endingText"),
  restartButton: document.querySelector("#restartButton"),
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function paragraphsHtml(paragraphs = []) {
  return paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
}

function messagesHtml(messages = []) {
  return messages
    .map(
      ([speaker, message]) =>
        `<p class="story-message"><strong>${escapeHtml(speaker)}</strong>${escapeHtml(message)}</p>`,
    )
    .join("");
}

function letterHtml(letter) {
  return `
    <article class="letter-paper" aria-label="信件正文">
      <p class="letter-salutation">${escapeHtml(letter.salutation)}</p>
      <div class="letter-copy">${paragraphsHtml(letter.paragraphs)}</div>
      <footer class="letter-signoff">
        ${letter.signoff.map((line) => `<span>${escapeHtml(line)}</span>`).join("")}
      </footer>
    </article>
  `;
}

function clamp(value) {
  return Math.max(0, Math.min(100, value));
}

function pulseMeter(element) {
  element.classList.remove("meter-pulse");
  requestAnimationFrame(() => element.classList.add("meter-pulse"));
}

function applyReward(reward = {}, scoreKey) {
  if (scoreKey && state.scored.has(scoreKey)) return;
  if (scoreKey) state.scored.add(scoreKey);

  const nextHeart = clamp(state.affection + (reward.heart || 0));
  const nextSuspicion = clamp(state.suspicion + (reward.suspicion || 0));

  if (nextHeart !== state.affection) pulseMeter(els.affectionMeter);
  if (nextSuspicion !== state.suspicion) pulseMeter(els.suspicionMeter);

  state.affection = nextHeart;
  state.suspicion = nextSuspicion;
  renderStatus();
}

function setDrawer(drawer, toggle, isOpen) {
  drawer.classList.toggle("open", isOpen);
  drawer.setAttribute("aria-hidden", String(!isOpen));
  toggle.setAttribute("aria-expanded", String(isOpen));
}

function closeDrawers() {
  setDrawer(els.roomMap, els.mapToggle, false);
  setDrawer(els.notebookPanel, els.notebookToggle, false);
}

function getRenderedSceneBounds() {
  const shell = els.gameShell.getBoundingClientRect();
  const sourceWidth = els.sceneImage.naturalWidth || 1672;
  const sourceHeight = els.sceneImage.naturalHeight || 943;
  const imageFit = window.getComputedStyle(els.sceneImage).objectFit;
  const scale = imageFit === "contain"
    ? Math.min(shell.width / sourceWidth, shell.height / sourceHeight)
    : Math.max(shell.width / sourceWidth, shell.height / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;

  return {
    left: (shell.width - width) / 2,
    top: (shell.height - height) / 2,
    width,
    height,
  };
}

function renderHotspots() {
  const room = rooms[state.room];
  const scene = getRenderedSceneBounds();
  els.hotspotLayer.innerHTML = "";

  room.hotspots.forEach((item) => {
    const regions = item.regions || [item];

    regions.forEach((region) => {
      const button = document.createElement("button");
      button.className = `hotspot${SHOW_HOTSPOT_DEBUG ? " debug" : ""}`;
      button.type = "button";
      const width = (region.w / 100) * scene.width;
      const height = (region.h / 100) * scene.height;
      const left = scene.left + (region.x / 100) * scene.width;
      const top = scene.top + (region.y / 100) * scene.height;
      button.style.left = `${left}px`;
      button.style.top = `${top}px`;
      button.style.setProperty("--hit-w", `${width}px`);
      button.style.setProperty("--hit-h", `${height}px`);
      button.dataset.itemId = item.id;
      if (SHOW_HOTSPOT_DEBUG) {
        button.dataset.debugLabel = region.label || item.title;
        if (left - width / 2 < 8) button.dataset.debugEdge = "left";
      }
      button.setAttribute("aria-label", `调查：${item.title}`);
      button.addEventListener("click", () => inspect(item));
      els.hotspotLayer.appendChild(button);
    });
  });
}

function renderNotebook() {
  const room = rooms[state.room];
  const visited = room.hotspots.filter((item) => state.visited.has(item.id));

  els.roomProgress.textContent = `${visited.length} / ${room.hotspots.length}`;
  els.notebookRoom.textContent = room.title;
  els.clueList.innerHTML = "";

  if (!visited.length) {
    const empty = document.createElement("li");
    empty.className = "empty-clue";
    empty.textContent = "尚未记录线索";
    els.clueList.appendChild(empty);
    return;
  }

  visited.forEach((item) => {
    const clue = document.createElement("li");
    clue.textContent = item.title;
    els.clueList.appendChild(clue);
  });
}

function renderStatus() {
  els.affectionValue.textContent = state.affection;
  els.affectionBar.style.width = `${state.affection}%`;
  els.suspicionValue.textContent = state.suspicion;
  els.suspicionBar.style.width = `${state.suspicion}%`;
}

function renderRoomTabs() {
  els.roomTabs.forEach((button) => {
    const roomKey = button.dataset.room;
    const isSecretLocked = roomKey === "secret" && !state.flags.secretUnlocked;
    button.classList.toggle("active", roomKey === state.room);
    button.classList.toggle("locked", isSecretLocked);
    button.setAttribute("aria-disabled", String(isSecretLocked));
  });
}

function render() {
  const room = rooms[state.room];
  els.sceneImage.src = room.image;
  els.sceneImage.alt = `邻居家的${room.title}`;
  els.gameShell.style.setProperty("--scene-background", `url("${room.image}")`);
  els.roomTitle.textContent = room.title;
  renderStatus();
  renderRoomTabs();
  renderHotspots();
  renderNotebook();
}

function setRoom(roomKey) {
  if (!rooms[roomKey]) return;

  if (roomKey === "secret" && !state.flags.secretUnlocked) {
    closeDrawers();
    if (state.flags.hasWorkNotebook) {
      showNotebookDecision();
    } else {
      showInspect({
        title: "走廊尽头的门",
        type: "未解锁",
        paragraphs: ["门把手上没有灰，应该是不久前才被人擦拭过。现在还没有理由推开它。"],
      });
    }
    return;
  }

  if (roomKey === state.room) {
    closeDrawers();
    return;
  }

  state.room = roomKey;
  closeDrawers();
  hideInspect();
  render();
}

function setInspectActions(actions = []) {
  els.inspectActions.innerHTML = "";
  actions.forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `note-choice${action.primary ? " primary" : ""}`;
    button.textContent = action.label;
    button.disabled = Boolean(action.disabled);
    if (action.hint) button.dataset.hint = action.hint;
    button.addEventListener("click", action.onClick);
    els.inspectActions.appendChild(button);
  });
}

function showInspect({
  title,
  type = `${rooms[state.room].title} · 线索`,
  paragraphs,
  actions = [],
  image = "",
  imageAlt = "",
}) {
  closeDrawers();
  els.inspectType.textContent = type;
  els.inspectTitle.textContent = title;
  els.inspectModal.classList.toggle("has-image", Boolean(image));
  els.inspectMedia.hidden = !image;
  if (image) {
    els.inspectImage.src = image;
    els.inspectImage.alt = imageAlt;
  } else {
    els.inspectImage.removeAttribute("src");
    els.inspectImage.alt = "";
  }
  els.inspectText.innerHTML = paragraphsHtml(paragraphs);
  setInspectActions(actions);
  els.inspectModal.classList.add("show");
  els.inspectModal.setAttribute("aria-hidden", "false");
}

function hideInspect() {
  els.inspectModal.classList.remove("show");
  els.inspectModal.setAttribute("aria-hidden", "true");
}

function showItemResult(item, resultText) {
  showInspect({ title: item.title, paragraphs: [...item.paragraphs, resultText] });
  renderNotebook();
}

function inspectLivingKey(item) {
  if (state.inventory.has("oldKey")) {
    showInspect({ title: item.title, paragraphs: [...item.paragraphs, "旧铜钥匙已经收在你的口袋里。"] });
    return;
  }

  showInspect({
    title: item.title,
    paragraphs: item.paragraphs,
    actions: [
      {
        label: "拿起来看看",
        primary: true,
        onClick: () => {
          state.inventory.add("oldKey");
          applyReward({ suspicion: 4 }, "choice:living-key:take");
          showItemResult(item, "钥匙比想象中沉，末端沾着一点深色木屑。你把它收进掌心。");
        },
      },
      {
        label: "先放回原处",
        onClick: () => {
          applyReward({ suspicion: 1 }, "choice:living-key:leave");
          showItemResult(item, "你把钥匙留在托盘里，强迫自己不要替一件普通物品编造秘密。");
        },
      },
    ],
  });
}

function inspectCake(item) {
  const choice = state.decisions.cake;
  if (choice) {
    const result = choice === "eat"
      ? "奶油比店里的配方更轻，甜味刚好停在你喜欢的位置。"
      : "你把叉子放回去。食物没有错，只是眼前的一切恰好得令人难以下咽。";
    showItemResult(item, result);
    return;
  }

  showInspect({
    title: item.title,
    paragraphs: item.paragraphs,
    actions: [
      {
        label: "尝一口",
        primary: true,
        onClick: () => {
          state.decisions.cake = "eat";
          applyReward({ heart: 6, suspicion: 1 }, "choice:cake:eat");
          showItemResult(item, "奶油比店里的配方更轻，甜味刚好停在你喜欢的位置。");
        },
      },
      {
        label: "先不吃",
        onClick: () => {
          state.decisions.cake = "leave";
          applyReward({ suspicion: 2 }, "choice:cake:leave");
          showItemResult(item, "你把叉子放回去。食物没有错，只是眼前的一切恰好得令人难以下咽。");
        },
      },
    ],
  });
}

function inspectBedBox(item) {
  if (state.flags.boxOpened) {
    showInspect({ title: "打开箱子后", paragraphs: [...item.paragraphs, ...item.reveal] });
    return;
  }

  if (!state.inventory.has("oldKey")) {
    showInspect({
      title: item.title,
      paragraphs: [...item.paragraphs, "箱子上着锁。锁孔与你在客厅看见的旧铜钥匙很像。"],
    });
    return;
  }

  showInspect({
    title: item.title,
    paragraphs: item.paragraphs,
    actions: [
      {
        label: "用旧铜钥匙打开",
        primary: true,
        onClick: () => {
          state.flags.boxOpened = true;
          showInspect({ title: "打开箱子后", paragraphs: [...item.paragraphs, ...item.reveal] });
        },
      },
    ],
  });
}

function inspectDiary(item) {
  if (state.flags.diaryOpened) {
    showInspect({ title: item.title, paragraphs: [...item.paragraphs, ...item.reveal] });
    return;
  }

  showInspect({
    title: item.title,
    paragraphs: item.paragraphs,
    actions: [
      {
        label: "翻开日记",
        primary: true,
        onClick: () => {
          state.flags.diaryOpened = true;
          applyReward({ heart: 8, suspicion: 12 }, "choice:diary:open");
          showInspect({ title: item.title, paragraphs: [...item.paragraphs, ...item.reveal] });
        },
      },
      {
        label: "合上抽屉",
        onClick: () => {
          applyReward({ heart: 1 }, "choice:diary:close");
          showItemResult(item, "你把日记推回去。秘密被尊重以后并不会消失，只是重新获得了沉默的外壳。");
        },
      },
    ],
  });
}

function inspectWorkNotebook(item) {
  const actions = state.flags.hasWorkNotebook
    ? [{ label: "决定接下来怎么做", primary: true, onClick: showNotebookDecision }]
    : [
        {
          label: "拿走工作记事本",
          primary: true,
          onClick: () => {
            state.flags.hasWorkNotebook = true;
            state.inventory.add("workNotebook");
            showNotebookDecision();
            renderNotebook();
          },
        },
      ];
  showInspect({ title: item.title, paragraphs: item.paragraphs, actions });
}

function inspectLaptop(item) {
  if (state.flags.laptopUnlocked) {
    showInspect({ title: "解锁电脑后", paragraphs: [...item.paragraphs, ...item.reveal] });
    return;
  }

  showInspect({
    title: item.title,
    paragraphs: [
      ...item.paragraphs,
      "你没有继续猜，也没有在聊天框里留下任何问题。等他站在你面前时，你会让他亲口告诉你。",
    ],
  });
}

function inspectCabinetKey(item) {
  state.inventory.add("cabinetKey");
  showInspect({ title: item.title, paragraphs: [...item.paragraphs, "你把柜子钥匙收了起来。"] });
}

function inspectCabinet(item) {
  if (state.flags.cabinetOpened) {
    showInspect({ title: "打开柜子后", paragraphs: [...item.paragraphs, ...item.reveal] });
    return;
  }

  if (!state.inventory.has("cabinetKey")) {
    showInspect({ title: item.title, paragraphs: [...item.paragraphs, "柜子锁着。钥匙或许就在这间房里。"] });
    return;
  }

  showInspect({
    title: item.title,
    paragraphs: item.paragraphs,
    actions: [
      {
        label: "用柜子钥匙打开",
        primary: true,
        onClick: () => {
          state.flags.cabinetOpened = true;
          showInspect({ title: "打开柜子后", paragraphs: [...item.paragraphs, ...item.reveal] });
        },
      },
    ],
  });
}

function inspectLetter(item) {
  if (state.flags.finaleStarted) {
    showFinalLetter(item);
    return;
  }

  showInspect({
    title: story.finalePrompt.title,
    paragraphs: [...item.paragraphs, ...story.finalePrompt.paragraphs],
    actions: [
      {
        label: "读信，进入终章",
        primary: true,
        onClick: () => {
          state.flags.finaleStarted = true;
          state.flags.letterRead = true;
          applyReward({ heart: 12, suspicion: 10 }, "choice:letter:read");
          showFinalLetter(item);
        },
      },
      { label: "暂时不读", onClick: hideInspect },
    ],
  });
}

function showFinalLetter(item) {
  hideInspect();
  showStory({
    index: "终章 · 信件",
    title: "没有寄出的信",
    bodyHtml: letterHtml(story.letter),
    variant: "letter",
    dismissible: false,
    actions: [
      {
        label: "读到最后",
        primary: true,
        onClick: () => showEnding(determineForcedEnding()),
      },
    ],
  });
}

function inspect(item) {
  closeDrawers();
  state.visited.add(item.id);
  applyReward(item.reward, `item:${item.id}`);
  renderNotebook();

  const handlers = {
    livingKey: inspectLivingKey,
    cake: inspectCake,
    bedBox: inspectBedBox,
    diary: inspectDiary,
    workNotebook: inspectWorkNotebook,
    laptop: inspectLaptop,
    cabinetKey: inspectCabinetKey,
    cabinet: inspectCabinet,
    letter: inspectLetter,
  };

  if (item.action && handlers[item.action]) {
    handlers[item.action](item);
    return;
  }

  showInspect({
    title: item.title,
    paragraphs: item.paragraphs,
    image: item.image,
    imageAlt: item.imageAlt,
  });
}

function setStoryActions(actions = []) {
  els.storyActions.innerHTML = "";
  actions.forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = action.primary ? "story-primary" : "story-secondary";
    button.textContent = action.label;
    button.disabled = Boolean(action.disabled);
    if (action.hint) button.dataset.hint = action.hint;
    button.addEventListener("click", action.onClick);
    els.storyActions.appendChild(button);
  });
}

function showStory({
  index,
  title,
  paragraphs = [],
  messages = [],
  closing = [],
  actions = [],
  dismissible = true,
  bodyHtml = null,
  variant = "default",
}) {
  closeDrawers();
  hideInspect();
  els.storyOverlay.classList.toggle("letter-mode", variant === "letter");
  els.storyIndex.textContent = index;
  els.storyTitle.textContent = title;
  els.storyBody.innerHTML = bodyHtml ?? [
      paragraphsHtml(paragraphs),
      messagesHtml(messages),
      paragraphsHtml(closing),
    ].join("");
  els.storyClose.hidden = !dismissible;
  setStoryActions(actions);
  els.storyOverlay.classList.add("show");
  els.storyOverlay.setAttribute("aria-hidden", "false");
  els.storyBody.scrollTop = 0;
}

function hideStory() {
  els.storyOverlay.classList.remove("show");
  els.storyOverlay.setAttribute("aria-hidden", "true");
}

function showIntroStory() {
  showStory({
    ...story.intro,
    dismissible: false,
    actions: [
      {
        label: "回复“好”并进入他家",
        primary: true,
        onClick: () => {
          state.flags.introRead = true;
          hideStory();
          render();
        },
      },
    ],
  });
}

let bridgeTimer = null;
let bridgeReadyTimer = null;

function finishPrologueBridge() {
  if (!els.bridgeOverlay.classList.contains("show")) return;
  window.clearTimeout(bridgeTimer);
  window.clearTimeout(bridgeReadyTimer);
  els.bridgeOverlay.classList.remove("ready", "show");
  els.bridgeOverlay.setAttribute("aria-hidden", "true");
  showIntroStory();
}

function beginPrologueBridge() {
  if (els.bridgeOverlay.classList.contains("show")) return;
  window.clearTimeout(bridgeTimer);
  window.clearTimeout(bridgeReadyTimer);
  els.safetyContinue.disabled = true;
  els.bridgeOverlay.classList.add("show");
  els.bridgeOverlay.setAttribute("aria-hidden", "false");
  els.safetyOverlay.classList.remove("show");
  els.safetyOverlay.setAttribute("aria-hidden", "true");
  els.introOverlay.classList.add("is-hidden");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  bridgeReadyTimer = window.setTimeout(() => {
    els.bridgeOverlay.classList.add("ready");
    bridgeTimer = window.setTimeout(finishPrologueBridge, reducedMotion ? 260 : 1050);
  }, reducedMotion ? 0 : 380);
}

function enterSecret(withQuestion) {
  state.flags.secretUnlocked = true;
  if (withQuestion) applyReward({ suspicion: 4 }, "route:ask-secret");
  hideStory();
  state.room = "secret";
  render();
  showStory({
    index: "第四个房间",
    title: "密室",
    paragraphs: [rooms.secret.intro],
    dismissible: false,
    actions: [{ label: "开始调查", primary: true, onClick: hideStory }],
  });
}

function showNotebookDecision() {
  const directQuestion = state.suspicion >= 28;
  showStory({
    index: "任务完成",
    title: "走廊尽头的门",
    paragraphs: [
      "手机再次震动。屏幕亮起时，你正握着那本深灰色记事本。走廊尽头的门停在视线边缘，门把手上没有灰，像是不久前才被人擦拭过。",
    ],
    messages: [["他", "找到了吗？"]],
    actions: [
      { label: "马上送过去", onClick: () => showEnding("one") },
      {
        label: "继续调查",
        primary: true,
        onClick: () => {
          applyReward({ suspicion: 4 }, "route:continue");
          enterSecret(false);
        },
      },
      {
        label: "直接问他",
        disabled: !directQuestion,
        hint: directQuestion ? "" : "怀疑度还不足以问出口",
        onClick: () => {
          showStory({
            index: "聊天记录",
            title: "那扇门",
            messages: [
              ["你", "我找到本子了。最里面那扇门是什么？"],
              ["他", "你已经走到那里了吗？"],
              ["他", "……门没有锁。你想进去的话，就进去吧。"],
            ],
            paragraphs: [
              "他的回答来得太快。没有阻止，也没有质问。也许从那串一次性密码开始，你做出的每一步选择都在他的预料之中。",
            ],
            dismissible: false,
            actions: [{ label: "推开那扇门", primary: true, onClick: () => enterSecret(true) }],
          });
        },
      },
      { label: "稍后决定", onClick: hideStory },
    ],
  });
}

function determineForcedEnding(affection = state.affection, suspicion = state.suspicion) {
  if (affection < 35) return "two";
  if (affection < 60) return "three";
  if (affection < 85) return suspicion >= 55 ? "four" : "three";
  return suspicion >= 70 ? "five" : "four";
}

function showEnding(key) {
  const shouldPlayPasswordTheater =
    ["four", "five"].includes(key) &&
    state.visited.has("bedroom-laptop") &&
    !state.flags.passwordTheaterSeen;

  if (shouldPlayPasswordTheater) {
    showPasswordTheater(key);
    return;
  }

  renderEnding(key);
}

let theaterEndingKey = null;
let theaterStep = 0;

function showPasswordTheater(endingKey) {
  const theater = story.passwordTheater;
  theaterEndingKey = endingKey;
  theaterStep = 0;
  state.flags.passwordTheaterSeen = true;
  hideInspect();
  hideStory();
  closeDrawers();
  els.theaterOverlay.classList.add("show");
  els.theaterOverlay.setAttribute("aria-hidden", "false");
  document.querySelector("#theaterIndex").textContent = theater.index;
  document.querySelector("#theaterTitle").textContent = theater.title;
  renderTheaterStep();
}

function renderTheaterStep() {
  const theater = story.passwordTheater;
  const line = theater.lines[theaterStep];
  const isUnlock = theaterStep === theater.lines.length - 1;

  els.theaterOverlay.classList.toggle("neighbor-speaking", line.speaker === "他");
  els.theaterSpeaker.textContent = line.speaker;
  els.theaterText.innerHTML = `<p>${escapeHtml(line.text)}</p>`;

  if (isUnlock) {
    const laptop = rooms.bedroom.hotspots.find((item) => item.id === "bedroom-laptop");
    state.flags.laptopUnlocked = true;
    els.theaterText.innerHTML += paragraphsHtml(laptop.reveal);
    els.theaterNext.textContent = "走向结局";
    renderNotebook();
    return;
  }

  els.theaterNext.textContent = theaterStep === theater.lines.length - 2 ? "输入 1102" : "下一句";
}

function advancePasswordTheater() {
  const lastStep = story.passwordTheater.lines.length - 1;
  if (theaterStep >= lastStep) {
    els.theaterOverlay.classList.remove("show");
    els.theaterOverlay.setAttribute("aria-hidden", "true");
    renderEnding(theaterEndingKey);
    return;
  }

  theaterStep += 1;
  renderTheaterStep();
}

function renderEnding(key) {
  const ending = story.endings[key];
  hideInspect();
  hideStory();
  closeDrawers();
  els.endingLabel.textContent = `${ending.index} · 心动 ${state.affection} · 怀疑 ${state.suspicion}`;
  els.endingTitle.textContent = ending.title;
  els.endingText.innerHTML = paragraphsHtml(ending.paragraphs);
  els.endingOverlay.classList.add("show");
  els.endingOverlay.setAttribute("aria-hidden", "false");
}

els.theaterNext.addEventListener("click", advancePasswordTheater);

els.mapToggle.addEventListener("click", () => {
  const open = !els.roomMap.classList.contains("open");
  setDrawer(els.notebookPanel, els.notebookToggle, false);
  setDrawer(els.roomMap, els.mapToggle, open);
});

els.notebookToggle.addEventListener("click", () => {
  const open = !els.notebookPanel.classList.contains("open");
  setDrawer(els.roomMap, els.mapToggle, false);
  setDrawer(els.notebookPanel, els.notebookToggle, open);
});

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.close === "map") setDrawer(els.roomMap, els.mapToggle, false);
    if (button.dataset.close === "notebook") setDrawer(els.notebookPanel, els.notebookToggle, false);
  });
});

els.roomTabs.forEach((button) => {
  button.addEventListener("click", () => setRoom(button.dataset.room));
});

els.closeModal.addEventListener("click", hideInspect);
els.keepLooking.addEventListener("click", hideInspect);
els.storyClose.addEventListener("click", hideStory);

async function requestMobileFullscreen() {
  const mobileLayout = window.matchMedia("(pointer: coarse) and (max-width: 1100px)").matches;
  if (!mobileLayout || document.fullscreenElement) return;

  const root = document.documentElement;
  const request = root.requestFullscreen || root.webkitRequestFullscreen;
  if (!request) return;

  try {
    await request.call(root, { navigationUI: "hide" });
  } catch {
    // Some mobile browsers do not expose page-controlled fullscreen.
  }
}

els.startButton.addEventListener("click", () => {
  void requestMobileFullscreen();
  els.safetyOverlay.classList.add("show");
  els.safetyOverlay.setAttribute("aria-hidden", "false");
});

els.safetyContinue.addEventListener("click", beginPrologueBridge);
els.bridgeOverlay.addEventListener("click", finishPrologueBridge);
els.bridgeOverlay.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") finishPrologueBridge();
});

els.soundToggle.addEventListener("click", () => {
  const enabled = els.soundToggle.getAttribute("aria-pressed") === "true";
  els.soundToggle.setAttribute("aria-pressed", String(!enabled));
});

els.restartButton.addEventListener("click", () => window.location.reload());

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (els.inspectModal.classList.contains("show")) {
    hideInspect();
    return;
  }
  if (els.storyOverlay.classList.contains("show") && !els.storyClose.hidden) {
    hideStory();
    return;
  }
  closeDrawers();
});

els.sceneImage.addEventListener("load", renderHotspots);
window.addEventListener("resize", () => requestAnimationFrame(renderHotspots));

render();
