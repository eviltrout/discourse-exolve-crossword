import { apiInitializer } from "discourse/lib/api";
import discourseDebounce from "discourse-common/lib/debounce";
import loadScript from "discourse/lib/load-script";
import { getUploadMarkdown } from "discourse/lib/uploads";
import { UploadPreProcessorPlugin } from "discourse/lib/uppy-plugin-base";

let enc = new TextEncoder();
let puzzles = {};
let code = {};

const options = `
   exolve-option: font-family:inherit
   exolve-option: color-imp-text:white color-currclue:transparent color-button:#193f47 color-button-text:white
   exolve-option: color-button-hover:#2b5b65 color-small-button:#193f47 color-small-button-hover:#2b5b65 color-small-button-text:white
   exolve-relabel:
     clear-all: Clear all
     check-all: Check all
     reveal-all: Reveal all
`;

class PuzUploadProcessor extends UploadPreProcessorPlugin {
    static pluginId = "puz-uploader";

    install() {
        this._install(this._parsePuz.bind(this));
    }

    async _parsePuz(fileIds) {
        await loadScript(settings.theme_uploads_local.exolve_js);

        for (let i=0; i<fileIds.length; i++) {
            let file = this._getFile(fileIds[i]);
            this._emitProgress(file);
            let buff = await new Blob([file.data]).arrayBuffer();
            code[file.name] = exolveFromPuz(buff);
        }
    }
}

async function applyExolve(element, key) {
	const exolves = element.querySelectorAll("pre[data-code-wrap=exolve-crossword]");
	if (!exolves.length) {
		return;
	}

	await loadScript(settings.theme_uploads_local.exolve_js);

	exolves.forEach(ex => {
		if (ex.dataset.processed) {
			return;
		}
		if (ex.dataset.codeHeight && key !== "composer") {
			ex.style.height = `${ex.dataset.codeHeight}px`;
		}
	});
	exolves.forEach((ex, index) => {
		const code = ex.querySelector("code");
		let puzId = ex.dataset.codePuzzleId;

		if (!code) {
			return;
		}
		let exolveCode = code.textContent || "";

        // Weird that the api is newline based
        exolveCode = exolveCode.replace("exolve-begin\n", "exolve-begin\n" + options);

        let id = "crossword-" + key + "-" + puzId;

        let targetElem = document.getElementById(id);
        if (!targetElem) {
            targetElem = document.createElement('div');
            targetElem.id = id;
            ex.parentElement.insertBefore(targetElem, ex);
        }

        if (key !== 'composer') {
            let crossword;
            if (puzzles[puzId]) {
                crossword = exolvePuzzles[puzzles[puzId]];
                crossword.destroy();
            }
            crossword = createExolve(exolveCode, id);
            if (crossword) {
                puzzles[puzId] = crossword.id;
            }
        } else {
            targetElem.innerText = '[ crossword will appear here on save ]';
        }
		ex.dataset.processed = true;
	});
}

export default apiInitializer("1.9.0", (api) => {
    api.addComposerUploadPreProcessor(PuzUploadProcessor, (h) => h);

    api.addComposerUploadMarkdownResolver(upload => {
      if (upload.extension === 'puz') {
          let id = upload.short_url.replace('upload://', '').replace('.puz', '');
          return("```exolve-crossword puzzle-id=" + id + "\n" + code[upload.original_filename] + "\n```\n" + getUploadMarkdown(upload));
      }
    });

	api.decorateCookedElement(
		async (elem, helper) => {
			const id = helper ? `post_${helper.getModel().id}` : "composer";
			applyExolve(elem, id);
		},
		{ id: "exolve-crossword" }
	);
});
