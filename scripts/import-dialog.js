import { StatblockParser } from "./parser.js";
import { DaggerheartActorCreator } from "./actor-creator.js";

const MODULE_ID = "dh-stat-importer";

/**
 * Dialog for importing one or more Daggerheart adversary statblocks.
 */
export class ImportDialog {
  static async open() {
    const render =
      globalThis.foundry?.applications?.handlebars?.renderTemplate ??
      globalThis.renderTemplate;
    const content = await render(
      `modules/${MODULE_ID}/templates/import-dialog.html`,
      {
        typeLabel: game.i18n.localize(`${MODULE_ID}.dialog.type`),
        adversaryLabel: game.i18n.localize(`${MODULE_ID}.dialog.adversary`),
        environmentLabel: game.i18n.localize(`${MODULE_ID}.dialog.environment`),
        instructions: game.i18n.localize(`${MODULE_ID}.dialog.instructions`),
        placeholder: game.i18n.localize(`${MODULE_ID}.dialog.placeholder`),
        batchHint: game.i18n.localize(`${MODULE_ID}.dialog.batchHint`)
      }
    );

    return foundry.applications.api.DialogV2.wait({
      classes: ["dh-stat-importer-dialog"],
      window: {
        title: game.i18n.localize(`${MODULE_ID}.dialog.title`),
        resizable: true
      },
      position: { width: 640, height: "auto" },
      content,
      buttons: [
        {
          action: "import",
          label: game.i18n.localize(`${MODULE_ID}.button.import`),
          icon: "fa-solid fa-download",
          default: true,
          callback: (event, button, dialog) =>
            ImportDialog._handleImport(button, dialog)
        },
        {
          action: "cancel",
          label: game.i18n.localize(`${MODULE_ID}.button.close`),
          icon: "fa-solid fa-times"
        }
      ],
      rejectClose: false
    });
  }

  static async _handleImport(button, dialog) {
    const textarea = dialog.element?.querySelector(".statblock-input");
    const text = textarea?.value?.trim();
    const kind =
      dialog.element?.querySelector(".import-kind")?.value ?? "adversary";
    if (!text) {
      ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.notifications.empty`));
      return false;
    }

    const importButton =
      button instanceof HTMLElement
        ? button
        : dialog.element?.querySelector('[data-action="import"]');
    const originalButtonHtml = importButton?.innerHTML;

    if (importButton) {
      importButton.disabled = true;
      importButton.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${game.i18n.localize(
        `${MODULE_ID}.notifications.parsing`
      )}`;
    }

    try {
      const debug = game.settings.get(MODULE_ID, "debugMode");
      const parser = new StatblockParser({ debug, kind });
      let parsedStatblocks;

      try {
        parsedStatblocks = parser.parseAll(text);
      } catch (error) {
        ui.notifications.error(this._formatError(error));
        return false;
      }

      const creator = new DaggerheartActorCreator({ debug });
      const created = [];

      if (importButton) {
        importButton.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${game.i18n.localize(
          `${MODULE_ID}.notifications.creating`
        )}`;
      }

      for (const parsed of parsedStatblocks) {
        const actor = await creator.createActor(parsed);
        created.push(actor);

        if (parsed.missing?.length > 0) {
          const fields = parsed.missing
            .map(field =>
              game.i18n.localize(`${MODULE_ID}.fields.${field}`)
            )
            .join(", ");
          ui.notifications.warn(
            game.i18n.format(`${MODULE_ID}.notifications.missingStats`, {
              name: parsed.name,
              fields
            })
          );
        }
      }

      if (created.length === 1) {
        ui.notifications.info(
          game.i18n.format(`${MODULE_ID}.notifications.success`, {
            name: created[0].name
          })
        );
        created[0].sheet?.render(true);
      } else {
        ui.notifications.info(
          game.i18n.format(`${MODULE_ID}.notifications.batchSuccess`, {
            count: created.length
          })
        );
      }

      return true;
    } catch (error) {
      console.error("DH Stats Importer | Import failed", error);
      ui.notifications.error(this._formatError(error));
      return false;
    } finally {
      if (importButton) {
        importButton.disabled = false;
        importButton.innerHTML = originalButtonHtml;
      }
    }
  }

  static _formatError(error) {
    const codeMap = {
      EMPTY: "empty",
      INVALID_FORMAT: "invalidFormat",
      INVALID_ENVIRONMENT_TYPE: "invalidEnvironmentType",
      MISSING_NAME: "missingName",
      MISSING_TIER: "missingTier",
      MULTIPLE_BLOCKS: "multipleBlocks",
      TYPE_MISMATCH: "typeMismatch"
    };
    const code = codeMap[error.code] ?? "invalidFormat";
    const localizedKey = `${MODULE_ID}.errors.${code}`;
    const localized = game.i18n.localize(localizedKey);
    const message = localized === localizedKey ? error.message : localized;
    const blockIndex = error.details?.blockIndex;

    if (blockIndex) {
      return game.i18n.format(`${MODULE_ID}.notifications.invalidBlock`, {
        index: blockIndex,
        error: message
      });
    }

    return game.i18n.format(`${MODULE_ID}.notifications.error`, {
      error: message
    });
  }
}
