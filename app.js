const SUPABASE_URL = "https://gikfiuargopavlzcbcnu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_gi5_tJVl_-Ni_2HF6UEduA_D9DCwBL5";
const MAX_CONFIRMED = 4;

const defaultFriends = [
  { name: "Jane", email: "", phone: "" },
  { name: "Jamie", email: "", phone: "" },
  { name: "Steve", email: "", phone: "" },
  { name: "Pam", email: "", phone: "" },
  { name: "Bob", email: "", phone: "" },
  { name: "Bill", email: "", phone: "" },
  { name: "Tim", email: "", phone: "" },
  { name: "Anne", email: "", phone: "" },
];

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const state = {
  game: null,
  friends: [],
  saving: false,
};

const els = {
  appStatus: document.querySelector("#appStatus"),
  eventTime: document.querySelector("#eventTime"),
  eventLocation: document.querySelector("#eventLocation"),
  eventNote: document.querySelector("#eventNote"),
  emailInvite: document.querySelector("#emailInvite"),
  textInvite: document.querySelector("#textInvite"),
  emailReminder: document.querySelector("#emailReminder"),
  textReminder: document.querySelector("#textReminder"),
  resetApp: document.querySelector("#resetApp"),
  friendForm: document.querySelector("#friendForm"),
  friendName: document.querySelector("#friendName"),
  friendEmail: document.querySelector("#friendEmail"),
  friendPhone: document.querySelector("#friendPhone"),
  friendList: document.querySelector("#friendList"),
  friendCount: document.querySelector("#friendCount"),
  spotCount: document.querySelector("#spotCount"),
  confirmedList: document.querySelector("#confirmedList"),
  waitlistList: document.querySelector("#waitlistList"),
  invitePreview: document.querySelector("#invitePreview"),
  friendTemplate: document.querySelector("#friendTemplate"),
};

async function init() {
  try {
    setStatus("Connecting to shared game...");
    await loadOrCreateGame();
    await loadFriends();
    if (!state.friends.length) {
      await createDefaultInvitees();
      await loadFriends();
    }
    render();
    setStatus("Shared game is live.");
    window.setInterval(loadAndRender, 15000);
  } catch (error) {
    console.error(error);
    setStatus(`Could not load shared game: ${error.message}`, true);
  }
}

async function loadOrCreateGame() {
  const requestedGameId = new URLSearchParams(window.location.search).get("game");

  if (requestedGameId) {
    const { data, error } = await db.from("games").select("*").eq("id", requestedGameId).single();
    if (error) throw error;
    state.game = data;
    return;
  }

  const { data: latest, error: latestError } = await db
    .from("games")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);

  if (latestError) throw latestError;

  if (latest.length) {
    state.game = latest[0];
  } else {
    const { data, error } = await db
      .from("games")
      .insert({
        title: "Pickleball",
        game_time: "Thursday at 6:00 PM",
        location: "Riverside courts",
        note: "Reply yes if you can play. First 4 are in.",
        max_players: MAX_CONFIRMED,
      })
      .select()
      .single();

    if (error) throw error;
    state.game = data;
  }

  const url = new URL(window.location.href);
  url.searchParams.set("game", state.game.id);
  window.history.replaceState({}, "", url.toString());
}

async function loadFriends() {
  const { data, error } = await db
    .from("invitees")
    .select("*")
    .eq("game_id", state.game.id)
    .order("created_at", { ascending: true });

  if (error) throw error;
  state.friends = normalizeStatuses(data || []);
}

async function loadAndRender() {
  if (state.saving || !state.game) return;
  await loadOrCreateGame();
  await loadFriends();
  render();
}

async function createDefaultInvitees() {
  const rows = defaultFriends.map((friend) => ({
    game_id: state.game.id,
    name: friend.name,
    email: friend.email,
    phone: friend.phone,
    token: crypto.randomUUID(),
    status: "invited",
  }));

  const { error } = await db.from("invitees").insert(rows);
  if (error) throw error;
}

function normalizeStatuses(friends) {
  const yeses = friends
    .filter((friend) => friend.status === "confirmed" || friend.status === "waitlist")
    .sort(byResponse);
  const confirmedIds = new Set(yeses.slice(0, MAX_CONFIRMED).map((friend) => friend.id));

  return friends.map((friend) => {
    if (friend.status !== "confirmed" && friend.status !== "waitlist") return friend;
    return { ...friend, status: confirmedIds.has(friend.id) ? "confirmed" : "waitlist" };
  });
}

function confirmedFriends() {
  return state.friends.filter((friend) => friend.status === "confirmed").sort(byResponse);
}

function waitlistedFriends() {
  return state.friends.filter((friend) => friend.status === "waitlist").sort(byResponse);
}

function byResponse(a, b) {
  return new Date(a.responded_at || a.created_at) - new Date(b.responded_at || b.created_at);
}

function render() {
  els.eventTime.value = state.game.game_time;
  els.eventLocation.value = state.game.location;
  els.eventNote.value = state.game.note;
  els.friendCount.textContent = state.friends.length;
  els.spotCount.textContent = `${confirmedFriends().length}/${MAX_CONFIRMED}`;
  els.invitePreview.textContent = inviteMessage();
  renderFriends();
  renderStatusLists();
  updateMessageLinks();
}

function renderFriends() {
  els.friendList.replaceChildren();

  state.friends.forEach((friend) => {
    const row = els.friendTemplate.content.firstElementChild.cloneNode(true);
    row.classList.add(friend.status);
    row.querySelector(".friend-name").textContent = friend.name;
    row.querySelector(".friend-contact").textContent = contactLabel(friend);

    const yesButton = row.querySelector(".yes");
    const noButton = row.querySelector(".no");
    const removeButton = row.querySelector(".remove");

    yesButton.textContent = friend.status === "waitlist" ? "Waitlisted" : "Yes";
    yesButton.disabled = friend.status === "confirmed" || friend.status === "waitlist" || state.saving;
    noButton.disabled = friend.status === "declined" || state.saving;
    removeButton.disabled = state.saving;

    yesButton.addEventListener("click", () => markYes(friend.id));
    noButton.addEventListener("click", () => markDeclined(friend.id));
    removeButton.addEventListener("click", () => removeFriend(friend.id));

    els.friendList.append(row);
  });
}

function renderStatusLists() {
  renderNameList(els.confirmedList, confirmedFriends(), "No one is confirmed yet.");
  renderNameList(els.waitlistList, waitlistedFriends(), "No waitlist yet.");
}

function renderNameList(container, friends, emptyText) {
  container.replaceChildren();

  if (!friends.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = emptyText;
    container.append(empty);
    return;
  }

  friends.forEach((friend, index) => {
    const item = document.createElement("div");
    item.className = "status-pill";
    item.innerHTML = `<strong>${index + 1}. ${friend.name}</strong><span>${friend.status === "confirmed" ? "Playing" : "Next up"}</span>`;
    container.append(item);
  });
}

function contactLabel(friend) {
  const parts = [friend.email, friend.phone].filter(Boolean);
  if (friend.status === "confirmed") parts.push("confirmed");
  if (friend.status === "waitlist") parts.push("waitlist");
  if (friend.status === "declined") parts.push("declined");
  return parts.length ? parts.join(" | ") : "No contact saved";
}

async function markYes(id) {
  await saveChange(async () => {
    const now = new Date().toISOString();
    const { error } = await db.from("invitees").update({ status: "confirmed", responded_at: now }).eq("id", id);
    if (error) throw error;
  });
}

async function markDeclined(id) {
  await saveChange(async () => {
    const { error } = await db.from("invitees").update({ status: "declined", responded_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
  });
}

async function removeFriend(id) {
  await saveChange(async () => {
    const { error } = await db.from("invitees").delete().eq("id", id);
    if (error) throw error;
  });
}

async function addFriend(event) {
  event.preventDefault();

  const name = els.friendName.value.trim();
  if (!name) return;

  await saveChange(async () => {
    const { error } = await db.from("invitees").insert({
      game_id: state.game.id,
      name,
      email: els.friendEmail.value.trim(),
      phone: els.friendPhone.value.trim(),
      token: crypto.randomUUID(),
      status: "invited",
    });

    if (error) throw error;
    els.friendForm.reset();
  });
}

async function saveGameField(key, value) {
  state.game[key] = value;
  render();

  window.clearTimeout(saveGameField.timer);
  saveGameField.timer = window.setTimeout(async () => {
    await saveChange(async () => {
      const { error } = await db.from("games").update({ [key]: state.game[key] }).eq("id", state.game.id);
      if (error) throw error;
    }, false);
  }, 450);
}

async function saveChange(action, reloadAfter = true) {
  try {
    state.saving = true;
    setStatus("Saving...");
    render();
    await action();
    if (reloadAfter) {
      await loadFriends();
    }
    render();
    setStatus("Saved to shared game.");
  } catch (error) {
    console.error(error);
    setStatus(`Could not save: ${error.message}`, true);
  } finally {
    state.saving = false;
    render();
  }
}

function inviteMessage() {
  return `Pickleball? ${state.game.game_time.trim()} at ${state.game.location.trim()}. ${state.game.note.trim()} RSVP here: ${shareUrl()}`;
}

function reminderMessage() {
  const names = confirmedFriends().map((friend) => friend.name).join(", ");
  return `Reminder: pickleball is ${state.game.game_time.trim()} at ${state.game.location.trim()}. Confirmed: ${names || "no one yet"}.`;
}

function shareUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set("game", state.game.id);
  return url.toString();
}

function updateMessageLinks() {
  const emails = state.friends.map((friend) => friend.email).filter(Boolean).join(",");
  const phones = state.friends.map((friend) => friend.phone).filter(Boolean).join(",");
  const confirmedEmails = confirmedFriends().map((friend) => friend.email).filter(Boolean).join(",");
  const confirmedPhones = confirmedFriends().map((friend) => friend.phone).filter(Boolean).join(",");

  els.emailInvite.href = mailtoLink(emails, "Pickleball RSVP", inviteMessage());
  els.textInvite.href = smsLink(phones, inviteMessage());
  els.emailReminder.href = mailtoLink(confirmedEmails, "Pickleball reminder", reminderMessage());
  els.textReminder.href = smsLink(confirmedPhones, reminderMessage());
  setActionState(els.emailInvite, Boolean(emails), "Add email addresses to use this.");
  setActionState(els.textInvite, Boolean(phones), "Add phone numbers to use this.");
  setActionState(els.emailReminder, Boolean(confirmedEmails), "Confirm players with emails first.");
  setActionState(els.textReminder, Boolean(confirmedPhones), "Confirm players with phone numbers first.");
}

function setActionState(element, enabled, disabledTitle) {
  element.classList.toggle("disabled", !enabled);
  element.setAttribute("aria-disabled", enabled ? "false" : "true");
  element.title = enabled ? "" : disabledTitle;
}

function mailtoLink(recipients, subject, body) {
  if (!recipients) return "#";
  return `mailto:${recipients}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function smsLink(recipients, body) {
  if (!recipients) return "#";
  return `sms:${recipients}?body=${encodeURIComponent(body)}`;
}

function handleDisabledLink(event) {
  if (event.currentTarget.getAttribute("href") === "#") {
    event.preventDefault();
  }
}

async function resetRsvps() {
  await saveChange(async () => {
    const { error } = await db
      .from("invitees")
      .update({ status: "invited", responded_at: null })
      .eq("game_id", state.game.id);
    if (error) throw error;
  });
}

function setStatus(message, isError = false) {
  els.appStatus.textContent = message;
  els.appStatus.classList.toggle("error", isError);
}

els.friendForm.addEventListener("submit", addFriend);
els.emailInvite.addEventListener("click", handleDisabledLink);
els.textInvite.addEventListener("click", handleDisabledLink);
els.emailReminder.addEventListener("click", handleDisabledLink);
els.textReminder.addEventListener("click", handleDisabledLink);
els.resetApp.addEventListener("click", resetRsvps);

els.eventTime.addEventListener("input", () => saveGameField("game_time", els.eventTime.value));
els.eventLocation.addEventListener("input", () => saveGameField("location", els.eventLocation.value));
els.eventNote.addEventListener("input", () => saveGameField("note", els.eventNote.value));

init();
