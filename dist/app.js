const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const HANDS = {
  "High Card": [5, 1], Pair: [10, 2], "Two Pair": [20, 2], "Three of a Kind": [30, 3], Straight: [30, 4], Flush: [35, 4], "Full House": [45, 4], "Four of a Kind": [60, 7], "Straight Flush": [100, 8]
};
const CHARMS = [
  { id: "spark", glyph: "✦", name: "Bright Cut", text: "+25 chips on every hand", cost: 4 },
  { id: "pair", glyph: "Ⅱ", name: "Double Down", text: "+3 mult when a Pair scores", cost: 5 },
  { id: "red", glyph: "♥", name: "Red Thread", text: "+8 chips for each red card played", cost: 5 },
  { id: "five", glyph: "Ⅴ", name: "Full Spread", text: "+2 mult when playing 5 cards", cost: 6 },
  { id: "face", glyph: "♛", name: "Court Favor", text: "+12 chips for each face card played", cost: 6 },
  { id: "flush", glyph: "≋", name: "Deep Current", text: "+5 mult when a Flush scores", cost: 7 },
  { id: "solo", glyph: "Ⅰ", name: "Lone Wolf", text: "×3 score when playing exactly 1 card", cost: 7 },
  { id: "duet", glyph: "Ⅱ", name: "Two-Step", text: "×2 score when playing exactly 2 cards", cost: 6 },
  { id: "low", glyph: "↓", name: "Low Profile", text: "×2 score if every card is 8 or lower", cost: 7 },
  { id: "rainbow", glyph: "◈", name: "Four Corners", text: "+5 mult when 4 suits are played", cost: 6 },
  { id: "odd", glyph: "3", name: "Odd Hours", text: "+2 mult per odd numbered card", cost: 5 },
  { id: "black", glyph: "♠", name: "Black Book", text: "+9 chips per black card", cost: 5 },
  { id: "repeat", glyph: "↻", name: "Encore", text: "+4 mult for repeating the previous hand", cost: 6 },
  { id: "variety", glyph: "+", name: "Fresh Take", text: "+3 mult the first time each hand scores per round", cost: 5 },
  { id: "first", glyph: "⚡", name: "Opening Act", text: "×2 score on the first hand of each round", cost: 7 },
  { id: "clutch", glyph: "!", name: "Last Call", text: "×3 score on your final hand", cost: 8 }
];
const ENHANCEMENTS = {
  boost: { mark: "+", name: "Charged", text: "+20 chips when played" },
  echo: { mark: "↻", name: "Echo", text: "Rank chips score twice" },
  wild: { mark: "W", name: "Wild Suit", text: "Counts as any suit for Flushes" },
  mint: { mark: "◆", name: "Minted", text: "+1 coin whenever played" }
};
const TARGETS = [300, 520, 820, 1250, 1850, 2700, 3900, 5600, 8000];
const MAX_CHARMS = 5;
const BOSS_RULES = [
  { id: "red_tax", name: "Crimson Tax", text: "Red cards give no base rank chips" },
  { id: "no_repeat", name: "Closed Circuit", text: "A hand type can score only once this round" },
  { id: "four_limit", name: "The Narrow Gate", text: "Hands with 5 cards score nothing" }
];
const SAVE_KEY = "pocket-stakes-save-v1";

let state;
let sortMode = "rank";
let busy = false;
let selectedCharmId = null;

function defaultHandLevels() { return Object.fromEntries(Object.keys(HANDS).map(name => [name, 1])); }

function freshState() {
  return { deck: [], hand: [], selected: [], score: 0, round: 0, handsLeft: 4, discardsLeft: 3, money: 0, charms: [], enhancements: {}, handLevels: defaultHandLevels(), bestHand: "—", bestScore: 0, cardsPlayed: 0, shop: [], forge: [], lastHand: null, playedTypes: [], handsPlayedThisRound: 0, packOpened: false, packChoices: [] };
}

function makeDeck() {
  return SUITS.flatMap(suit => RANKS.map((rank, i) => ({ id: `${suit}${rank}-${Math.random()}`, suit, rank, value: i + 2, enhancement: state?.enhancements?.[`${suit}${rank}`] || null })));
}

function shuffle(cards) {
  for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  return cards;
}

function draw(count) {
  while (count-- > 0) {
    if (!state.deck.length) state.deck = shuffle(makeDeck().filter(c => !state.hand.some(h => h.suit === c.suit && h.rank === c.rank)));
    const card = state.deck.pop();
    if (card) state.hand.push(card);
  }
}

function evaluate(cards) {
  if (!cards.length) return { name: "No hand selected", chips: 0, mult: 0, total: 0 };
  const counts = Object.values(cards.reduce((a, c) => ((a[c.value] = (a[c.value] || 0) + 1), a), {})).sort((a,b) => b-a);
  const values = [...new Set(cards.map(c => c.value))].sort((a,b) => a-b);
  const suitedCards = cards.filter(c => c.enhancement !== "wild");
  const flush = cards.length === 5 && (!suitedCards.length || suitedCards.every(c => c.suit === suitedCards[0].suit));
  const straight = cards.length === 5 && (values.length === 5 && (values[4] - values[0] === 4 || values.join(",") === "2,3,4,5,14"));
  let name = "High Card";
  if (straight && flush) name = "Straight Flush";
  else if (counts[0] === 4) name = "Four of a Kind";
  else if (counts[0] === 3 && counts[1] === 2) name = "Full House";
  else if (flush) name = "Flush";
  else if (straight) name = "Straight";
  else if (counts[0] === 3) name = "Three of a Kind";
  else if (counts[0] === 2 && counts[1] === 2) name = "Two Pair";
  else if (counts[0] === 2) name = "Pair";
  let [base, mult] = getHandStats(name);
  const boss = blindInfo().boss;
  let chips = base + cards.reduce((sum, c) => sum + (boss?.id === "red_tax" && (c.suit === "♥" || c.suit === "♦") ? 0 : Math.min(c.value, 10)), 0);
  chips += cards.filter(c => c.enhancement === "boost").length * 20;
  chips += cards.filter(c => c.enhancement === "echo").reduce((sum, c) => sum + Math.min(c.value, 10), 0);
  if (hasCharm("spark")) chips += 25;
  if (hasCharm("red")) chips += cards.filter(c => c.suit === "♥" || c.suit === "♦").length * 8;
  if (hasCharm("face")) chips += cards.filter(c => ["J","Q","K"].includes(c.rank)).length * 12;
  if (hasCharm("black")) chips += cards.filter(c => c.suit === "♠" || c.suit === "♣").length * 9;
  if (hasCharm("pair") && name === "Pair") mult += 3;
  if (hasCharm("five") && cards.length === 5) mult += 2;
  if (hasCharm("flush") && name.includes("Flush")) mult += 5;
  if (hasCharm("rainbow") && new Set(cards.map(c => c.suit)).size >= 4) mult += 5;
  if (hasCharm("odd")) mult += cards.filter(c => [3,5,7,9].includes(c.value)).length * 2;
  if (hasCharm("repeat") && state.lastHand === name) mult += 4;
  if (hasCharm("variety") && !state.playedTypes.includes(name)) mult += 3;
  let xMult = 1;
  if (hasCharm("solo") && cards.length === 1) xMult *= 3;
  if (hasCharm("duet") && cards.length === 2) xMult *= 2;
  if (hasCharm("low") && cards.every(c => c.value <= 8)) xMult *= 2;
  if (hasCharm("first") && state.handsPlayedThisRound === 0) xMult *= 2;
  if (hasCharm("clutch") && state.handsLeft === 1) xMult *= 3;
  let blocked = null;
  if (boss?.id === "no_repeat" && state.playedTypes.includes(name)) blocked = "Already scored this hand type";
  if (boss?.id === "four_limit" && cards.length === 5) blocked = "Five-card hands are blocked";
  return { name, chips, mult, xMult, blocked, total: blocked ? 0 : Math.round(chips * mult * xMult) };
}

function hasCharm(id) { return state.charms.some(c => c.id === id); }
function getHandStats(name) { const level = state.handLevels?.[name] || 1; return [HANDS[name][0] + (level - 1) * 10, HANDS[name][1] + (level - 1)]; }
function blindInfo() {
  const stage = state.round % 3;
  if (stage === 0) return { name: "Small Stake", reward: 3, boss: null };
  if (stage === 1) return { name: "Big Stake", reward: 4, boss: null };
  const boss = BOSS_RULES[Math.floor(state.round / 3) % BOSS_RULES.length];
  return { name: `Boss · ${boss.name}`, reward: 6, boss };
}
function roundTarget() { return TARGETS[state.round] || TARGETS.at(-1) * (state.round - TARGETS.length + 2); }

function cardHTML(card, selected = false) {
  const red = card.suit === "♥" || card.suit === "♦";
  const enhancement = ENHANCEMENTS[card.enhancement];
  return `<button class="card ${red ? "red" : ""} ${selected ? "selected" : ""}" data-id="${card.id}" aria-label="${card.rank} of ${suitName(card.suit)}${enhancement ? `, ${enhancement.name}` : ""}${selected ? ", selected" : ""}" aria-pressed="${selected}"><span class="rank">${card.rank}</span>${enhancement ? `<span class="card-mark">${enhancement.mark}</span>` : ""}<span class="suit">${card.suit}</span><span class="mini">${card.rank}${card.suit}</span></button>`;
}

function suitName(suit) { return ({"♠":"spades","♥":"hearts","♦":"diamonds","♣":"clubs"})[suit]; }

function sortedHand() {
  const copy = [...state.hand];
  return copy.sort(sortMode === "rank" ? (a,b) => b.value-a.value || SUITS.indexOf(a.suit)-SUITS.indexOf(b.suit) : (a,b) => SUITS.indexOf(a.suit)-SUITS.indexOf(b.suit) || b.value-a.value);
}

function render() {
  const selectedCards = state.hand.filter(c => state.selected.includes(c.id));
  const preview = evaluate(selectedCards);
  document.querySelector("#hand").innerHTML = sortedHand().map(c => cardHTML(c, state.selected.includes(c.id))).join("");
  document.querySelector("#hand-name").textContent = preview.name === "No hand selected" ? preview.name : `${preview.name} · Lv.${state.handLevels[preview.name] || 1}`;
  document.querySelector("#selection-count").textContent = `${state.selected.length} / 5`;
  document.querySelector("#score-label").textContent = state.score.toLocaleString();
  document.querySelector("#target-label").textContent = roundTarget().toLocaleString();
  document.querySelector("#progress-bar").style.width = `${Math.min(100, state.score / roundTarget() * 100)}%`;
  document.querySelector("#ante-label").textContent = `ANTE ${Math.floor(state.round / 3) + 1}`;
  document.querySelector("#round-label").textContent = `ROUND ${state.round % 3 + 1}/3`;
  document.querySelector("#money-label").textContent = state.money;
  document.querySelector("#deck-count").textContent = state.deck.length;
  document.querySelector("#hand-count").textContent = `${state.handsLeft} left`;
  document.querySelector("#discard-count").textContent = `${state.discardsLeft} left`;
  document.querySelector("#play-button").disabled = !state.selected.length || !state.handsLeft || busy;
  document.querySelector("#discard-button").disabled = !state.selected.length || !state.discardsLeft || busy;
  document.querySelector("#modifier-strip").innerHTML = state.charms.map(c => `<button class="charm" data-owned-charm="${c.id}"><strong>${c.glyph} ${c.name}</strong><small>${c.text}</small></button>`).join("");
  const blind = blindInfo();
  const rule = document.querySelector("#blind-rule");
  rule.textContent = blind.boss ? `${blind.name}: ${blind.boss.text}` : `${blind.name} · Base reward ◆ ${blind.reward}`;
  rule.classList.toggle("boss", Boolean(blind.boss));
  document.querySelector("#sort-rank").classList.toggle("active", sortMode === "rank");
  document.querySelector("#sort-suit").classList.toggle("active", sortMode === "suit");
  save();
}

function toggleCard(id) {
  if (busy) return;
  if (state.selected.includes(id)) state.selected = state.selected.filter(x => x !== id);
  else if (state.selected.length < 5) state.selected.push(id);
  if (navigator.vibrate) navigator.vibrate(8);
  render();
}

function replaceSelected() {
  const count = state.selected.length;
  state.hand = state.hand.filter(c => !state.selected.includes(c.id));
  state.selected = [];
  draw(count);
}

async function playHand() {
  if (busy || !state.selected.length) return;
  busy = true;
  const cards = state.hand.filter(c => state.selected.includes(c.id));
  const result = evaluate(cards);
  state.handsLeft--;
  state.cardsPlayed += cards.length;
  if (result.total > state.bestScore) { state.bestScore = result.total; state.bestHand = result.name; }
  document.querySelector("#played-cards").innerHTML = cards.map(c => cardHTML(c)).join("");
  const minted = cards.filter(c => c.enhancement === "mint").length;
  if (minted) state.money += minted;
  document.querySelector("#message").textContent = result.blocked ? result.blocked : `${result.name} Lv.${state.handLevels[result.name]} · ${result.chips} × ${result.mult}${result.xMult > 1 ? ` × ${result.xMult}` : ""}${minted ? ` · +${minted}◆` : ""}`;
  await wait(280);
  state.score += result.total;
  const burst = document.querySelector("#score-burst");
  burst.textContent = `+${result.total.toLocaleString()}`;
  burst.classList.remove("pop"); void burst.offsetWidth; burst.classList.add("pop");
  if (navigator.vibrate) navigator.vibrate([20,40,40]);
  state.lastHand = result.name;
  if (!state.playedTypes.includes(result.name)) state.playedTypes.push(result.name);
  state.handsPlayedThisRound++;
  replaceSelected();
  busy = false;
  const cleared = state.score >= roundTarget();
  const exhausted = state.handsLeft <= 0;
  if (cleared || exhausted) busy = true;
  render();
  if (cleared) setTimeout(winRound, 700);
  else if (exhausted) setTimeout(() => endRun(false), 700);
}

function discard() {
  if (busy || !state.selected.length || !state.discardsLeft) return;
  state.discardsLeft--;
  replaceSelected();
  document.querySelector("#message").textContent = "Fresh cards dealt";
  render();
}

function winRound() {
  busy = false;
  const reward = blindInfo().reward + state.handsLeft + Math.floor(state.score / roundTarget());
  state.money += reward;
  state.shop = shuffle(CHARMS.filter(c => !hasCharm(c.id))).slice(0, 3);
  createForgeOffers();
  if (state.round >= TARGETS.length - 1) return endRun(true);
  document.querySelector("#shop-money").textContent = state.money;
  renderShop();
  showScreen("shop-screen");
}

function renderShop() {
  const list = document.querySelector("#shop-list");
  if (!state.shop.length) list.innerHTML = `<p class="message">You found every relic. Keep your coins.</p>`;
  else list.innerHTML = state.shop.map(c => `<button class="shop-item" data-buy="${c.id}" ${state.money < c.cost || state.charms.length >= MAX_CHARMS ? "disabled" : ""}><span class="shop-glyph">${c.glyph}</span><span class="shop-copy"><strong>${c.name}</strong><small>${c.text}</small></span><span class="price">◆ ${c.cost}</span></button>`).join("");
  document.querySelector("#shop-money").textContent = state.money;
  document.querySelector("#slot-label").textContent = `${state.charms.length} / ${MAX_CHARMS} slots`;
  document.querySelector("#reroll-button").disabled = state.money < 2 || !CHARMS.some(c => !hasCharm(c.id));
  const packButton = document.querySelector("#pack-button");
  packButton.disabled = (state.packOpened && !state.packChoices.length) || (!state.packOpened && state.money < 4);
  packButton.querySelector("strong").textContent = state.packChoices.length ? "RESUME INSIGHT PACK" : state.packOpened ? "PACK OPENED" : "OPEN INSIGHT PACK";
  document.querySelector("#forge-list").innerHTML = state.forge.length ? state.forge.map((offer, index) => {
    const enhancement = ENHANCEMENTS[offer.type];
    const red = offer.suit === "♥" || offer.suit === "♦";
    return `<button class="forge-item" data-forge="${index}" ${state.money < offer.cost ? "disabled" : ""}><span class="forge-card" style="${red ? "color:#ff7185" : ""}">${offer.rank}${offer.suit} · ${enhancement.mark}</span><strong>${enhancement.name}</strong><small>${enhancement.text} · ◆ ${offer.cost}</small></button>`;
  }).join("") : `<p class="message">Every offered card is already tuned.</p>`;
}

function createForgeOffers() {
  const cards = [...state.hand, ...state.deck].filter(c => !state.enhancements[`${c.suit}${c.rank}`]);
  const types = Object.keys(ENHANCEMENTS);
  state.forge = shuffle(cards).slice(0, 3).map((card, index) => ({ suit: card.suit, rank: card.rank, type: types[(state.round + index) % types.length], cost: 4 }));
}

function buyForge(index) {
  const offer = state.forge[index];
  if (!offer || state.money < offer.cost) return;
  const key = `${offer.suit}${offer.rank}`;
  state.money -= offer.cost;
  state.enhancements[key] = offer.type;
  [...state.hand, ...state.deck].forEach(card => { if (`${card.suit}${card.rank}` === key) card.enhancement = offer.type; });
  state.forge.splice(index, 1);
  renderShop(); save();
}

function rerollShop() {
  if (state.money < 2) return;
  state.money -= 2;
  state.shop = shuffle(CHARMS.filter(c => !hasCharm(c.id))).slice(0, 3);
  renderShop(); save();
}

function buyCharm(id) {
  const charm = CHARMS.find(c => c.id === id);
  if (!charm || hasCharm(id) || state.money < charm.cost || state.charms.length >= MAX_CHARMS) return;
  state.money -= charm.cost;
  state.charms.push(charm);
  state.shop = state.shop.filter(c => c.id !== id);
  renderShop(); save();
}

function openCharm(id) {
  const charm = state.charms.find(c => c.id === id);
  if (!charm) return;
  selectedCharmId = id;
  document.querySelector("#charm-dialog-name").textContent = `${charm.glyph} ${charm.name}`;
  document.querySelector("#charm-dialog-text").textContent = charm.text;
  document.querySelector("#sell-charm").textContent = `SELL · +◆ ${Math.max(1, Math.floor(charm.cost / 2))}`;
  document.querySelector("#charm-dialog").showModal();
}

function sellSelectedCharm() {
  const charm = state.charms.find(c => c.id === selectedCharmId);
  if (!charm) return;
  state.money += Math.max(1, Math.floor(charm.cost / 2));
  state.charms = state.charms.filter(c => c.id !== selectedCharmId);
  selectedCharmId = null;
  document.querySelector("#charm-dialog").close();
  render();
  if (!document.querySelector("#shop-screen").classList.contains("hidden")) renderShop();
}

function openPack() {
  if (state.packChoices.length) {
    renderPack();
    document.querySelector("#pack-dialog").showModal();
    return;
  }
  if (state.packOpened || state.money < 4) return;
  state.money -= 4;
  state.packOpened = true;
  state.packChoices = shuffle(Object.keys(HANDS)).slice(0, 3);
  renderPack();
  document.querySelector("#pack-dialog").showModal();
  renderShop(); save();
}

function renderPack() {
  document.querySelector("#pack-options").innerHTML = state.packChoices.map(name => {
    const level = state.handLevels[name] || 1;
    const [chips, mult] = getHandStats(name);
    return `<button class="pack-option" data-level-hand="${name}"><span><strong>${name}</strong><small>Now ${chips} chips × ${mult} mult</small></span><span class="level-jump">Lv.${level} → ${level + 1}</span></button>`;
  }).join("");
}

function chooseHandLevel(name) {
  if (!state.packChoices.includes(name)) return;
  state.handLevels[name] = (state.handLevels[name] || 1) + 1;
  state.packChoices = [];
  document.querySelector("#pack-dialog").close();
  renderShop(); save();
}

function nextRound() {
  busy = false;
  state.round++;
  state.score = 0;
  state.handsLeft = 4;
  state.discardsLeft = 3;
  state.lastHand = null;
  state.playedTypes = [];
  state.handsPlayedThisRound = 0;
  state.packOpened = false;
  state.packChoices = [];
  state.hand = [];
  state.selected = [];
  state.deck = shuffle(makeDeck());
  draw(8);
  document.querySelector("#played-cards").innerHTML = "";
  document.querySelector("#message").textContent = "Choose up to 5 cards";
  showScreen("game-screen"); render();
}

function endRun(won) {
  busy = false;
  document.querySelector("#end-kicker").textContent = won ? "RUN COMPLETE" : "RUN OVER";
  document.querySelector("#end-title").textContent = won ? "The table is yours." : "The target held.";
  document.querySelector("#end-summary").textContent = won ? "Nine rounds cleared. Your relics turned a plain deck into a scoring machine." : `You reached Ante ${Math.floor(state.round / 3) + 1}, Round ${state.round % 3 + 1}. One better hand could change the run.`;
  document.querySelector("#best-hand-stat").textContent = `${state.bestHand}${state.bestScore ? ` · ${state.bestScore}` : ""}`;
  document.querySelector("#cards-played-stat").textContent = state.cardsPlayed;
  document.querySelector("#coins-stat").textContent = state.money;
  localStorage.removeItem(SAVE_KEY);
  showScreen("end-screen");
}

function startNew() {
  state = freshState();
  state.deck = shuffle(makeDeck());
  draw(8);
  document.querySelector("#played-cards").innerHTML = "";
  document.querySelector("#message").textContent = "Choose up to 5 cards";
  showScreen("game-screen"); render();
}

function showScreen(id) { document.querySelectorAll(".screen").forEach(s => s.classList.toggle("hidden", s.id !== id)); }
function save() { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }
function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (saved?.hand?.length) {
      saved.charms = (saved.charms || []).map(savedCharm => CHARMS.find(charm => charm.id === savedCharm.id) || savedCharm);
      saved.shop = (saved.shop || []).map(savedCharm => CHARMS.find(charm => charm.id === savedCharm.id) || savedCharm);
      saved.enhancements ||= {};
      saved.handLevels = { ...defaultHandLevels(), ...(saved.handLevels || {}) };
      saved.forge ||= [];
      saved.playedTypes ||= [];
      saved.lastHand ??= null;
      saved.handsPlayedThisRound ||= 0;
      saved.packOpened ||= false;
      saved.packChoices ||= [];
      [...saved.hand, ...saved.deck].forEach(card => { card.enhancement = saved.enhancements[`${card.suit}${card.rank}`] || card.enhancement || null; });
      return saved;
    }
  } catch (_) {}
  return null;
}

document.addEventListener("click", e => {
  const card = e.target.closest("#hand .card"); if (card) toggleCard(card.dataset.id);
  const buy = e.target.closest("[data-buy]"); if (buy) buyCharm(buy.dataset.buy);
  const forge = e.target.closest("[data-forge]"); if (forge) buyForge(Number(forge.dataset.forge));
  const ownedCharm = e.target.closest("[data-owned-charm]"); if (ownedCharm) openCharm(ownedCharm.dataset.ownedCharm);
  const levelHand = e.target.closest("[data-level-hand]"); if (levelHand) chooseHandLevel(levelHand.dataset.levelHand);
});
document.querySelector("#play-button").addEventListener("click", playHand);
document.querySelector("#discard-button").addEventListener("click", discard);
document.querySelector("#next-round-button").addEventListener("click", nextRound);
document.querySelector("#new-run-button").addEventListener("click", startNew);
document.querySelector("#reroll-button").addEventListener("click", rerollShop);
document.querySelector("#pack-button").addEventListener("click", openPack);
document.querySelector("#sort-rank").addEventListener("click", () => { sortMode = "rank"; render(); });
document.querySelector("#sort-suit").addEventListener("click", () => { sortMode = "suit"; render(); });
const dialog = document.querySelector("#menu-dialog");
const deckDialog = document.querySelector("#deck-dialog");
const packDialog = document.querySelector("#pack-dialog");
const charmDialog = document.querySelector("#charm-dialog");
document.querySelector("#menu-button").addEventListener("click", () => dialog.showModal());
document.querySelector("#close-menu").addEventListener("click", () => dialog.close());
document.querySelector("#resume-button").addEventListener("click", () => dialog.close());
document.querySelector("#restart-button").addEventListener("click", () => { dialog.close(); startNew(); });
document.querySelector("#deck-button").addEventListener("click", () => { renderDeck(); deckDialog.showModal(); });
document.querySelector("#close-deck").addEventListener("click", () => deckDialog.close());
document.querySelector("#close-pack").addEventListener("click", () => packDialog.close());
document.querySelector("#close-charm").addEventListener("click", () => charmDialog.close());
document.querySelector("#sell-charm").addEventListener("click", sellSelectedCharm);

function renderDeck() {
  const cards = [...state.deck].sort((a,b) => SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) || b.value - a.value);
  document.querySelector("#deck-dialog-count").textContent = cards.length;
  document.querySelector("#deck-summary").innerHTML = SUITS.map(suit => `<div class="suit-count ${suit === "♥" || suit === "♦" ? "red" : ""}">${suit} ${cards.filter(c => c.suit === suit).length}</div>`).join("");
  document.querySelector("#deck-grid").innerHTML = cards.map(card => `<div class="deck-card ${card.suit === "♥" || card.suit === "♦" ? "red" : ""} ${card.enhancement ? "enhanced" : ""}"><span>${card.rank}</span><span>${card.suit}${card.enhancement ? ENHANCEMENTS[card.enhancement].mark : ""}</span></div>`).join("");
  document.querySelector("#mastery-grid").innerHTML = Object.keys(HANDS).map(name => `<div class="mastery-item"><span>${name}</span><strong>Lv.${state.handLevels[name] || 1}</strong></div>`).join("");
}

state = load() || freshState();
if (!state.hand.length) { state.deck = shuffle(makeDeck()); draw(8); }
render();
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
