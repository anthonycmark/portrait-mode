const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const HANDS = {
  "High Card": [5, 1], Pair: [10, 2], "Two Pair": [20, 2], "Three of a Kind": [30, 3], Straight: [30, 4], Flush: [35, 4], "Full House": [45, 4], "Four of a Kind": [60, 7], "Straight Flush": [100, 8]
};
const CHARMS = [
  { id: "spark", glyph: "✦", name: "Bright Cut", text: "+12 chips on every hand", cost: 4 },
  { id: "pair", glyph: "Ⅱ", name: "Double Down", text: "+3 mult when a Pair scores", cost: 5 },
  { id: "red", glyph: "♥", name: "Red Thread", text: "+4 chips for each red card played", cost: 5 },
  { id: "five", glyph: "Ⅴ", name: "Full Spread", text: "+2 mult when playing 5 cards", cost: 6 },
  { id: "face", glyph: "♛", name: "Court Favor", text: "+5 chips for each face card played", cost: 6 },
  { id: "flush", glyph: "≋", name: "Deep Current", text: "+5 mult when a Flush scores", cost: 7 }
];
const TARGETS = [300, 520, 820, 1250, 1850, 2700, 3900, 5600, 8000];
const SAVE_KEY = "pocket-stakes-save-v1";

let state;
let sortMode = "rank";
let busy = false;

function freshState() {
  return { deck: [], hand: [], selected: [], score: 0, round: 0, handsLeft: 4, discardsLeft: 3, money: 0, charms: [], bestHand: "—", bestScore: 0, cardsPlayed: 0, shop: [] };
}

function makeDeck() {
  return SUITS.flatMap(suit => RANKS.map((rank, i) => ({ id: `${suit}${rank}-${Math.random()}`, suit, rank, value: i + 2 })));
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
  const flush = cards.length === 5 && cards.every(c => c.suit === cards[0].suit);
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
  let [base, mult] = HANDS[name];
  let chips = base + cards.reduce((sum, c) => sum + Math.min(c.value, 10), 0);
  if (hasCharm("spark")) chips += 12;
  if (hasCharm("red")) chips += cards.filter(c => c.suit === "♥" || c.suit === "♦").length * 4;
  if (hasCharm("face")) chips += cards.filter(c => ["J","Q","K"].includes(c.rank)).length * 5;
  if (hasCharm("pair") && name === "Pair") mult += 3;
  if (hasCharm("five") && cards.length === 5) mult += 2;
  if (hasCharm("flush") && name.includes("Flush")) mult += 5;
  return { name, chips, mult, total: chips * mult };
}

function hasCharm(id) { return state.charms.some(c => c.id === id); }
function roundTarget() { return TARGETS[state.round] || TARGETS.at(-1) * (state.round - TARGETS.length + 2); }

function cardHTML(card, selected = false) {
  const red = card.suit === "♥" || card.suit === "♦";
  return `<button class="card ${red ? "red" : ""} ${selected ? "selected" : ""}" data-id="${card.id}" aria-label="${card.rank} of ${suitName(card.suit)}${selected ? ", selected" : ""}" aria-pressed="${selected}"><span class="rank">${card.rank}</span><span class="suit">${card.suit}</span><span class="mini">${card.rank}${card.suit}</span></button>`;
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
  document.querySelector("#hand-name").textContent = preview.name;
  document.querySelector("#selection-count").textContent = `${state.selected.length} / 5`;
  document.querySelector("#score-label").textContent = state.score.toLocaleString();
  document.querySelector("#target-label").textContent = roundTarget().toLocaleString();
  document.querySelector("#progress-bar").style.width = `${Math.min(100, state.score / roundTarget() * 100)}%`;
  document.querySelector("#ante-label").textContent = `ANTE ${Math.floor(state.round / 3) + 1}`;
  document.querySelector("#round-label").textContent = `ROUND ${state.round % 3 + 1}/3`;
  document.querySelector("#money-label").textContent = state.money;
  document.querySelector("#hand-count").textContent = `${state.handsLeft} left`;
  document.querySelector("#discard-count").textContent = `${state.discardsLeft} left`;
  document.querySelector("#play-button").disabled = !state.selected.length || !state.handsLeft || busy;
  document.querySelector("#discard-button").disabled = !state.selected.length || !state.discardsLeft || busy;
  document.querySelector("#modifier-strip").innerHTML = state.charms.map(c => `<div class="charm"><strong>${c.glyph} ${c.name}</strong><small>${c.text}</small></div>`).join("");
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
  document.querySelector("#message").textContent = `${result.name} · ${result.chips} × ${result.mult}`;
  await wait(280);
  state.score += result.total;
  const burst = document.querySelector("#score-burst");
  burst.textContent = `+${result.total.toLocaleString()}`;
  burst.classList.remove("pop"); void burst.offsetWidth; burst.classList.add("pop");
  if (navigator.vibrate) navigator.vibrate([20,40,40]);
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
  const reward = 3 + state.handsLeft + Math.floor(state.score / roundTarget());
  state.money += reward;
  state.shop = shuffle(CHARMS.filter(c => !hasCharm(c.id))).slice(0, 3);
  if (state.round >= TARGETS.length - 1) return endRun(true);
  document.querySelector("#shop-money").textContent = state.money;
  renderShop();
  showScreen("shop-screen");
}

function renderShop() {
  const list = document.querySelector("#shop-list");
  if (!state.shop.length) list.innerHTML = `<p class="message">You found every charm. Keep your coins.</p>`;
  else list.innerHTML = state.shop.map(c => `<button class="shop-item" data-buy="${c.id}" ${state.money < c.cost ? "disabled" : ""}><span class="shop-glyph">${c.glyph}</span><span class="shop-copy"><strong>${c.name}</strong><small>${c.text}</small></span><span class="price">◆ ${c.cost}</span></button>`).join("");
  document.querySelector("#shop-money").textContent = state.money;
}

function buyCharm(id) {
  const charm = CHARMS.find(c => c.id === id);
  if (!charm || hasCharm(id) || state.money < charm.cost) return;
  state.money -= charm.cost;
  state.charms.push(charm);
  state.shop = state.shop.filter(c => c.id !== id);
  renderShop(); save();
}

function nextRound() {
  busy = false;
  state.round++;
  state.score = 0;
  state.handsLeft = 4;
  state.discardsLeft = 3;
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
  document.querySelector("#end-summary").textContent = won ? "Nine rounds cleared. Your charms turned a plain deck into a scoring machine." : `You reached Ante ${Math.floor(state.round / 3) + 1}, Round ${state.round % 3 + 1}. One better hand could change the run.`;
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
  try { const saved = JSON.parse(localStorage.getItem(SAVE_KEY)); if (saved?.hand?.length) return saved; } catch (_) {}
  return null;
}

document.addEventListener("click", e => {
  const card = e.target.closest("#hand .card"); if (card) toggleCard(card.dataset.id);
  const buy = e.target.closest("[data-buy]"); if (buy) buyCharm(buy.dataset.buy);
});
document.querySelector("#play-button").addEventListener("click", playHand);
document.querySelector("#discard-button").addEventListener("click", discard);
document.querySelector("#next-round-button").addEventListener("click", nextRound);
document.querySelector("#new-run-button").addEventListener("click", startNew);
document.querySelector("#sort-rank").addEventListener("click", () => { sortMode = "rank"; render(); });
document.querySelector("#sort-suit").addEventListener("click", () => { sortMode = "suit"; render(); });
const dialog = document.querySelector("#menu-dialog");
document.querySelector("#menu-button").addEventListener("click", () => dialog.showModal());
document.querySelector("#close-menu").addEventListener("click", () => dialog.close());
document.querySelector("#resume-button").addEventListener("click", () => dialog.close());
document.querySelector("#restart-button").addEventListener("click", () => { dialog.close(); startNew(); });

state = load() || freshState();
if (!state.hand.length) { state.deck = shuffle(makeDeck()); draw(8); }
render();
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
