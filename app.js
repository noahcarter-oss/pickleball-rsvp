const STORAGE_KEY = "pickleball-rsvp";
const MAX_CONFIRMED = 4;

const oldDefaultNames = ["Avery", "Blake", "Casey", "Devon", "Emerson", "Finley"];
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

const state = loadState();

const els = {
  eventTime: document.querySelector("#eventTime"),
  eventLocation: document.querySelector("#eventLocation"),
  eventNote: document.querySelector("#eventNote"),
  emailInvite: document.querySelector("#emailInvite"),
  textInvite: document.querySelector("#textInvite"),
  emailReminder: document.querySelector("#emailReminder"),
  textReminder: document.querySelector("#textReminder"),
  copyInviteText: document.querySelector("#copyInviteText"),
  copyReminderText: document.querySelector("#copyReminderText"),
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

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      const friends = Array.isArray(parsed.friends) ? parsed.friends : [];
      return {
        eventTime: parsed.eventTime || "Thursday at 6:00 PM",
        eventLocation: parsed.eventLocation || "Riverside courts",
        eventNote: parsed.eventNote || "Reply yes if you can play. First 4 are in.",
        nextOrder: Number(parsed.nextOrder) || 1,
        friends: shouldReplaceOldDefaults(friends) ? createDefaultFriends() : friends,
      };
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  return {
    eventTime: "Thursday at 6:00 PM",
    eventLocation: "Riverside courts",
    eventNote: "Reply yes if you can play. First 4 are in.",
    nextOrder: 1,
    friends: createDefaultFriends(),
  };
}

function createDefaultFriends() {
  return defaultFriends.map((friend) => ({
    id: crypto.randomUUID(),
    name: friend.name,
    email: friend.email,
    phone: friend.phone,
    status: "invited",
    order: null,
  }));
}

function shouldReplaceOldDefaults(friends) {
  if (friends.length !== oldDefaultNames.length) return false;
  return friends.every((friend, index) => {
    return (
      friend.name === oldDefaultNames[index] &&
      !friend.email &&
      !friend.phone &&
      friend.status === "invited" &&
      friend.order === null
    );
  });
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function confirmedFriends() {
  return state.friends.filter((friend) => friend.status === "confirmed").sort(byOrder);
}

function waitlistedFriends() {
  return state.friends.filter((friend) => friend.status === "waitlist").sort(byOrder);
}

function byOrder(a, b) {
  return (a.order || 0) - (b.order || 0);
}

function render() {
  els.eventTime.value = state.eventTime;
  els.eventLocation.value = state.eventLocation;
  els.eventNote.value = state.eventNote;
  els.friendCount.textContent = state.friends.length;
  els.spotCount.textContent = `${confirmedFriends().length}/${MAX_CONFIRMED}`;
  els.invitePreview.textContent = inviteMessage();
  renderFriends();
  renderStatusLists();
  updateMessageLinks();
  saveState();
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
    yesButton.disabled = friend.status === "confirmed" || friend.status === "waitlist";
    noButton.disabled = friend.status === "declined";

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

function markYes(id) {
  const friend = state.friends.find((item) => item.id === id);
  if (!friend) return;

  friend.order = state.nextOrder;
  state.nextOrder += 1;
  friend.status = confirmedFriends().length < MAX_CONFIRMED ? "confirmed" : "waitlist";
  render();
}

function markDeclined(id) {
  const friend = state.friends.find((item) => item.id === id);
  if (!friend) return;

  friend.status = "declined";
  friend.order = null;
  promoteWaitlist();
  render();
}

function removeFriend(id) {
  state.friends = state.friends.filter((friend) => friend.id !== id);
  promoteWaitlist();
  render();
}

function promoteWaitlist() {
  while (confirmedFriends().length < MAX_CONFIRMED && waitlistedFriends().length) {
    waitlistedFriends()[0].status = "confirmed";
  }
}

function addFriend(event) {
  event.preventDefault();

  const name = els.friendName.value.trim();
  if (!name) return;

  state.friends.push({
    id: crypto.randomUUID(),
    name,
    email: els.friendEmail.value.trim(),
    phone: els.friendPhone.value.trim(),
    status: "invited",
    order: null,
  });

  els.friendForm.reset();
  render();
}

function inviteMessage() {
  return `Pickleball? ${state.eventTime.trim()} at ${state.eventLocation.trim()}. ${state.eventNote.trim()}`;
}

function reminderMessage() {
  const names = confirmedFriends().map((friend) => friend.name).join(", ");
  return `Reminder: pickleball is ${state.eventTime.trim()} at ${state.eventLocation.trim()}. Confirmed: ${names || "no one yet"}.`;
}

function updateMessageLinks() {
  const emails = state.friends.map((friend) => friend.email).filter(Boolean).join(",");
  const phones = state.friends.map((friend) => friend.phone).filter(Boolean).join(",");
  const confirmedEmails = confirmedFriends().map((friend) => friend.email).filter(Boolean).join(",");
  const confirmedPhones = confirmedFriends().map((friend) => friend.phone).filter(Boolean).join(",");

  els.emailInvite.href = mailtoLink(emails, "Pickleball?", inviteMessage());
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

function copyText(text, button) {
  navigator.clipboard.writeText(text).then(() => {
    button.classList.add("copied");
    window.setTimeout(() => button.classList.remove("copied"), 900);
  });
}

function handleInviteClick(event) {
  if (event.currentTarget.getAttribute("href") === "#") {
    event.preventDefault();
  }
}

function handleReminderClick(event) {
  if (event.currentTarget.getAttribute("href") === "#") {
    event.preventDefault();
  }
}

function resetApp() {
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
}

els.friendForm.addEventListener("submit", addFriend);
els.copyInviteText.addEventListener("click", () => copyText(inviteMessage(), els.copyInviteText));
els.copyReminderText.addEventListener("click", () => copyText(reminderMessage(), els.copyReminderText));
els.emailInvite.addEventListener("click", handleInviteClick);
els.textInvite.addEventListener("click", handleInviteClick);
els.emailReminder.addEventListener("click", handleReminderClick);
els.textReminder.addEventListener("click", handleReminderClick);
els.resetApp.addEventListener("click", resetApp);

["eventTime", "eventLocation", "eventNote"].forEach((key) => {
  els[key].addEventListener("input", () => {
    state[key] = els[key].value;
    render();
  });
});

render();
