import { apiInitializer } from "discourse/lib/api";
import discourseDebounce from "discourse-common/lib/debounce";
import loadScript from "discourse/lib/load-script";
import { getUploadMarkdown } from "discourse/lib/uploads";
import { UploadPreProcessorPlugin } from "discourse/lib/uppy-plugin-base";

let enc = new TextEncoder();
let puzzles = {};
let code = {};

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

        let id = "crossword-" + key + "-" + puzId;

        let targetElem = document.getElementById(id);
        if (!targetElem) {
            targetElem = document.createElement('div');
            targetElem.id = id;
            ex.parentElement.prepend(targetElem);
        }

        if (key !== 'composer') {
            let crossword;
            if (puzzles[id]) {
                crossword = exolvePuzzles[puzzles[id]];
                crossword.destroy();
            }
            crossword = createExolve(exolveCode, id);
            if (crossword) {
                puzzles[id] = crossword.id;
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
      let id = upload.short_url.replace('upload://', '').replace('.puz', '');
      return("```exolve-crossword puzzle-id=" + id + "\n" + code[upload.original_filename] + "\n```\n" + getUploadMarkdown(upload));
    });

	api.decorateCookedElement(
		async (elem, helper) => {
			const id = helper ? `post_${helper.getModel().id}` : "composer";
			applyExolve(elem, id);
		},
		{ id: "exolve-crossword" }
	);
});
