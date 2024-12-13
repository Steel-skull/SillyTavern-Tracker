import { saveSettingsDebounced } from "../../../../../../script.js";
import { extensionFolderPath, extensionSettings } from "../../index.js";
import { debug, toTitleCase } from "../../lib/utils.js";
import { defaultSettings, generationModes, generationTargets } from "./defaultSettings.js";
import { generationCaptured } from "../../lib/interconnection.js";
import { TrackerPromptMakerModal } from "../ui/trackerPromptMakerModal.js";

export { generationModes, generationTargets, trackerFormat } from "./defaultSettings.js";

/**
 * Checks if the extension is enabled.
 * @returns {Promise<boolean>} True if enabled, false otherwise.
 */
export async function isEnabled() {
	debug("Checking if extension is enabled:", extensionSettings.enabled);
	return extensionSettings.enabled && (await generationCaptured());
}

// #region Settings Initialization

/**
 * Initializes the extension settings.
 * If certain settings are missing, uses default settings.
 * Saves the settings and loads the settings UI.
 */
export async function initSettings() {
	const currentSettings = { ...extensionSettings };

	if (!currentSettings.trackerDef) {
		const allowedKeys = ["enabled", "generateContextTemplate", "generateSystemPrompt", "generateRequestPrompt", "characterDescriptionTemplate", "mesTrackerTemplate", "numberOfMessages", "responseLength", "debugMode"];

		const newSettings = {
			...defaultSettings,
			...Object.fromEntries(allowedKeys.map((key) => [key, currentSettings[key] || defaultSettings[key]])),
			oldSettings: currentSettings,
		};

		for (const key in extensionSettings) {
			if (!(key in newSettings)) {
				delete extensionSettings[key];
			}
		}

		Object.assign(extensionSettings, newSettings);
	} else {
		Object.assign(extensionSettings, defaultSettings, currentSettings);
	}

	saveSettingsDebounced();

	await loadSettingsUI();
}

/**
 * Loads the settings UI by fetching the HTML and appending it to the page.
 * Sets initial values and registers event listeners.
 */
async function loadSettingsUI() {
	const settingsHtml = await $.get(`${extensionFolderPath}/html/settings.html`);
	$("#extensions_settings2").append(settingsHtml);

	setSettingsInitialValues();
	registerSettingsListeners();
	updateFieldVisibility(extensionSettings.generationMode);
}

/**
 * Sets the initial values for the settings UI elements based on current settings.
 */
function setSettingsInitialValues() {
	// Populate presets dropdown
	updatePresetDropdown();
	updatePopupDropdown();
	updateFieldVisibility(extensionSettings.generationMode);

	$("#tracker_enable").prop("checked", extensionSettings.enabled);
	$("#tracker_generation_mode").val(extensionSettings.generationMode);
	$("#tracker_generation_target").val(extensionSettings.generationTarget);
	$("#tracker_show_popup_for").val(extensionSettings.showPopupFor);
	$("#tracker_format").val(extensionSettings.trackerFormat);
	$("#tracker_debug").prop("checked", extensionSettings.debugMode);

	// Set other settings fields
	$("#tracker_context_prompt").val(extensionSettings.generateContextTemplate);
	$("#tracker_system_prompt").val(extensionSettings.generateSystemPrompt);
	$("#tracker_request_prompt").val(extensionSettings.generateRequestPrompt);
	$("#tracker_recent_messages").val(extensionSettings.generateRecentMessagesTemplate);
	$("#tracker_inline_request_prompt").val(extensionSettings.inlineRequestPrompt);
	$("#tracker_message_summarization_context_template").val(extensionSettings.messageSummarizationContextTemplate);
	$("#tracker_message_summarization_system_prompt").val(extensionSettings.messageSummarizationSystemPrompt);
	$("#tracker_message_summarization_request_prompt").val(extensionSettings.messageSummarizationRequestPrompt);
	$("#tracker_message_summarization_recent_messages").val(extensionSettings.messageSummarizationRecentMessagesTemplate);
	$("#tracker_character_description").val(extensionSettings.characterDescriptionTemplate);
	$("#tracker_mes_tracker_template").val(extensionSettings.mesTrackerTemplate);
	$("#tracker_number_of_messages").val(extensionSettings.numberOfMessages);
	$("#tracker_generate_from_message").val(extensionSettings.generateFromMessage);
	$("#tracker_response_length").val(extensionSettings.responseLength);
}

// #endregion

// #region Event Listeners

/**
 * Registers event listeners for settings UI elements.
 */
function registerSettingsListeners() {
	// Preset management
	$("#tracker_preset_select").on("change", onPresetSelectChange);
	$("#tracker_preset_new").on("click", onPresetNewClick);
	$("#tracker_preset_save").on("click", onPresetSaveClick);
	$("#tracker_preset_rename").on("click", onPresetRenameClick);
	$("#tracker_preset_restore").on("click", onPresetRestoreClick);
	$("#tracker_preset_delete").on("click", onPresetDeleteClick);
	$("#tracker_preset_export").on("click", onPresetExportClick);
	$("#tracker_preset_import_button").on("click", onPresetImportButtonClick);
	$("#tracker_preset_import").on("change", onPresetImportChange);

	// Settings fields
	$("#tracker_enable").on("input", onSettingCheckboxInput("enabled"));
	$("#tracker_generation_mode").on("change", onGenerationModeChange);
	$("#tracker_generation_target").on("change", onSettingSelectChange("generationTarget"));
	$("#tracker_show_popup_for").on("change", onSettingSelectChange("showPopupFor"));
	$("#tracker_format").on("change", onSettingSelectChange("trackerFormat"));
	$("#tracker_debug").on("input", onSettingCheckboxInput("debugMode"));

	$("#tracker_context_prompt").on("input", onSettingInputareaInput("generateContextTemplate"));
	$("#tracker_system_prompt").on("input", onSettingInputareaInput("generateSystemPrompt"));
	$("#tracker_request_prompt").on("input", onSettingInputareaInput("generateRequestPrompt"));
	$("#tracker_recent_messages").on("input", onSettingInputareaInput("generateRecentMessagesTemplate"));
	$("#tracker_inline_request_prompt").on("input", onSettingInputareaInput("inlineRequestPrompt"));
	$("#tracker_message_summarization_context_template").on("input", onSettingInputareaInput("messageSummarizationContextTemplate"));
	$("#tracker_message_summarization_system_prompt").on("input", onSettingInputareaInput("messageSummarizationSystemPrompt"));
	$("#tracker_message_summarization_request_prompt").on("input", onSettingInputareaInput("messageSummarizationRequestPrompt"));
	$("#tracker_message_summarization_recent_messages").on("input", onSettingInputareaInput("messageSummarizationRecentMessagesTemplate"));
	$("#tracker_character_description").on("input", onSettingInputareaInput("characterDescriptionTemplate"));
	$("#tracker_mes_tracker_template").on("input", onSettingInputareaInput("mesTrackerTemplate"));
	$("#tracker_number_of_messages").on("input", onSettingNumberInput("numberOfMessages"));
	$("#tracker_generate_from_message").on("input", onSettingNumberInput("generateFromMessage"));
	$("#tracker_response_length").on("input", onSettingNumberInput("responseLength"));

	$("#tracker_prompt_maker").on("click", onTrackerPromptMakerClick);
}

// #endregion

// #region Preset Management

/**
 * Updates the presets dropdown with the available presets.
 */
function updatePresetDropdown() {
	const presetSelect = $("#tracker_preset_select");
	presetSelect.empty();
	for (const presetName in extensionSettings.presets) {
		const option = $("<option>").val(presetName).text(presetName);
		if (presetName === extensionSettings.selectedPreset) {
			option.attr("selected", "selected");
		}
		presetSelect.append(option);
	}
}

/**
 * Event handler for changing the selected preset.
 */
function onPresetSelectChange() {
	const selectedPreset = $(this).val();
	extensionSettings.selectedPreset = selectedPreset;
	const presetSettings = extensionSettings.presets[selectedPreset];

	// Update settings with preset settings
	Object.assign(extensionSettings, presetSettings);
	debug("Selected preset:", { selectedPreset, presetSettings, extensionSettings });

	setSettingsInitialValues();
	saveSettingsDebounced();
}

/**
 * Event handler for creating a new preset.
 */
function onPresetNewClick() {
	const presetName = prompt("Enter a name for the new preset:");
	if (presetName && !extensionSettings.presets[presetName]) {
		const newPreset = getCurrentPresetSettings();
		extensionSettings.presets[presetName] = newPreset;
		extensionSettings.selectedPreset = presetName;
		updatePresetDropdown();
		saveSettingsDebounced();
		toastr.success(`Tracker preset ${presetName} created.`);
	} else if (extensionSettings.presets[presetName]) {
		alert("A preset with that name already exists.");
	}
}

/**
 * Event handler for creating a new preset.
 */
function onPresetSaveClick() {
	const presetName = extensionSettings.selectedPreset;

	const updatedPreset = getCurrentPresetSettings();
	extensionSettings.presets[presetName] = updatedPreset;
	saveSettingsDebounced();
	toastr.success(`Tracker preset ${presetName} saved.`);
}

/**
 * Event handler for renaming an existing preset.
 */
function onPresetRenameClick() {
	const oldName = $("#tracker_preset_select").val();
	const newName = prompt("Enter the new name for the preset:", oldName);
	if (newName && !extensionSettings.presets[newName]) {
		extensionSettings.presets[newName] = extensionSettings.presets[oldName];
		delete extensionSettings.presets[oldName];
		if (extensionSettings.selectedPreset === oldName) {
			extensionSettings.selectedPreset = newName;
		}
		updatePresetDropdown();
		saveSettingsDebounced();
		toastr.success(`Tracker preset ${oldName} renamed to ${newName}.`);
	} else if (extensionSettings.presets[newName]) {
		alert("A preset with that name already exists.");
	}
}

/**
 * Event handler for renaming an existing preset.
 */
function onPresetRestoreClick() {
	const presetSettings = extensionSettings.presets[extensionSettings.selectedPreset];

	// Restore settings with preset settings
	Object.assign(extensionSettings, presetSettings);

	setSettingsInitialValues();
	saveSettingsDebounced();
	toastr.success(`Tracker preset ${extensionSettings.selectedPreset} restored.`);
}

/**
 * Event handler for deleting a preset.
 */
function onPresetDeleteClick() {
	const presetName = $("#tracker_preset_select").val();
	if (confirm(`Are you sure you want to delete the preset "${presetName}"?`)) {
		delete extensionSettings.presets[presetName];
		extensionSettings.selectedPreset = Object.keys(extensionSettings.presets)[0];
		updatePresetDropdown();
		onPresetSelectChange.call($("#tracker_preset_select"));
		saveSettingsDebounced();
		toastr.success(`Tracker preset ${presetName} deleted.`);
	}
}

/**
 * Event handler for exporting a preset.
 */
function onPresetExportClick() {
	const presetName = $("#tracker_preset_select").val();
	const presetData = extensionSettings.presets[presetName];
	const dataStr = JSON.stringify({ [presetName]: presetData }, null, 2);
	const blob = new Blob([dataStr], { type: "application/json" });
	const url = URL.createObjectURL(blob);

	const a = $("<a>").attr("href", url).attr("download", `${presetName}.json`);
	$("body").append(a);
	a[0].click();
	a.remove();
	URL.revokeObjectURL(url);
}

/**
 * Event handler for clicking the import button.
 */
function onPresetImportButtonClick() {
	$("#tracker_preset_import").click();
}

/**
 * Event handler for importing presets from a file.
 * @param {Event} event The change event from the file input.
 */
function onPresetImportChange(event) {
	const file = event.target.files[0];
	if (!file) return;

	const reader = new FileReader();
	reader.onload = function (e) {
		try {
			const importedPresets = JSON.parse(e.target.result);
			for (const presetName in importedPresets) {
				if (!extensionSettings.presets[presetName] || confirm(`Preset "${presetName}" already exists. Overwrite?`)) {
					extensionSettings.presets[presetName] = importedPresets[presetName];
				}
			}
			updatePresetDropdown();
			saveSettingsDebounced();
			toastr.success("Presets imported successfully.");
		} catch (err) {
			alert("Failed to import presets: " + err.message);
		}
	};
	reader.readAsText(file);
}

/**
 * Retrieves the current settings to save as a preset.
 * @returns {Object} The current preset settings.
 */
function getCurrentPresetSettings() {
	return {
		generationMode: extensionSettings.generationMode,
		generateContextTemplate: extensionSettings.generateContextTemplate,
		generateSystemPrompt: extensionSettings.generateSystemPrompt,
		generateRecentMessagesTemplate: extensionSettings.generateRecentMessagesTemplate,
		inlineRequestPrompt: extensionSettings.inlineRequestPrompt,
		messageSummarizationContextTemplate: extensionSettings.messageSummarizationContextTemplate,
		messageSummarizationSystemPrompt: extensionSettings.messageSummarizationSystemPrompt,
		messageSummarizationRequestPrompt: extensionSettings.messageSummarizationRequestPrompt,
		messageSummarizationRecentMessagesTemplate: extensionSettings.messageSummarizationRecentMessagesTemplate,
		characterDescriptionTemplate: extensionSettings.characterDescriptionTemplate,
		mesTrackerTemplate: extensionSettings.mesTrackerTemplate,
		trackerDef: extensionSettings.trackerDef,
	};
}

// #endregion

// #region Setting Change Handlers

/**
 * Returns a function to handle checkbox input changes for a given setting.
 * @param {string} settingName The name of the setting.
 * @returns {Function} The event handler function.
 */
function onSettingCheckboxInput(settingName) {
	return function () {
		const value = Boolean($(this).prop("checked"));
		extensionSettings[settingName] = value;
		saveSettingsDebounced();
	};
}

/**
 * Returns a function to handle select input changes for a given setting.
 * @param {string} settingName The name of the setting.
 * @returns {Function} The event handler function.
 */
function onSettingSelectChange(settingName) {
	return function () {
		const value = $(this).val();
		extensionSettings[settingName] = value;
		saveSettingsDebounced();
		if (settingName === "generationTarget") {
			updatePopupDropdown();
		}
	};
}

/**
 * Event handler for changing the generation mode.
 * Updates the field visibility based on the selected mode.
 */
function onGenerationModeChange() {
	const value = $(this).val();
	extensionSettings.generationMode = value;
	updateFieldVisibility(value);
	saveSettingsDebounced();
}

/**
 * Returns a function to handle textarea input changes for a given setting.
 * @param {string} settingName The name of the setting.
 * @returns {Function} The event handler function.
 */
function onSettingInputareaInput(settingName) {
	return function () {
		const value = $(this).val();
		extensionSettings[settingName] = value;
		saveSettingsDebounced();
	};
}

/**
 * Returns a function to handle number input changes for a given setting.
 * @param {string} settingName The name of the setting.
 * @returns {Function} The event handler function.
 */
function onSettingNumberInput(settingName) {
	return function () {
		let value = parseFloat($(this).val());
		if (isNaN(value)) {
			value = 0;
		}

		if(settingName == "numberOfMessages" && value < 1) {
			value = 1; 
			$(this).val(1);
		}
		extensionSettings[settingName] = value;
		saveSettingsDebounced();
	};
}

/**
 * Event handler for clicking the Tracker Prompt Maker button.
 */
function onTrackerPromptMakerClick() {
	const modal = new TrackerPromptMakerModal();
	modal.show(extensionSettings.trackerDef, (updatedTracker) => {
		extensionSettings.trackerDef = updatedTracker;
		saveSettingsDebounced();
	});
}

// #endregion

// #region Field Visibility Management

/**
 * Updates the visibility of fields based on the selected generation mode.
 * @param {string} mode The current generation mode.
 */
function updateFieldVisibility(mode) {
	// Hide all sections first
	$("#generate_context_section").hide();
	$("#message_summarization_section").hide();
	$("#inline_request_section").hide();

	// Show fields based on the selected mode
	if (mode === generationModes.INLINE) {
		$("#inline_request_section").show();
	} else if (mode === generationModes.SINGLE_STAGE) {
		$("#generate_context_section").show();
	} else if (mode === generationModes.TWO_STAGE) {
		$("#generate_context_section").show();
		$("#message_summarization_section").show();
	}
}

// #endregion

// #region Popup Options Management

/**
 * Updates the popup for dropdown with the available values.
 */
function updatePopupDropdown() {
	const showPopupForSelect = $("#tracker_show_popup_for");
	const availablePopupOptions = [];
	switch (extensionSettings.generationTarget) {
		case generationTargets.CHARACTER:
			availablePopupOptions.push(generationTargets.USER);
			availablePopupOptions.push(generationTargets.NONE);
			break;
		case generationTargets.USER:
			availablePopupOptions.push(generationTargets.CHARACTER);
			availablePopupOptions.push(generationTargets.NONE);
			break;
		case generationTargets.BOTH:
			availablePopupOptions.push(generationTargets.NONE);
			break;
		case generationTargets.NONE:
			availablePopupOptions.push(generationTargets.BOTH);
			availablePopupOptions.push(generationTargets.USER);
			availablePopupOptions.push(generationTargets.CHARACTER);
			availablePopupOptions.push(generationTargets.NONE);
			break;
	}

	if(!availablePopupOptions.includes(extensionSettings.showPopupFor)) {
		extensionSettings.showPopupFor = generationTargets.NONE;
		saveSettingsDebounced();
	}

	showPopupForSelect.empty();
	for (const popupOption of availablePopupOptions) {
		const text = toTitleCase(popupOption);
		const option = $("<option>").val(popupOption).text(text);
		if (popupOption === extensionSettings.showPopupFor) {
			option.attr("selected", "selected");
		}
		showPopupForSelect.append(option);
	}
}

// #endregion
