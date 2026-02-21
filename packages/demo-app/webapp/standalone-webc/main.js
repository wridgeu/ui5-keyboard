import "https://cdn.jsdelivr.net/npm/@ui5/webcomponents@2.15.1/dist/Button.js";
import "https://cdn.jsdelivr.net/npm/@ui5/webcomponents@2.15.1/dist/Input.js";
import "https://cdn.jsdelivr.net/npm/@ui5/webcomponents@2.15.1/dist/Label.js";
import "https://cdn.jsdelivr.net/npm/@ui5/webcomponents@2.15.1/dist/MessageStrip.js";
import "https://cdn.jsdelivr.net/npm/@ui5/webcomponents@2.15.1/dist/TextArea.js";

const nameInput = document.getElementById("nameInput");
const messageInput = document.getElementById("messageInput");
const greetBtn = document.getElementById("greetBtn");
const clearBtn = document.getElementById("clearBtn");
const statusStrip = document.getElementById("statusStrip");

function setStatus(text, design) {
  if (!(statusStrip instanceof HTMLElement)) return;
  statusStrip.textContent = text;
  statusStrip.setAttribute("design", design);
}

if (
  nameInput instanceof HTMLElement &&
  messageInput instanceof HTMLElement &&
  greetBtn instanceof HTMLElement &&
  clearBtn instanceof HTMLElement
) {
  greetBtn.addEventListener("click", () => {
    const name = nameInput.value || "there";
    const message = messageInput.value || "No message provided";
    setStatus(`Hello ${name}! Message received: ${message}`, "Positive");
  });

  clearBtn.addEventListener("click", () => {
    nameInput.value = "";
    messageInput.value = "";
    setStatus("Cleared", "Information");
  });
}
