import "./vendor-npm/@ui5/webcomponents/dist/Button.js";
import "./vendor-npm/@ui5/webcomponents/dist/Input.js";
import "./vendor-npm/@ui5/webcomponents/dist/Label.js";
import "./vendor-npm/@ui5/webcomponents/dist/MessageStrip.js";
import "./vendor-npm/@ui5/webcomponents/dist/TextArea.js";

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
