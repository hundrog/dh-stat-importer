import { ImportDialog } from "./import-dialog.js";
import { StatblockParser } from "./parser.js";
import { DaggerheartActorCreator } from "./actor-creator.js";

const MODULE_ID = "dh-stat-importer";

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "debugMode", {
    name: game.i18n.localize(`${MODULE_ID}.settings.debugMode.name`),
    hint: game.i18n.localize(`${MODULE_ID}.settings.debugMode.hint`),
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });

  const module = game.modules.get(MODULE_ID);
  if (module) {
    module.api = {
      ImportDialog,
      StatblockParser,
      DaggerheartActorCreator,
      open: () => ImportDialog.open()
    };
  }
});

Hooks.on("getSceneControlButtons", controls => {
  const tokenControls = controls.tokens ?? controls.token;
  const tools = tokenControls?.tools;
  if (!tools) return;

  const tool = {
    name: MODULE_ID,
    title: game.i18n.localize(`${MODULE_ID}.controls.importStatblock`),
    icon: "fa-solid fa-dragon",
    button: true,
    visible: game.user.isGM,
    onClick: () => ImportDialog.open()
  };

  if (Array.isArray(tools)) {
    if (!tools.some(existing => existing.name === MODULE_ID)) tools.push(tool);
  } else {
    tools[MODULE_ID] ??= tool;
  }
});

Hooks.on("renderActorDirectory", (app, html) => {
  if (!game.user.isGM) return;

  const root =
    html instanceof HTMLElement
      ? html
      : html?.[0] instanceof HTMLElement
        ? html[0]
        : app.element;
  if (!root?.querySelector) return;

  if (root.querySelector(".dh-stat-importer-button")) return;

  const header = root.querySelector(".directory-header");
  if (!header) return;

  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("dh-stat-importer-button");
  button.innerHTML = `<i class="fa-solid fa-dragon"></i><span>${game.i18n.localize(
    `${MODULE_ID}.controls.importStatblock`
  )}</span>`;
  button.addEventListener("click", event => {
    event.preventDefault();
    ImportDialog.open();
  });

  const actions = header.querySelector(".header-actions") ?? header;
  actions.prepend(button);
});

Hooks.once("ready", () => {
  console.log("DH Stats Importer | Ready");
});
